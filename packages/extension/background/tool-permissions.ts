import type { BrowserToolName } from '../tools/browser-tool-definitions.js';
import type { BrowserToolArgs } from '../tools/browser-tool-shared.js';
import type { BrowserTools } from '../tools/browser-tools.js';

type ToolPermissionCategory = 'navigate' | 'interact' | 'read' | 'screenshots' | 'tabs';

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
  evaluate: 'read',
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

export async function resolveToolUrl(
  _toolName: string,
  args: BrowserToolArgs,
  sessionId: string | undefined,
  currentSessionId: string | null,
  getBrowserTools: (id: string) => BrowserTools,
) {
  if (typeof args.url === 'string') return args.url;
  const tools = getBrowserTools(sessionId || currentSessionId || 'default');
  const tabId = typeof args.tabId === 'number' ? args.tabId : tools.getCurrentSessionTabId();
  try {
    if (typeof tabId === 'number') {
      const tab = await chrome.tabs.get(tabId);
      return tab?.url || '';
    }
  } catch (error) {
    console.warn('Failed to resolve tab URL for permissions:', error);
  }
  const [active] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  return active?.url || '';
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
  if (!settings) return { allowed: true };
  const permissions = settings.toolPermissions || {};
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

  const allowlist = parseAllowedDomains(settings.allowedDomains || '');
  if (!allowlist.length) return { allowed: true };

  const targetUrl = await resolveToolUrl(toolName, args, sessionId, currentSessionId, getBrowserTools);
  if (!isUrlAllowed(targetUrl, allowlist)) {
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
