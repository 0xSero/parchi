import { getActiveTab } from '../utils/active-tab.js';
import {
  DEFAULT_SESSION_GROUP,
  type GroupOptions,
  MAX_SESSION_TABS,
  type SessionTabSummary,
} from './browser-tool-shared.js';

export function getGroupTitle(sessionTabs: Map<number, SessionTabSummary>, options: GroupOptions): string {
  const base = options.title || DEFAULT_SESSION_GROUP.title;
  const count = sessionTabs.size;
  return count > 0 ? `${base} · ${count}/${MAX_SESSION_TABS}` : base;
}

export async function configureSessionTabsState(
  sessionTabs: Map<number, SessionTabSummary>,
  tabs: chrome.tabs.Tab[],
  options: GroupOptions,
  toSessionTabSummary: (tab: chrome.tabs.Tab | null | undefined) => SessionTabSummary | null,
  setCurrentSessionTabId: (tabId: number | null) => void,
  setSessionTabGroupId: (groupId: number | null) => void,
  supportsTabGroups: boolean,
  ensureSessionTabGroup: (options?: GroupOptions) => Promise<void>,
) {
  sessionTabs.clear();
  setCurrentSessionTabId(null);
  setSessionTabGroupId(null);

  let nextActiveTabId: number | null = null;
  for (const candidate of tabs) {
    if (typeof candidate?.id !== 'number') continue;
    try {
      const tab = await chrome.tabs.get(candidate.id);
      const summary = toSessionTabSummary(tab);
      if (!summary) continue;
      sessionTabs.set(summary.id, summary);
      if (!nextActiveTabId) {
        nextActiveTabId = summary.id;
      }
    } catch {
      // Ignore stale IDs from sidepanel state; only keep live browser tabs.
    }
  }

  setCurrentSessionTabId(nextActiveTabId);

  if (tabs.length > 0 && supportsTabGroups) {
    await ensureSessionTabGroup({
      title: options.title || DEFAULT_SESSION_GROUP.title,
      color: options.color || DEFAULT_SESSION_GROUP.color,
    });
  }
}

export async function ensureSessionTabGroupState(
  sessionTabs: Map<number, SessionTabSummary>,
  supportsTabGroups: boolean,
  sessionTabGroupId: number | null,
  setSessionTabGroupId: (groupId: number | null) => void,
  options: GroupOptions = DEFAULT_SESSION_GROUP,
) {
  if (!supportsTabGroups) return;
  const sessionTabIds = Array.from(sessionTabs.keys());
  if (sessionTabIds.length === 0) return;

  const title = getGroupTitle(sessionTabs, options);
  const color = options.color || DEFAULT_SESSION_GROUP.color;

  try {
    if (sessionTabGroupId !== null) {
      await chrome.tabs.group({ groupId: sessionTabGroupId, tabIds: sessionTabIds });
      await chrome.tabGroups.update(sessionTabGroupId, {
        title,
        color,
        collapsed: false,
      });
    } else {
      const groupId = await chrome.tabs.group({ tabIds: sessionTabIds });
      await chrome.tabGroups.update(groupId, {
        title,
        color,
        collapsed: false,
      });
      setSessionTabGroupId(groupId);
    }
  } catch (error) {
    console.warn('Failed to group tabs:', error);
  }
}

export async function updateGroupTitleState(
  supportsTabGroups: boolean,
  sessionTabGroupId: number | null,
  sessionTabs: Map<number, SessionTabSummary>,
) {
  if (!supportsTabGroups || sessionTabGroupId === null) return;
  try {
    await chrome.tabGroups.update(sessionTabGroupId, {
      title: getGroupTitle(sessionTabs, DEFAULT_SESSION_GROUP),
    });
  } catch (err) {
    console.warn('[session-state] Failed to update group title:', err);
  }
}

export async function resolveSessionWindowIdState(
  currentSessionTabId: number | null,
  sessionTabs: Map<number, SessionTabSummary>,
): Promise<number | undefined> {
  const candidateTabIds: number[] = [];
  if (typeof currentSessionTabId === 'number') {
    candidateTabIds.push(currentSessionTabId);
  }
  for (const tabId of sessionTabs.keys()) {
    if (!candidateTabIds.includes(tabId)) {
      candidateTabIds.push(tabId);
    }
  }

  for (const tabId of candidateTabIds) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (typeof tab.windowId === 'number') {
        return tab.windowId;
      }
    } catch {
      // Ignore closed tabs and continue resolving from remaining session tabs.
    }
  }

  try {
    const activeTab = await getActiveTab();
    if (activeTab && typeof activeTab.windowId === 'number') {
      return activeTab.windowId;
    }
  } catch (err) {
    console.warn('[session-state] Failed to resolve active window:', err);
  }

  return undefined;
}

export async function groupTabsInternalState(supportsTabGroups: boolean, tabIds: number[], options: GroupOptions) {
  if (!supportsTabGroups || !tabIds.length) return;
  const groupId = await chrome.tabs.group({ tabIds });
  if (options.title || options.color) {
    await chrome.tabGroups.update(groupId, {
      title: options.title,
      color: options.color,
    });
  }
}

export async function captureActiveTabState(
  sessionTabs: Map<number, SessionTabSummary>,
  setCurrentSessionTabId: (tabId: number | null) => void,
) {
  try {
    const activeTab = await getActiveTab();
    if (!activeTab || typeof activeTab.id !== 'number') return null;
    // Skip restricted URLs that extensions cannot access
    const url = activeTab.url || activeTab.pendingUrl || '';
    if (/^(chrome|chrome-extension|devtools|edge|about):\/\//i.test(url)) {
      console.warn('[captureActiveTab] Skipped restricted URL:', url);
      return null;
    }
    if (!sessionTabs.has(activeTab.id)) {
      sessionTabs.set(activeTab.id, {
        id: activeTab.id,
        title: activeTab.title,
        url: activeTab.url,
        windowId: typeof activeTab.windowId === 'number' ? activeTab.windowId : undefined,
      });
    }
    setCurrentSessionTabId(activeTab.id);
    return activeTab.id;
  } catch (error) {
    console.warn('Failed to capture active tab:', error);
    return null;
  }
}
