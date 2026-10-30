// Tool-boundary enforcement for issue #42, applied by browser-gate around every agent browser tool call:
// 1. preflight: judge the real target (all frames + observed remote address); unapproved private or unverified
//    destinations are refused, and the call is pinned to the exact documents that were judged;
// 2. postflight: re-judge after execution (redirects, late navigation, rebinding) and withhold output, redact tab
//    listings and network logs, and record private reads;
// 3. once a session read approved private content, writes/navigation to non-allowlisted public sites are refused.
import type { BrowserToolArgs, ExecutionScope } from '../tools/browser-tool-shared.js';
import type { BrowserTools } from '../tools/browser-tools.js';
import {
  type Assessment,
  assessTab,
  assessTabUrl,
  assessUrlWithAddress,
  isBlockedVerdict,
} from './destination-policy.js';
import { getPrivateReads, markPrivateRead } from './network-observer.js';
import { isPrivateNetworkUrl, isPrivateUrlApproved } from './private-network.js';

type GuardSettings = Record<string, unknown> | null | undefined;
type Blocked = { allowed: false; reason: string; policy: Record<string, unknown> };
type GuardResult = { allowed: true } | Blocked;

const NAV_TOOLS = new Set(['navigate', 'openTab']);
const LIST_TOOLS = new Set(['getTabs', 'describeSessionTabs']);
const TAB_CONTROL_TOOLS = new Set(['closeTab', 'switchTab', 'groupTabs', 'focusTab']);
const WRITE_TOOLS = new Set(['navigate', 'openTab', 'click', 'clickAt', 'type', 'pressKey', 'evaluate']);

