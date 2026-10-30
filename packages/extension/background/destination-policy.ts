// Classifies what an agent tool would actually touch: every frame document in the target tab, judged by its real
// origin and the remote address the browser connected to for that exact committed document (network-observer).
// There is no per-origin or per-frame-slot fallback: a document whose own response was not observed is unverified.
import { type NetworkObservation, documentKey, getNetworkObservation } from './network-observer.js';
import { isPrivateIpAddress, isPrivateNetworkUrl, isPrivateUrlApproved } from './private-network.js';

/** public < approved (user-approved private) < unverified (address unknown) < private (unapproved). */
export type Verdict = 'public' | 'approved' | 'unverified' | 'private';
const RANK: Record<Verdict, number> = { public: 0, approved: 1, unverified: 2, private: 3 };

export const worstVerdict = (verdicts: Verdict[]): Verdict =>
  verdicts.reduce<Verdict>((worst, next) => (RANK[next] > RANK[worst] ? next : worst), 'public');

export const isBlockedVerdict = (verdict: Verdict) => verdict === 'private' || verdict === 'unverified';

export type FrameTarget = { frameId: number; documentId?: string; url: string; origin: string };
export type JudgedFrame = FrameTarget & { verdict: Verdict };

export type Assessment = {
  verdict: Verdict;
  /** Origin that produced the verdict (for errors/taint). */
  origin: string;
  frames: JudgedFrame[];
  /** Approved private origins this target exposes (used for private-read taint). */
  approvedOrigins: string[];
};

const NETWORK_SCHEMES = new Set(['http:', 'https:', 'ws:', 'wss:']);

function parse(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

type Target = { url: string; origin?: string; tabId?: number; frameId?: number; documentId?: string; ip?: string };

/**
 * Judges one destination. `ip` is a remote address reported for this exact resource (network log); otherwise the
 * address bound to the committed document (tabId/frameId/documentId) is used. No address => `unverified`.
 */
export function assessDestination(
  target: Target,
  approvals: string[],
  obs: NetworkObservation | null,
): { verdict: Verdict; origin: string; approvedOrigins: string[] } {
  const parsed = parse(target.url);
  const approvedOrigins: string[] = [];
  const judge = (url: string, origin: string): Verdict => {
    if (!isPrivateUrlApproved(url, approvals)) return 'private';
    approvedOrigins.push(origin);
    return 'approved';
  };
  const key =
    typeof target.tabId === 'number' && typeof target.frameId === 'number'
      ? documentKey(target.documentId, target.tabId, target.frameId)
      : undefined;

  let verdict: Verdict = 'public';
  let origin = parsed && NETWORK_SCHEMES.has(parsed.protocol) ? parsed.origin : target.origin || '';
  if (parsed?.protocol === 'file:') {
    verdict = judge(target.url, 'file://');
    origin = 'file://';
  } else if (parsed && NETWORK_SCHEMES.has(parsed.protocol)) {
    const record = key ? obs?.documentIp(key) : undefined;
    const ip = target.ip ?? (record && record.origin === parsed.origin ? record.ip : '');
    if (isPrivateNetworkUrl(parsed.href) || (ip && isPrivateIpAddress(ip))) verdict = judge(parsed.href, origin);
    else if (!ip) verdict = isPrivateUrlApproved(parsed.href, approvals) ? judge(parsed.href, origin) : 'unverified';
  } else {
    // about:blank/srcdoc/blob/data documents have no response of their own; they inherit the creator's origin
    // (reported by the frame probe), whose own document in this tab is judged separately.
    const inherited = parse(origin);
    if (inherited && isPrivateNetworkUrl(inherited.href)) verdict = judge(inherited.href, origin);
  }

  // Private responses loaded by this document (DNS rebinding, private img/xhr) taint the frame.
  for (const privateOrigin of obs?.documentPrivateOrigins(key) || []) {
    verdict = worstVerdict([verdict, judge(privateOrigin, privateOrigin)]);
  }
  return { verdict, origin, approvedOrigins };
}

/** Lists every frame document in the tab with its real URL/origin. Returns null when scripts cannot run there. */
export async function probeFrames(tabId: number): Promise<FrameTarget[] | null> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => ({ url: location.href, origin: self.origin }),
    });
    return results
      .filter((entry) => entry?.result)
      .map((entry) => ({
        frameId: entry.frameId,
        documentId: (entry as { documentId?: string }).documentId,
        url: String((entry.result as { url: string }).url),
        origin: String((entry.result as { origin: string }).origin),
      }));
  } catch {
    return null;
  }
}

/**
 * Assesses everything an operation on `tabId` could read or write: every frame document, plus any pending
 * navigation. With `probe`, an http(s) tab whose frames cannot be enumerated is unverified (fail closed); without it
 * (navigation results, listings) only the committed main-frame document is judged.
 */
export async function assessTab(tabId: number, approvals: string[], probe = true): Promise<Assessment> {
  const obs = await getNetworkObservation();
  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return { verdict: 'unverified', origin: '', frames: [], approvedOrigins: [] };
  }
  const probed = probe ? await probeFrames(tabId) : null;
  const tabUrl = tab.url || '';
  const mainKey = obs.mainDocumentKey(tabId);
  const targets: Target[] = probed
    ? probed.map((frame) => ({ ...frame, tabId }))
    : [{ url: tabUrl, tabId, frameId: 0, documentId: mainKey?.startsWith('frame:') ? undefined : mainKey }];
  const assessment: Assessment = { verdict: 'public', origin: '', frames: [], approvedOrigins: [] };
  const consider = (verdict: Verdict, origin: string) => {
    if (RANK[verdict] > RANK[assessment.verdict]) Object.assign(assessment, { verdict, origin });
  };
  for (const target of targets) {
    const result = assessDestination(target, approvals, obs);
    assessment.approvedOrigins.push(...result.approvedOrigins);
    if (probed) assessment.frames.push({ ...(target as FrameTarget), verdict: result.verdict });
    consider(result.verdict, result.origin);
  }
  if (probe && !probed && NETWORK_SCHEMES.has(parse(tabUrl)?.protocol || '')) consider('unverified', tabUrl);
  if (tab.pendingUrl) {
    // The incoming document has not committed, so its address is unknown: never read or write mid-navigation.
    const pending = parse(tab.pendingUrl);
    const approved = pending && isPrivateNetworkUrl(pending.href) && isPrivateUrlApproved(pending.href, approvals);
    if (approved) assessment.approvedOrigins.push(pending.origin);
    else consider(pending && isPrivateNetworkUrl(pending.href) ? 'private' : 'unverified', pending?.origin || '');
  }
  return assessment;
}

/** Quick (script-free) verdict for a tab URL, used to redact tab listings. */
export async function assessTabUrl(tabId: number | undefined, url: string, approvals: string[]) {
  const obs = await getNetworkObservation();
  const mainKey = typeof tabId === 'number' ? obs.mainDocumentKey(tabId) : undefined;
  const documentId = mainKey?.startsWith('frame:') ? undefined : mainKey;
  return assessDestination({ url, tabId, frameId: 0, documentId }, approvals, obs);
}

/** Judges a network-log entry by the remote address reported for that request (no document fallback). */
export function assessUrlWithAddress(url: string, ip: string | undefined, approvals: string[]) {
  return assessDestination({ url, ip: ip || '' }, approvals, null);
}
