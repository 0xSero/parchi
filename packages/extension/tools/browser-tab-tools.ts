import {
  type BrowserToolArgs,
  type BrowserToolsDelegate,
  DEFAULT_SESSION_GROUP,
  type GroupOptions,
  MAX_SESSION_TABS,
  formatToolError,
  missingSessionTabError,
} from './browser-tool-shared.js';

const isNavigableUrl = (url: string) =>
  url.startsWith('http://') || url.startsWith('https://') || url.startsWith('chrome://');

export async function describeSessionTabsTool(ctx: BrowserToolsDelegate) {
  if (ctx.sessionTabs.size === 0) {
    await ctx.captureActiveTab();
  }
  return {
    success: true,
    tabs: ctx.getSessionTabSummaries(),
    activeTabId: ctx.currentSessionTabId,
    tabCount: ctx.sessionTabs.size,
    maxTabs: MAX_SESSION_TABS,
    canOpenMore: ctx.sessionTabs.size < MAX_SESSION_TABS,
    groupId: ctx.sessionTabGroupId,
    groupTitle: ctx.getGroupTitle(DEFAULT_SESSION_GROUP),
  };
}

export async function navigateTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();

  const url = args.url;
  if (!url || typeof url !== 'string') {
    return { success: false, error: 'Missing or invalid url parameter.' };
  }

  if (!isNavigableUrl(url)) {
    return {
      success: false,
      error: `Invalid URL: "${url}". URLs must start with http://, https://, or chrome://`,
      hint: 'For searches, navigate directly to the target site or use a direct search URL only when necessary.',
    };
  }

  try {
    await ctx.sendOverlay(tabId, {
      label: 'Navigate',
      note: url.replace(/^https?:\/\//, ''),
      durationMs: 1800,
    });
    await chrome.tabs.update(tabId, { url });
    ctx.currentSessionTabId = tabId;
    const existing = ctx.sessionTabs.get(tabId);
    if (existing) {
      existing.url = url;
    }
    return { success: true, tabId, url };
  } catch (error) {
    return {
      success: false,
      error: `Navigation failed: ${formatToolError(error)}`,
    };
  }
}

export async function openTabTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  if (ctx.sessionTabs.size >= MAX_SESSION_TABS) {
    return {
      success: false,
      error: `Tab limit reached (max ${MAX_SESSION_TABS} tabs per session). Close existing tabs with closeTab or use navigate on current tab.`,
      hint: 'Use closeTab({ tabId: <id> }) to close a tab, or navigate({ url: "..." }) to reuse current tab.',
    };
  }

  const url = args.url;
  if (!url || typeof url !== 'string') {
    return { success: false, error: 'Missing or invalid url parameter.' };
  }

  if (!isNavigableUrl(url)) {
    return {
      success: false,
      error: `Invalid URL: "${url}". URLs must start with http://, https://, or chrome://`,
      hint: 'Use a fully-qualified URL and prefer direct target-site navigation over generic search pages.',
    };
  }

  try {
    const targetWindowId = await ctx.resolveSessionWindowId();
    const createOptions: chrome.tabs.CreateProperties = { url, active: true };
    if (typeof targetWindowId === 'number') {
      createOptions.windowId = targetWindowId;
    }

    const tab = await chrome.tabs.create(createOptions);
    if (typeof tab.id === 'number') {
      ctx.sessionTabs.set(tab.id, {
        id: tab.id,
        title: tab.title,
        url: tab.url,
        favIconUrl: tab.favIconUrl,
        windowId: typeof tab.windowId === 'number' ? tab.windowId : undefined,
      });
      ctx.currentSessionTabId = tab.id;

      if (ctx.supportsTabGroups && ctx.sessionTabGroupId !== null) {
        try {
          await chrome.tabs.group({ groupId: ctx.sessionTabGroupId, tabIds: [tab.id] });
          await ctx.updateGroupTitle();
        } catch (error) {
          console.warn('Failed to add tab to session group:', error);
        }
      }
      void ctx.sendOverlay(tab.id, { label: 'Opened tab', note: url.replace(/^https?:\/\//, '') }, 2);
    }
    return { success: true, tabId: tab.id, url };
  } catch (error) {
    return {
      success: false,
      error: `Failed to open tab: ${formatToolError(error)}`,
      hint: 'Try using navigate() on current tab instead.',
    };
  }
}

export async function switchTabTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = typeof args.tabId === 'number' ? args.tabId : null;
  if (!tabId) return { success: false, error: 'Missing tabId.' };
  const tab = await chrome.tabs.get(tabId);
  if (typeof tab.windowId === 'number') {
    try {
      await chrome.windows.update(tab.windowId, { focused: true });
    } catch {
      // Continue and at least activate the tab even if window focus fails.
    }
  }
  await chrome.tabs.update(tabId, { active: true });
  ctx.currentSessionTabId = tabId;
  const existing = ctx.sessionTabs.get(tabId);
  if (existing) {
    existing.windowId = typeof tab.windowId === 'number' ? tab.windowId : existing.windowId;
    existing.title = tab.title || existing.title;
    existing.url = tab.url || existing.url;
    existing.favIconUrl = tab.favIconUrl || existing.favIconUrl;
  }
  await ctx.sendOverlay(tabId, { label: 'Focused tab', durationMs: 1200 }, 1);
  return { success: true, tabId };
}

export async function closeTabTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = typeof args.tabId === 'number' ? args.tabId : null;
  if (!tabId) return { success: false, error: 'Missing tabId.' };
  await chrome.tabs.remove(tabId);
  ctx.sessionTabs.delete(tabId);
  if (ctx.currentSessionTabId === tabId) {
    ctx.currentSessionTabId = null;
  }
  await ctx.updateGroupTitle();
  return { success: true, tabId };
}

export async function getTabsTool() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return {
    success: true,
    tabs: tabs.map((tab) => ({ id: tab.id, title: tab.title, url: tab.url })),
  };
}

export async function groupTabsTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  if (!ctx.supportsTabGroups) {
    return { success: false, error: 'Tab grouping is not supported in this browser.' };
  }
  const tabIds = Array.isArray(args.tabIds) ? args.tabIds.filter((id) => typeof id === 'number') : [];
  if (!tabIds.length) {
    return { success: false, error: 'No tab ids provided.' };
  }
  const options: GroupOptions = {
    title: typeof args.title === 'string' ? args.title : undefined,
    color: typeof args.color === 'string' ? (args.color as chrome.tabGroups.ColorEnum) : undefined,
  };
  await ctx.groupTabsInternal(tabIds, options);
  return { success: true, tabIds };
}