const splitList = (value: unknown) =>
  String(value || '')
    .split(/[\n,]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
export const privateApprovals = (settings: GuardSettings) => splitList(settings?.allowedPrivateHosts);

const blocked = (type: string, reason: string, domain?: string): Blocked => ({
  allowed: false,
  reason,
  policy: { type, reason, ...(domain ? { domain } : {}) },
});

const destinationBlocked = (assessment: { verdict: string; origin: string }): Blocked =>
  assessment.verdict === 'unverified'
    ? blocked(
        'unverified-destination',
        'Blocked: the network address of this page could not be verified. Reload it with navigate, or add the host to "Allowed Private Hosts" if it is a trusted local site.',
        assessment.origin,
      )
    : blocked(
        'private-network',
        'Blocked private-network destination (localhost, LAN, intranet, or a hostname that resolved to a private address). Add the host to "Allowed Private Hosts" in settings to approve it.',
        assessment.origin,
      );

/** True when `url` is a site the user explicitly listed in Allowed Domains (an empty list approves nothing). */
function isExplicitlyAllowedPublic(url: string, settings: GuardSettings) {
  const allowlist = splitList(settings?.allowedDomains);
  try {
    const host = new URL(url).hostname.toLowerCase();
    return allowlist.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

async function resolveTargetTab(toolName: string, args: BrowserToolArgs, tools: BrowserTools) {
  const tabId = await tools.resolveTabId(args);
  if (toolName !== 'screenshot' || typeof tabId !== 'number') return tabId;
  // captureVisibleTab captures whichever tab is visible in the window, so judge that tab as well.
  const tab = await chrome.tabs.get(tabId);
  const [visible] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
  return visible?.id ?? tabId;
}

/** Judges a navigation target string. A hostname that later resolves privately is caught by postflight/reads. */
function checkNavigationUrl(url: string, settings: GuardSettings): GuardResult {
  if (isPrivateNetworkUrl(url) && !isPrivateUrlApproved(url, privateApprovals(settings))) {
    return destinationBlocked({ verdict: 'private', origin: url });
  }
  return { allowed: true };
}

export async function guardSpawnUrl(url: string | undefined, sessionId: string, settings: GuardSettings) {
  if (!url || url === 'about:blank') return { allowed: true } as GuardResult;
  const navCheck = checkNavigationUrl(url, settings);
  if (!navCheck.allowed) return navCheck;
  return checkPublicWrite(url, sessionId, settings);
}

async function checkPublicWrite(url: string, sessionId: string, settings: GuardSettings): Promise<GuardResult> {
  if (isPrivateNetworkUrl(url) || isExplicitlyAllowedPublic(url, settings)) return { allowed: true };
  const reads = await getPrivateReads(sessionId);
  if (!reads.length) return { allowed: true };
  return blocked(
    'private-read-public-write',
    `Blocked: this session read private-network content (${reads.join(', ')}). Typing, clicking, scripting or navigating on public sites is refused so that content cannot be sent out. Add the destination to "Allowed Domains" to permit it, or start a new session.`,
    url,
  );
}

export async function preflightDestination(
  toolName: string,
  args: BrowserToolArgs,
  tools: BrowserTools,
  sessionId: string,
  settings: GuardSettings,
): Promise<GuardResult & { scope?: ExecutionScope }> {
  if (LIST_TOOLS.has(toolName) || TAB_CONTROL_TOOLS.has(toolName)) return { allowed: true };
  if (NAV_TOOLS.has(toolName)) {
    if (typeof args.url !== 'string') return { allowed: true };
    const navCheck = checkNavigationUrl(args.url, settings);
    return navCheck.allowed ? checkPublicWrite(args.url, sessionId, settings) : navCheck;
  }
  const tabId = await resolveTargetTab(toolName, args, tools);
  if (typeof tabId !== 'number') return { allowed: true }; // the tool itself reports the missing tab
  const assessment = await assessTab(tabId, privateApprovals(settings));
  if (isBlockedVerdict(assessment.verdict)) return destinationBlocked(assessment);
  if (WRITE_TOOLS.has(toolName) && assessment.verdict === 'public') {
    const tab = await chrome.tabs.get(tabId);
    const writeCheck = await checkPublicWrite(tab.url || '', sessionId, settings);
    if (!writeCheck.allowed) return writeCheck;
  }
  return { allowed: true, scope: { tabId, frames: assessment.frames } };
}

/** Hides titles/URLs of tabs on private or unverified destinations before they reach the model. */
export async function redactTabEntry<T extends { id?: number; url?: string; title?: string }>(
  entry: T,
  settings: GuardSettings,
): Promise<T | { id?: number; url?: string; redacted: string }> {
  const id = typeof entry?.id === 'number' ? entry.id : undefined;
  const { verdict } = await assessTabUrl(id, String(entry?.url || ''), privateApprovals(settings));
  if (verdict === 'public') return entry;
  // Approved private tabs keep their URL but not their title; private/unverified tabs keep only their id.
  return verdict === 'approved'
    ? { id, url: entry.url, redacted: 'private-network-title' }
    : { id, redacted: verdict === 'private' ? 'private-network' : 'unverified-destination' };
}

async function redactTabList(result: Record<string, unknown>, settings: GuardSettings) {
  if (!Array.isArray(result.tabs)) return result;
  const tabs = await Promise.all(result.tabs.map((entry) => redactTabEntry(entry, settings)));
  return { ...result, tabs };
}

async function filterNetworkLog(result: Record<string, unknown>, sessionId: string, settings: GuardSettings) {
  if (!Array.isArray(result.entries)) return result;
  const approvals = privateApprovals(settings);
  let withheld = 0;
  const entries: Array<Record<string, unknown>> = [];
  for (const entry of result.entries as Array<Record<string, unknown>>) {
    const ip = typeof entry.remoteIPAddress === 'string' && entry.remoteIPAddress ? entry.remoteIPAddress : undefined;
    const assessment = await assessUrlWithAddress(String(entry.url || ''), ip, approvals);
    if (assessment.verdict === 'private') {
      withheld += 1;
    } else if (assessment.verdict === 'unverified') {
      entries.push({ ...entry, body: undefined, requestHeaders: undefined, responseHeaders: undefined });
    } else {
      for (const origin of assessment.approvedOrigins) markPrivateRead(sessionId, origin);
      entries.push(entry);
    }
  }
  return { ...result, entries, ...(withheld ? { withheldPrivateEntries: withheld } : {}) };
}

/**
 * Re-judges the destination after the tool ran. Returns the (possibly redacted) result, or a block when the target
 * moved onto an unapproved private/unverified destination while the tool ran. Side effects already caused by the
 * tool (e.g. a click that submitted a form, or the GET of a redirected navigation) cannot be undone here.
 */
export async function postflightDestination(
  toolName: string,
  args: BrowserToolArgs,
  result: unknown,
  tools: BrowserTools,
  sessionId: string,
  settings: GuardSettings,
): Promise<{ allowed: true; result: unknown } | Blocked> {
  const record = result && typeof result === 'object' ? (result as Record<string, unknown>) : null;
  if (!record || TAB_CONTROL_TOOLS.has(toolName)) return { allowed: true, result };
  if (LIST_TOOLS.has(toolName)) return { allowed: true, result: await redactTabList(record, settings) };
  if (toolName === 'getNetworkLog') {
    const filtered = await filterNetworkLog(record, sessionId, settings);
    return postflightTab(toolName, args, filtered, tools, sessionId, settings);
  }
  return postflightTab(toolName, args, record, tools, sessionId, settings);
}

async function postflightTab(
  toolName: string,
  args: BrowserToolArgs,
  record: Record<string, unknown>,
  tools: BrowserTools,
  sessionId: string,
  settings: GuardSettings,
) {
  let tabId: number | null = null;
  if (NAV_TOOLS.has(toolName)) tabId = typeof record.tabId === 'number' ? record.tabId : null;
  else if (toolName === 'screenshot' && typeof record.capturedTabId === 'number') tabId = record.capturedTabId;
  else tabId = await tools.resolveTabId(args);
  if (typeof tabId !== 'number') return { allowed: true as const, result: record };
  const assessment: Assessment = await assessTab(tabId, privateApprovals(settings), !NAV_TOOLS.has(toolName));
  // A navigation that has not produced a response yet is unverified; later reads are judged then.
  const refuse = NAV_TOOLS.has(toolName) ? assessment.verdict === 'private' : isBlockedVerdict(assessment.verdict);
  if (refuse) return destinationBlocked(assessment);
  for (const origin of assessment.approvedOrigins) markPrivateRead(sessionId, origin);
  return { allowed: true as const, result: record };
}
