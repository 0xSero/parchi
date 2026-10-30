import type { BrowserToolName } from '../tools/browser-tool-definitions.js';
import type { BrowserToolArgs } from '../tools/browser-tool-shared.js';
import type { BrowserTools } from '../tools/browser-tools.js';

type ToolPermissionCategory = 'navigate' | 'interact' | 'read' | 'screenshots' | 'tabs' | 'script';

type ToolPermissionSettings = {
  toolPermissions?: Partial<Record<ToolPermissionCategory, boolean>>;
  allowedDomains?: string;
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
  evaluate: 'script',
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
  // evaluate runs arbitrary page JavaScript (it can fetch/post anywhere the page can), so it is opt-in only.
  const disabled = category === 'script' ? permissions.script !== true : category && permissions[category] === false;
  if (disabled) {
    const reason =
      category === 'script'
        ? 'Permission blocked: script. evaluate runs arbitrary JavaScript and is off unless "Run JavaScript" is enabled in Tool Permissions.'
        : `Permission blocked: ${category}`;
    return {
      allowed: false,
      reason,
      policy: { type: 'permission', category, reason },
    };
  }

  if (category === 'tabs') return { allowed: true };

  const allowlist = parseAllowedDomains(settings?.allowedDomains || '');
  if (!allowlist.length) return { allowed: true };

  const targetUrls = await resolveToolTargetUrls(toolName, args, sessionId, currentSessionId, getBrowserTools);

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
