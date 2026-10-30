// Classifies what an agent tool would actually touch: every frame document in the target tab, judged by its real
// origin and the remote address the browser connected to (network-observer), not by model-supplied URLs.
import { type NetworkObservation, getNetworkObservation } from './network-observer.js';
import { isPrivateIpAddress, isPrivateNetworkUrl, isPrivateUrlApproved } from './private-network.js';

/** public < approved (user-approved private) < unverified (address unknown) < private (unapproved). */
export type Verdict = 'public' | 'approved' | 'unverified' | 'private';
const RANK: Record<Verdict, number> = { public: 0, approved: 1, unverified: 2, private: 3 };

export const worstVerdict = (verdicts: Verdict[]): Verdict =>
  verdicts.reduce<Verdict>((worst, next) => (RANK[next] > RANK[worst] ? next : worst), 'public');

export const isBlockedVerdict = (verdict: Verdict) => verdict === 'private' || verdict === 'unverified';

export type FrameTarget = { frameId: number; documentId?: string; url: string; origin: string };

export type Assessment = {
  verdict: Verdict;
  /** Origin that produced the verdict (for errors/taint). */
  origin: string;
  frames: FrameTarget[];
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

/**
 * Judges one destination. `ip` is the browser-observed remote address when known; otherwise the frame/origin
 * observations are consulted, and an http(s) destination with no observed address is `unverified` (fail closed).
 */
export function assessDestination(
  target: { url: string; origin?: string; tabId?: number; frameId?: number; documentId?: string; ip?: string },
  approvals: string[],
  obs: NetworkObservation | null,
): { verdict: Verdict; origin: string; approvedOrigins: string[] } {
  const parsed = parse(target.url);
  // about:blank/srcdoc/blob frames inherit their creator's origin, which the frame probe reports.
  const effective = parsed && NETWORK_SCHEMES.has(parsed.protocol) ? parsed : parse(target.origin || '');
  const approvedOrigins: string[] = [];
  const judge = (url: string, origin: string, isPrivate: boolean): Verdict => {
    if (!isPrivate) return 'public';
    if (!isPrivateUrlApproved(url, approvals)) return 'private';
    approvedOrigins.push(origin);
    return 'approved';
  };

  let verdict: Verdict = 'public';
  let origin = effective?.origin || target.origin || '';
  if (parsed?.protocol === 'file:') {
    verdict = judge(target.url, 'file://', true);
    origin = 'file://';
  } else if (effective && NETWORK_SCHEMES.has(effective.protocol)) {
    const url = effective.href;
    const ip =
      target.ip ||
      (typeof target.tabId === 'number' && typeof target.frameId === 'number'
        ? obs?.frameIp(target.tabId, target.frameId, effective.origin)
        : undefined) ||
      obs?.originIp(effective.origin);
    if (isPrivateNetworkUrl(url) || (ip && isPrivateIpAddress(ip))) verdict = judge(url, effective.origin, true);
    else if (!ip) verdict = isPrivateUrlApproved(url, approvals) ? judge(url, effective.origin, true) : 'unverified';
  }

  // Private-address subresources loaded by this document (DNS rebinding, private img/xhr) taint the frame.
  for (const privateOrigin of obs?.documentPrivateOrigins(target.documentId) || []) {
    verdict = worstVerdict([verdict, judge(privateOrigin, privateOrigin, true)]);
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
 * Assesses everything an operation on `tabId` could read or write: all frame documents plus the committed and
 * pending tab URLs. `frames` is empty when scripts cannot run in the tab (browser pages, error pages).
 */
export async function assessTab(tabId: number, approvals: string[], probe = true): Promise<Assessment> {
  const obs = await getNetworkObservation();
  let tab: chrome.tabs.Tab | null = null;
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return { verdict: 'unverified', origin: '', frames: [], approvedOrigins: [] };
  }
  const frames = (probe ? await probeFrames(tabId) : null) || [];
  const targets = [
    ...frames.map((frame) => ({ ...frame, tabId })),
    ...(frames.length ? [] : [{ url: tab?.url || '', tabId, frameId: 0 }]),
    ...(tab?.pendingUrl ? [{ url: tab.pendingUrl }] : []),
  ].filter((target) => target.url);
  let worst: Assessment = { verdict: 'public', origin: '', frames, approvedOrigins: [] };
  for (const target of targets) {
    const result = assessDestination(target, approvals, obs);
    worst.approvedOrigins.push(...result.approvedOrigins);
    if (RANK[result.verdict] > RANK[worst.verdict])
      worst = { ...worst, verdict: result.verdict, origin: result.origin };
  }
  return worst;
}

/** Quick (script-free) verdict for a tab URL, used to redact tab listings. */
export async function assessTabUrl(tabId: number | undefined, url: string, approvals: string[]) {
  const obs = await getNetworkObservation();
  return assessDestination({ url, tabId, frameId: 0 }, approvals, obs);
}

export async function assessUrlWithAddress(url: string, ip: string | undefined, approvals: string[]) {
  const obs = await getNetworkObservation();
  return assessDestination({ url, ip }, approvals, obs);
}
