import type { BrowserToolName } from '../tools/browser-tool-definitions.js';
import type { BrowserToolArgs } from '../tools/browser-tool-shared.js';
import type { BrowserTools } from '../tools/browser-tools.js';
import { isPrivateNetworkUrl, isPrivateUrlApproved } from './private-network.js';

type ToolPermissionCategory = 'navigate' | 'interact' | 'read' | 'screenshots' | 'tabs';

type ToolPermissionSettings = {
  toolPermissions?: Partial<Record<ToolPermissionCategory, boolean>>;
  allowedDomains?: string;
  allowedPrivateHosts?: string;
} & Record<string, unknown>;

const TOOL_PERMISSION_CATEGORIES: Record<BrowserToolName, ToolPermissionCategory> = {
  navigate: 'navigate',
  openTab: 'navigate',
  click: 'interact',
  clickAt: 'interact',
  type: 'interact',
  pressKey: 'interact',
  scroll: 'interact',
  waitFor: 'read',
  evaluate: 'read',
  watchNetwork: 'read',
  getNetworkLog: 'read',
  getContent: 'read',
  findHtml: 'read',
  screenshot: 'screenshots',
  watchVideo: 'screenshots',
  getVideoInfo: 'screenshots',
  getTabs: 'tabs',
  closeTab: 'tabs',
  switchTab: 'tabs',
  groupTabs: 'tabs',
  focusTab: 'tabs',
  describeSessionTabs: 'tabs',
};

export function getToolPermissionCategory(toolName: string): ToolPermissionCategory | null {
  if (!Object.hasOwn(TOOL_PERMISSION_CATEGORIES, toolName)) {
    return null;
  }
  return TOOL_PERMISSION_CATEGORIES[toolName as BrowserToolName];
}

export function parseAllowedDomains(value = '') {
  return String(value)
    .split(/[\n,]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isUrlAllowed(url: string, allowlist: string[]) {
  if (!allowlist.length) return true;
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return allowlist.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch (_error) {
    return false;
  }
}

// Only navigation tools act on the URL argument; every other tool acts on the tab it resolves to, so a
// model-supplied `url` must never stand in for the real target of a read or interaction.
const URL_ARGUMENT_TOOLS = new Set(['navigate', 'openTab']);

async function getTabUrls(tabId: number) {
  const tab = await chrome.tabs.get(tabId);
  return [tab?.url || '', tab?.pendingUrl || ''].filter(Boolean);
}

/** URLs a tool will act on: the navigation target, or the committed + pending URL of the resolved tab. */
export async function resolveToolTargetUrls(
  toolName: string,
  args: BrowserToolArgs,
  sessionId: string | undefined,
  currentSessionId: string | null,
  getBrowserTools: (id: string) => BrowserTools,
): Promise<string[]> {
  if (URL_ARGUMENT_TOOLS.has(toolName) && typeof args.url === 'string') return [args.url];
  const tools = getBrowserTools(sessionId || currentSessionId || 'default');
  try {
    if (typeof tools.resolveTabId === 'function') {
      const tabId = await tools.resolveTabId(args);
      return typeof tabId === 'number' ? await getTabUrls(tabId) : [];
    }
    const tabId = typeof args.tabId === 'number' ? args.tabId : tools.getCurrentSessionTabId();
    if (typeof tabId === 'number') return await getTabUrls(tabId);
  } catch (error) {
    console.warn('Failed to resolve tab URL for permissions:', error);
  }
  try {
    const [active] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return active?.url ? [active.url] : [];
  } catch (error) {
    console.warn('Failed to resolve active tab URL for permissions:', error);
    return [];
  }
}

/** Blocks unapproved loopback/LAN/intranet/file destinations regardless of the public-domain allowlist. */
export function checkPrivateNetworkAccess(urls: string[], settings: ToolPermissionSettings | null | undefined) {
  const approvals = [
    ...parseAllowedDomains(settings?.allowedPrivateHosts || ''),
    ...parseAllowedDomains(settings?.allowedDomains || ''),
  ];
  const blocked = urls.find((url) => isPrivateNetworkUrl(url) && !isPrivateUrlApproved(url, approvals));
  if (!blocked) return { allowed: true as const };
  const reason =
    'Blocked private-network destination (localhost, LAN, intranet or local file). ' +
    'Add the host to "Allowed private hosts" in settings to approve it.';
  return {
    allowed: false as const,
    reason,
    policy: { type: 'private-network', domain: blocked, reason },
  };
}

export async function checkToolPermission(
  toolName: string,
  args: BrowserToolArgs,
  settingsOverride: ToolPermissionSettings | null | undefined,
  currentSettings: ToolPermissionSettings | null,
  sessionId: string | undefined,
  currentSessionId: string | null,
  getBrowserTools: (id: string) => BrowserTools,
) {
  const settings = settingsOverride || currentSettings;
  const permissions = settings?.toolPermissions || {};
  const category = getToolPermissionCategory(toolName);
  if (category && permissions[category] === false) {
    return {
      allowed: false,
      reason: `Permission blocked: ${category}`,
      policy: {
        type: 'permission',
        category,
        reason: `Permission blocked: ${category}`,
      },
    };
  }

  if (category === 'tabs') return { allowed: true };

  const targetUrls = await resolveToolTargetUrls(toolName, args, sessionId, currentSessionId, getBrowserTools);
  const privateCheck = checkPrivateNetworkAccess(targetUrls, settings);
  if (!privateCheck.allowed) return privateCheck;

  const allowlist = parseAllowedDomains(settings?.allowedDomains || '');
  if (!allowlist.length) return { allowed: true };

  const targetUrl = targetUrls.find((url) => !isUrlAllowed(url, allowlist)) ?? (targetUrls.length ? null : '');
  if (targetUrl !== null) {
    return {
      allowed: false,
      reason: 'Blocked by allowed domains list.',
      policy: {
        type: 'allowlist',
        domain: targetUrl,
        reason: 'Blocked by allowed domains list.',
      },
    };
  }

  return { allowed: true };
}

/**
 * Re-checks the tab a read/interact/screenshot tool acted on after it ran. A redirect or late navigation can move
 * the tab onto a private origin between the pre-check and script execution; in that case the output is withheld.
 */
export async function recheckToolTargetAfterExecution(
  toolName: string,
  args: BrowserToolArgs,
  settings: ToolPermissionSettings | null | undefined,
  sessionId: string | undefined,
  currentSessionId: string | null,
  getBrowserTools: (id: string) => BrowserTools,
) {
  const category = getToolPermissionCategory(toolName);
  if (!category || category === 'tabs' || URL_ARGUMENT_TOOLS.has(toolName)) return { allowed: true as const };
  const targetUrls = await resolveToolTargetUrls(toolName, args, sessionId, currentSessionId, getBrowserTools);
  return checkPrivateNetworkAccess(targetUrls, settings);
}
