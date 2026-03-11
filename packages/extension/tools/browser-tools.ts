import { runInAllFrames, runInTab, sendOverlay } from './browser-script-execution.js';
import {
  captureActiveTabState,
  configureSessionTabsState,
  ensureSessionTabGroupState,
  getGroupTitle,
  groupTabsInternalState,
  resolveSessionWindowIdState,
  updateGroupTitleState,
} from './browser-session-state.js';
import { type BrowserToolName, getBrowserToolDefinitions, getBrowserToolMap } from './browser-tool-definitions.js';
import { type ToolHandlerMap, createToolHandlers, executeTool } from './browser-tool-handlers.js';
import {
  type ActionOverlayPayload,
  type BrowserToolArgs,
  DEFAULT_SESSION_GROUP,
  type GroupOptions,
  MAX_SESSION_TABS,
  type SessionTabSummary,
} from './browser-tool-shared.js';

export class BrowserTools {
  tools: Partial<Record<BrowserToolName, true>>;
  toolHandlers: ToolHandlerMap;
  sessionTabs: Map<number, SessionTabSummary>;
  currentSessionTabId: number | null;
  sessionTabGroupId: number | null;
  supportsTabGroups: boolean;
  screenshotQuality: 'high' | 'medium' | 'low' | undefined;

  constructor() {
    this.sessionTabs = new Map();
    this.currentSessionTabId = null;
    this.sessionTabGroupId = null;
    this.supportsTabGroups =
      typeof globalThis.chrome?.tabs?.group === 'function' &&
      typeof globalThis.chrome?.tabGroups?.update === 'function';
    this.tools = getBrowserToolMap(this.supportsTabGroups);
    this.toolHandlers = createToolHandlers(this);
  }

  getToolDefinitions(): ReturnType<typeof getBrowserToolDefinitions> {
    return getBrowserToolDefinitions(this.supportsTabGroups);
  }

  getSessionTabSummaries(): SessionTabSummary[] {
    return Array.from(this.sessionTabs.values());
  }

  getCurrentSessionTabId(): number | null {
    return this.currentSessionTabId;
  }

  getSessionState() {
    return {
      tabs: this.getSessionTabSummaries(),
      activeTabId: this.currentSessionTabId,
      maxTabs: MAX_SESSION_TABS,
      groupTitle: this.getGroupTitle(DEFAULT_SESSION_GROUP),
    };
  }

  private toSessionTabSummary(tab: chrome.tabs.Tab | null | undefined): SessionTabSummary | null {
    if (!tab || typeof tab.id !== 'number') return null;
    return {
      id: tab.id,
      title: tab.title,
      url: tab.url,
      favIconUrl: tab.favIconUrl,
      windowId: typeof tab.windowId === 'number' ? tab.windowId : undefined,
    };
  }

  async configureSessionTabs(tabs: chrome.tabs.Tab[], options: GroupOptions = {}) {
    await configureSessionTabsState(
      this.sessionTabs,
      tabs,
      options,
      (tab) => this.toSessionTabSummary(tab),
      (tabId) => {
        this.currentSessionTabId = tabId;
      },
      (groupId) => {
        this.sessionTabGroupId = groupId;
      },
      this.supportsTabGroups,
      (groupOptions) => this.ensureSessionTabGroup(groupOptions),
    );
  }

  getGroupTitle(options: GroupOptions): string {
    return getGroupTitle(this.sessionTabs, options);
  }

  async ensureSessionTabGroup(options: GroupOptions = DEFAULT_SESSION_GROUP) {
    await ensureSessionTabGroupState(
      this.sessionTabs,
      this.supportsTabGroups,
      this.sessionTabGroupId,
      (groupId) => {
        this.sessionTabGroupId = groupId;
      },
      options,
    );
  }

  async updateGroupTitle() {
    await updateGroupTitleState(this.supportsTabGroups, this.sessionTabGroupId, this.sessionTabs);
  }

  async executeTool(toolName: string, args: BrowserToolArgs = {}) {
    return executeTool(this.toolHandlers, toolName, args);
  }

  async resolveTabId(args: BrowserToolArgs = {}) {
    if (typeof args.tabId === 'number') {
      return this.sessionTabs.has(args.tabId) ? args.tabId : null;
    }
    if (this.currentSessionTabId && this.sessionTabs.has(this.currentSessionTabId)) {
      return this.currentSessionTabId;
    }
    if (this.sessionTabs.size === 1) {
      const [onlyTabId] = this.sessionTabs.keys();
      return typeof onlyTabId === 'number' ? onlyTabId : null;
    }
    if (this.sessionTabs.size === 0) {
      await this.captureActiveTab();
      if (this.currentSessionTabId && this.sessionTabs.has(this.currentSessionTabId)) {
        return this.currentSessionTabId;
      }
    }
    return null;
  }

  async captureActiveTab() {
    return captureActiveTabState(this.sessionTabs, (tabId) => {
      this.currentSessionTabId = tabId;
    });
  }

  async runInTab<TArgs extends unknown[], TResult>(
    tabId: number,
    func: (...args: TArgs) => TResult | Promise<TResult>,
    args: TArgs,
  ) {
    return runInTab(tabId, func, args);
  }

  async runInAllFrames<TArgs extends unknown[], TResult>(
    tabId: number,
    func: (...args: TArgs) => TResult | Promise<TResult>,
    args: TArgs,
  ) {
    return runInAllFrames(tabId, func, args);
  }

  async sendOverlay(tabId: number, payload: ActionOverlayPayload, retries = 0) {
    return sendOverlay(tabId, payload, retries);
  }

  async resolveSessionWindowId(): Promise<number | undefined> {
    return resolveSessionWindowIdState(this.currentSessionTabId, this.sessionTabs);
  }

  async groupTabsInternal(tabIds: number[], options: GroupOptions) {
    await groupTabsInternalState(this.supportsTabGroups, tabIds, options);
  }
}
