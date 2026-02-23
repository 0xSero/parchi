import type { ToolDefinition } from '../../shared/src/tools.js';
import { getActiveTab } from '../utils/active-tab.js';

type SessionTabSummary = {
  id: number;
  title?: string;
  url?: string;
};

type GroupOptions = {
  title?: string;
  color?: chrome.tabGroups.ColorEnum;
};

type ActionOverlayPayload = {
  label: string;
  selector?: string;
  note?: string;
  status?: 'running' | 'done' | 'error';
  durationMs?: number;
  bringIntoView?: boolean;
};

// Maximum number of tabs allowed per session to prevent runaway tab creation
const MAX_SESSION_TABS = 5;

const DEFAULT_SESSION_GROUP: Required<GroupOptions> = {
  title: 'Parchi',
  color: 'blue',
};

export class BrowserTools {
  tools: Record<string, true>;
  private sessionTabs: Map<number, SessionTabSummary>;
  private currentSessionTabId: number | null;
  private sessionTabGroupId: number | null;
  private supportsTabGroups: boolean;

  constructor() {
    this.sessionTabs = new Map();
    this.currentSessionTabId = null;
    this.sessionTabGroupId = null;
    this.supportsTabGroups = typeof chrome.tabs.group === 'function' && typeof chrome.tabGroups?.update === 'function';
    this.tools = {
      navigate: true,
      openTab: true,
      click: true,
      clickAt: true,
      type: true,
      pressKey: true,
      scroll: true,
      getContent: true,
      findHtml: true,
      screenshot: true,
      getTabs: true,
      closeTab: true,
      switchTab: true,
      focusTab: true,
      groupTabs: true,
      describeSessionTabs: true,
    };
    if (!this.supportsTabGroups) {
      delete this.tools.groupTabs;
    }
  }

  getToolDefinitions(): ToolDefinition[] {
    const definitions: ToolDefinition[] = [
      {
        name: 'navigate',
        description: 'Navigate the current tab to a URL.',
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Absolute URL to visit.' },
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
          required: ['url'],
        },
      },
      {
        name: 'openTab',
        description: `Open a new tab with a URL. Limited to ${MAX_SESSION_TABS} tabs per session. Prefer navigating existing tabs or switching to current tabs first (use describeSessionTabs or getTabs).`,
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Absolute URL to open.' },
          },
          required: ['url'],
        },
      },
      {
        name: 'click',
        description:
          'Click an element by selector. Prefer a valid CSS selector (querySelector). Also supports simple text selectors like `text=Create note` and `button.contains("Create note")`.',
        input_schema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector to click.' },
            timeoutMs: { type: 'number', description: 'Optional wait timeout for element to appear (ms).' },
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
          required: ['selector'],
        },
      },
      {
        name: 'clickAt',
        description:
          'Click at exact viewport coordinates (x, y). Use this when you cannot identify an element by selector — for example after taking a screenshot and identifying a position visually. Coordinates are relative to the viewport top-left corner. Optionally double-click or right-click.',
        input_schema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X coordinate in viewport pixels (from left edge).' },
            y: { type: 'number', description: 'Y coordinate in viewport pixels (from top edge).' },
            button: {
              type: 'string',
              enum: ['left', 'right', 'middle'],
              description: 'Mouse button (default: left).',
            },
            doubleClick: { type: 'boolean', description: 'If true, perform a double-click.' },
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
          required: ['x', 'y'],
        },
      },
      {
        name: 'type',
        description:
          'Type text into an input/textarea/contenteditable. If selector points at a container (e.g. CodeMirror wrapper), it will try to find an editable descendant.',
        input_schema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS selector for the input.' },
            text: { type: 'string', description: 'Text to enter.' },
            timeoutMs: { type: 'number', description: 'Optional wait timeout for element to appear (ms).' },
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
          required: ['selector', 'text'],
        },
      },
      {
        name: 'pressKey',
        description: 'Press a key in the page.',
        input_schema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Keyboard key (e.g., Enter, ArrowDown).' },
            selector: { type: 'string', description: 'Optional selector to target.' },
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
          required: ['key'],
        },
      },
      {
        name: 'scroll',
        description: 'Scroll the page.',
        input_schema: {
          type: 'object',
          properties: {
            direction: { type: 'string', description: 'up, down, top, or bottom.' },
            amount: { type: 'number', description: 'Scroll amount in pixels.' },
            selector: { type: 'string', description: 'Optional selector for a scrollable container.' },
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
        },
      },
      {
        name: 'getContent',
        description: 'Extract page content.',
        input_schema: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'text, html, title, url, or links.' },
            selector: { type: 'string', description: 'Optional selector to scope content.' },
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
        },
      },
      {
        name: 'findHtml',
        description:
          'Check whether a provided HTML snippet exists in the current page DOM structure (full page by default). Useful for confirming exact markup presence.',
        input_schema: {
          type: 'object',
          properties: {
            htmlSnippet: { type: 'string', description: 'Exact HTML snippet to search for.' },
            selector: { type: 'string', description: 'Optional CSS selector to scope search.' },
            normalizeWhitespace: {
              type: 'boolean',
              description: 'Collapse whitespace in both snippet and page HTML before matching.',
            },
            maxMatches: {
              type: 'number',
              description: 'Maximum number of matches to return (default 8).',
            },
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
          required: ['htmlSnippet'],
        },
      },
      {
        name: 'screenshot',
        description: 'Capture a screenshot of the current tab.',
        input_schema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
        },
      },
      {
        name: 'getTabs',
        description: 'List tabs in the current window.',
        input_schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'closeTab',
        description: 'Close a tab by id.',
        input_schema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Tab id to close.' },
          },
          required: ['tabId'],
        },
      },
      {
        name: 'switchTab',
        description: 'Activate a tab by id.',
        input_schema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Tab id to activate.' },
          },
          required: ['tabId'],
        },
      },
      {
        name: 'focusTab',
        description: 'Focus a tab by id.',
        input_schema: {
          type: 'object',
          properties: {
            tabId: { type: 'number', description: 'Tab id to focus.' },
          },
          required: ['tabId'],
        },
      },
      {
        name: 'groupTabs',
        description: 'Group tabs together with an optional name and color.',
        input_schema: {
          type: 'object',
          properties: {
            tabIds: { type: 'array', items: { type: 'number' }, description: 'Tabs to group.' },
            title: { type: 'string', description: 'Group title.' },
            color: { type: 'string', description: 'Group color name.' },
          },
        },
      },
      {
        name: 'describeSessionTabs',
        description: 'List tabs captured for this session.',
        input_schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'watchVideo',
        description:
          'Watch and analyze a video on the current page. Captures multiple frames and describes what is happening. Requires a vision-capable profile to be configured.',
        input_schema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description:
                'Optional CSS selector for the video element. If not provided, uses the first video on page.',
            },
            durationSeconds: {
              type: 'number',
              description: 'How many seconds of video to analyze (default: 10, max: 60).',
            },
            frameIntervalSeconds: {
              type: 'number',
              description: 'Interval between captured frames in seconds (default: 2).',
            },
            question: {
              type: 'string',
              description: 'Optional specific question about the video content.',
            },
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
        },
      },
      {
        name: 'getVideoInfo',
        description:
          'Get information about video elements on the page (duration, current time, playing state, dimensions).',
        input_schema: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'Optional CSS selector for a specific video element.',
            },
            tabId: { type: 'number', description: 'Optional tab id.' },
          },
        },
      },
    ];

    return this.supportsTabGroups ? definitions : definitions.filter((tool) => tool.name !== 'groupTabs');
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

  async configureSessionTabs(tabs: chrome.tabs.Tab[], options: GroupOptions = {}) {
    this.sessionTabs.clear();
    this.currentSessionTabId = null;
    this.sessionTabGroupId = null;

    tabs.forEach((tab) => {
      if (typeof tab.id !== 'number') return;
      this.sessionTabs.set(tab.id, { id: tab.id, title: tab.title, url: tab.url });
      if (!this.currentSessionTabId) {
        this.currentSessionTabId = tab.id;
      }
    });

    if (tabs.length > 0 && this.supportsTabGroups) {
      await this.ensureSessionTabGroup({
        title: options.title || DEFAULT_SESSION_GROUP.title,
        color: options.color || DEFAULT_SESSION_GROUP.color,
      });
    }
  }

  private getGroupTitle(options: GroupOptions): string {
    const base = options.title || DEFAULT_SESSION_GROUP.title;
    const count = this.sessionTabs.size;
    return count > 0 ? `${base} · ${count}/${MAX_SESSION_TABS}` : base;
  }

  async ensureSessionTabGroup(options: GroupOptions = DEFAULT_SESSION_GROUP) {
    if (!this.supportsTabGroups) return;
    const sessionTabIds = Array.from(this.sessionTabs.keys());
    if (sessionTabIds.length === 0) return;

    const title = this.getGroupTitle(options);
    const color = options.color || DEFAULT_SESSION_GROUP.color;

    try {
      if (this.sessionTabGroupId !== null) {
        await chrome.tabs.group({ groupId: this.sessionTabGroupId, tabIds: sessionTabIds });
        await chrome.tabGroups.update(this.sessionTabGroupId, {
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
        this.sessionTabGroupId = groupId;
      }
    } catch (error) {
      console.warn('Failed to group tabs:', error);
    }
  }

  private async updateGroupTitle() {
    if (!this.supportsTabGroups || this.sessionTabGroupId === null) return;
    try {
      await chrome.tabGroups.update(this.sessionTabGroupId, {
        title: this.getGroupTitle(DEFAULT_SESSION_GROUP),
      });
    } catch {}
  }

  async executeTool(toolName: string, args: Record<string, any> = {}) {
    try {
      switch (toolName) {
        case 'navigate':
          return await this.navigate(args);
        case 'openTab':
          return await this.openTab(args);
        case 'click':
          return await this.click(args);
        case 'clickAt':
          return await this.clickAt(args);
        case 'type':
          return await this.type(args);
        case 'pressKey':
          return await this.pressKey(args);
        case 'scroll':
          return await this.scroll(args);
        case 'getContent':
          return await this.getContent(args);
        case 'findHtml':
          return await this.findHtml(args);
        case 'screenshot':
          return await this.screenshot(args);
        case 'getTabs':
          return await this.getTabs();
        case 'closeTab':
          return await this.closeTab(args);
        case 'switchTab':
          return await this.focusTab(args);
        case 'focusTab':
          return await this.focusTab(args);
        case 'groupTabs':
          return await this.groupTabs(args);
        case 'describeSessionTabs':
          if (this.sessionTabs.size === 0) {
            await this.captureActiveTab();
          }
          return {
            success: true,
            tabs: this.getSessionTabSummaries(),
            activeTabId: this.currentSessionTabId,
            tabCount: this.sessionTabs.size,
            maxTabs: MAX_SESSION_TABS,
            canOpenMore: this.sessionTabs.size < MAX_SESSION_TABS,
            groupId: this.sessionTabGroupId,
            groupTitle: this.getGroupTitle(DEFAULT_SESSION_GROUP),
          };
        case 'watchVideo':
          return await this.watchVideo(args);
        case 'getVideoInfo':
          return await this.getVideoInfo(args);
        default:
          return { success: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      // Catch any unhandled errors in tool execution
      console.error(`Tool execution error (${toolName}):`, error);
      return {
        success: false,
        error: `Tool "${toolName}" failed: ${error?.message || String(error)}`,
        hint: 'Try a different approach or check the arguments.',
      };
    }
  }

  private async resolveTabId(args: Record<string, any> = {}) {
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

  private async captureActiveTab() {
    try {
      const activeTab = await getActiveTab();
      const pickTab = async () => {
        if (activeTab && typeof activeTab.id === 'number' && !this.getScriptInjectionBlockReason(activeTab.url)) {
          return activeTab;
        }
        const windowTabs = await chrome.tabs.query({ currentWindow: true });
        return (
          windowTabs.find(
            (tab) => typeof tab.id === 'number' && !this.getScriptInjectionBlockReason(tab.url) && tab.active,
          ) ||
          windowTabs.find((tab) => typeof tab.id === 'number' && !this.getScriptInjectionBlockReason(tab.url)) ||
          null
        );
      };
      const target = await pickTab();
      if (!target || typeof target.id !== 'number') return null;
      if (!this.sessionTabs.has(target.id)) {
        this.sessionTabs.set(target.id, { id: target.id, title: target.title, url: target.url });
      }
      this.currentSessionTabId = target.id;
      return target.id;
    } catch (error) {
      console.warn('Failed to capture active tab:', error);
      return null;
    }
  }

  private async runInTab(tabId: number, func: (...args: any[]) => unknown, args: any[] = []): Promise<any> {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    const blockedReason = this.getScriptInjectionBlockReason(tab?.url);
    if (blockedReason) {
      return {
        success: false,
        error: 'Cannot run scripts on this page.',
        details: blockedReason,
        url: tab?.url || '',
      };
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func,
        args,
      });
      return results?.[0]?.result ?? null;
    } catch (error: any) {
      // Return a structured error so the UI can surface the real cause (e.g. restricted URL).
      return {
        success: false,
        error: 'executeScript failed.',
        details: error?.message || String(error),
      };
    }
  }

  private async runInAllFrames(tabId: number, func: (...args: any[]) => unknown, args: any[] = []): Promise<any> {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    const blockedReason = this.getScriptInjectionBlockReason(tab?.url);
    if (blockedReason) {
      return {
        success: false,
        error: 'Cannot run scripts on this page.',
        details: blockedReason,
        url: tab?.url || '',
      };
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func,
        args,
      });
      const success = results.find((entry) => (entry?.result as any)?.success);
      if (success?.result) return success.result;
      const first = results.find((entry) => entry?.result);
      return first?.result ?? null;
    } catch (error: any) {
      return {
        success: false,
        error: 'executeScript failed (allFrames).',
        details: error?.message || String(error),
      };
    }
  }

  private getScriptInjectionBlockReason(url?: string | null) {
    const current = String(url || '').trim();
    if (!current) return '';
    const lower = current.toLowerCase();
    if (lower.startsWith('about:')) {
      return 'Firefox about:* pages are restricted; script injection is not allowed.';
    }
    if (lower.startsWith('moz-extension:')) {
      return 'Extension pages are restricted targets for content script injection.';
    }
    if (lower.startsWith('chrome:') || lower.startsWith('edge:') || lower.startsWith('brave:')) {
      return 'Browser internal pages are restricted; script injection is not allowed.';
    }
    if (lower.startsWith('view-source:')) {
      return 'view-source pages are restricted; open the original page URL instead.';
    }
    return '';
  }

  private async sendOverlay(tabId: number, payload: ActionOverlayPayload, retries = 0) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'action_overlay', ...payload });
    } catch (error) {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        return this.sendOverlay(tabId, payload, retries - 1);
      }
    }
  }

  private async navigate(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) {
      return {
        success: false,
        error:
          'No session tab available. Pass tabId from describeSessionTabs(), or select a tab in the UI before running.',
      };
    }

    const url = args.url;
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'Missing or invalid url parameter.' };
    }

    // Validate URL format
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('chrome://')) {
      return {
        success: false,
        error: `Invalid URL: "${url}". URLs must start with http://, https://, or chrome://`,
        hint: 'For Google searches, use: https://www.google.com/search?q=your+query',
      };
    }

    try {
      await this.sendOverlay(tabId, {
        label: 'Navigate',
        note: url.replace(/^https?:\/\//, ''),
        durationMs: 1800,
      });
      await chrome.tabs.update(tabId, { url });
      this.currentSessionTabId = tabId;
      // Update stored metadata so session tab summaries reflect the new URL
      const existing = this.sessionTabs.get(tabId);
      if (existing) {
        existing.url = url;
      }
      return { success: true, tabId, url };
    } catch (error) {
      return {
        success: false,
        error: `Navigation failed: ${error?.message || String(error)}`,
      };
    }
  }

  private async openTab(args: Record<string, any>) {
    // Enforce tab limit to prevent runaway tab creation
    if (this.sessionTabs.size >= MAX_SESSION_TABS) {
      return {
        success: false,
        error: `Tab limit reached (max ${MAX_SESSION_TABS} tabs per session). Close existing tabs with closeTab or use navigate on current tab.`,
        hint: 'Use closeTab({ tabId: <id> }) to close a tab, or navigate({ url: "..." }) to reuse current tab.',
      };
    }

    // Validate URL
    const url = args.url;
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'Missing or invalid url parameter.' };
    }

    // Check if it looks like a valid URL
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('chrome://')) {
      return {
        success: false,
        error: `Invalid URL: "${url}". URLs must start with http://, https://, or chrome://`,
        hint: 'Use navigate({ url: "https://google.com/search?q=..." }) for searches.',
      };
    }

    try {
      const tab = await chrome.tabs.create({ url, active: true });
      if (typeof tab.id === 'number') {
        this.sessionTabs.set(tab.id, { id: tab.id, title: tab.title, url: tab.url });
        this.currentSessionTabId = tab.id;

        if (this.supportsTabGroups && this.sessionTabGroupId !== null) {
          try {
            await chrome.tabs.group({ groupId: this.sessionTabGroupId, tabIds: [tab.id] });
            await this.updateGroupTitle();
          } catch (error) {
            console.warn('Failed to add tab to session group:', error);
          }
        }
        void this.sendOverlay(tab.id, { label: 'Opened tab', note: url.replace(/^https?:\/\//, '') }, 2);
      }
      return { success: true, tabId: tab.id, url };
    } catch (error) {
      return {
        success: false,
        error: `Failed to open tab: ${error?.message || String(error)}`,
        hint: 'Try using navigate() on current tab instead.',
      };
    }
  }

  private async focusTab(args: Record<string, any>) {
    const tabId = typeof args.tabId === 'number' ? args.tabId : null;
    if (!tabId) return { success: false, error: 'Missing tabId.' };
    await chrome.tabs.update(tabId, { active: true });
    this.currentSessionTabId = tabId;
    await this.sendOverlay(tabId, { label: 'Focused tab', durationMs: 1200 }, 1);
    return { success: true, tabId };
  }

  private async closeTab(args: Record<string, any>) {
    const tabId = typeof args.tabId === 'number' ? args.tabId : null;
    if (!tabId) return { success: false, error: 'Missing tabId.' };
    await chrome.tabs.remove(tabId);
    this.sessionTabs.delete(tabId);
    if (this.currentSessionTabId === tabId) {
      this.currentSessionTabId = null;
    }
    await this.updateGroupTitle();
    return { success: true, tabId };
  }

  private async click(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) {
      return {
        success: false,
        error:
          'No session tab available. Pass tabId from describeSessionTabs(), or select a tab in the UI before running.',
      };
    }
    const selector = String(args.selector || '');
    if (!selector) {
      return { success: false, error: 'Missing selector.' };
    }
    const timeoutMs =
      typeof args.timeoutMs === 'number' && Number.isFinite(args.timeoutMs) ? Math.max(0, args.timeoutMs) : 5000;
    await this.sendOverlay(tabId, {
      label: 'Click',
      selector,
      bringIntoView: true,
      durationMs: 2000,
    });
    const clickScript = async (sel: string, waitMs: number) => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const isVisible = (el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (Number.parseFloat(style.opacity || '1') === 0) return false;
        return true;
      };

      const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

      const parseTextSelector = (raw: string) => {
        const trimmed = String(raw || '').trim();
        const m = /^text\s*=\s*(.+)$/i.exec(trimmed);
        if (!m) return null;
        let text = m[1].trim();
        if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
          text = text.slice(1, -1);
        }
        return text.trim();
      };

      const parseContainsSelector = (raw: string): { base: string; text: string } | null => {
        // Supports:
        // - button.contains("Create note")
        // - button:contains("Create note") (jQuery-style)
        // - button:has-text("Create note") (Playwright-style)
        const trimmed = String(raw || '').trim();
        const dotQuoted = /^([a-zA-Z][\\w-]*)\\s*\\.\\s*contains\\s*\\(\\s*(['"])([\\s\\S]*?)\\2\\s*\\)\\s*$/.exec(
          trimmed,
        );
        if (dotQuoted) return { base: dotQuoted[1], text: dotQuoted[3].trim() };
        const dotBare = /^([a-zA-Z][\\w-]*)\\s*\\.\\s*contains\\s*\\(\\s*([\\s\\S]*?)\\s*\\)\\s*$/.exec(trimmed);
        if (dotBare) return { base: dotBare[1], text: String(dotBare[2] || '').trim() };

        const pseudoContainsQuoted = /^(.+?):\\s*contains\\s*\\(\\s*(['"])([\\s\\S]*?)\\2\\s*\\)\\s*$/.exec(trimmed);
        if (pseudoContainsQuoted) return { base: pseudoContainsQuoted[1].trim(), text: pseudoContainsQuoted[3].trim() };
        const pseudoContainsBare = /^(.+?):\\s*contains\\s*\\(\\s*([\\s\\S]*?)\\s*\\)\\s*$/.exec(trimmed);
        if (pseudoContainsBare)
          return { base: pseudoContainsBare[1].trim(), text: String(pseudoContainsBare[2] || '').trim() };

        const pseudoHasTextQuoted = /^(.+?):\\s*has-text\\s*\\(\\s*(['"])([\\s\\S]*?)\\2\\s*\\)\\s*$/.exec(trimmed);
        if (pseudoHasTextQuoted) return { base: pseudoHasTextQuoted[1].trim(), text: pseudoHasTextQuoted[3].trim() };
        const pseudoHasTextBare = /^(.+?):\\s*has-text\\s*\\(\\s*([\\s\\S]*?)\\s*\\)\\s*$/.exec(trimmed);
        if (pseudoHasTextBare)
          return { base: pseudoHasTextBare[1].trim(), text: String(pseudoHasTextBare[2] || '').trim() };
        return null;
      };

      const deepQuerySelectorAll = (css: string, maxNodes = 25000): HTMLElement[] => {
        const out: HTMLElement[] = [];
        let parsedOk = true;
        try {
          // Validate selector early; matches() will throw too, but this gives a consistent error path.
          document.querySelector(css);
        } catch {
          parsedOk = false;
        }
        if (!parsedOk) return out;

        const stack: Array<Document | ShadowRoot | Element> = [document];
        let visited = 0;
        while (stack.length && visited < maxNodes) {
          const node = stack.pop()!;
          if (node instanceof Element) {
            visited += 1;
            try {
              if ((node as Element).matches(css)) out.push(node as HTMLElement);
            } catch {
              // Selector parse issues should have been caught above.
            }
            const sr = (node as any).shadowRoot as ShadowRoot | null | undefined;
            if (sr) stack.push(sr);
            for (const child of Array.from(node.children)) stack.push(child);
          } else {
            const children = node instanceof Document ? [node.documentElement] : Array.from(node.children);
            for (const child of children) if (child) stack.push(child);
          }
        }
        return out;
      };

      const findByText = (text: string, baseSelector = ''): { el: HTMLElement | null; candidates: number } => {
        const wanted = normalizeText(text);
        if (!wanted) return { el: null, candidates: 0 };
        const preferred = baseSelector
          ? (() => {
              try {
                return Array.from(document.querySelectorAll<HTMLElement>(baseSelector));
              } catch {
                return deepQuerySelectorAll(baseSelector);
              }
            })()
          : Array.from(document.querySelectorAll<HTMLElement>('a, button, input, [role="button"], [role="link"]'));

        const pool = preferred.length > 0 ? preferred : Array.from(document.querySelectorAll<HTMLElement>('body *'));
        let best: HTMLElement | null = null;
        let bestScore = -1;
        let seen = 0;
        for (const el of pool) {
          if (!(el instanceof HTMLElement)) continue;
          if (!isVisible(el)) continue;
          const txt = normalizeText(el.innerText || el.textContent || '');
          if (!txt) continue;
          if (!txt.includes(wanted)) continue;
          seen += 1;
          // Prefer common interactive elements.
          const tag = el.tagName.toLowerCase();
          let score = 1;
          if (tag === 'button') score += 4;
          if (tag === 'a') score += 3;
          if (tag === 'input') score += 2;
          if (el.getAttribute('role') === 'button') score += 2;
          if (score > bestScore) {
            best = el;
            bestScore = score;
          }
        }
        return { el: best, candidates: seen };
      };

      const resolveElement = (rawSelector: string) => {
        const trimmed = String(rawSelector || '').trim();
        if (!trimmed)
          return { el: null as HTMLElement | null, strategy: 'none', candidates: 0, error: 'Missing selector.' };

        // Prefixes:
        // - css=... (explicit CSS)
        // - xpath=... (XPath expression)
        const lower = trimmed.toLowerCase();
        if (lower.startsWith('css=')) {
          return resolveElement(trimmed.slice(4));
        }
        if (lower.startsWith('xpath=')) {
          const expr = trimmed.slice(6).trim();
          if (!expr) return { el: null, strategy: 'xpath', candidates: 0, error: 'Missing XPath.' };
          try {
            const res = document.evaluate(expr, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            const node = res.singleNodeValue as HTMLElement | null;
            if (node && node instanceof HTMLElement) return { el: node, strategy: 'xpath', candidates: 1 };
            return { el: null, strategy: 'xpath', candidates: 0, error: 'Element not found.' };
          } catch (error: any) {
            return {
              el: null,
              strategy: 'xpath',
              candidates: 0,
              error: 'Invalid selector.',
              hint: `XPath failed: ${error?.message || String(error)}`,
            };
          }
        }

        const textSel = parseTextSelector(trimmed);
        if (textSel) {
          const { el, candidates } = findByText(textSel);
          return el
            ? { el, strategy: 'text', candidates }
            : { el: null, strategy: 'text', candidates, error: 'Element not found.' };
        }

        // First try native CSS selector.
        try {
          const matches = Array.from(document.querySelectorAll<HTMLElement>(trimmed));
          const visible = matches.filter(isVisible);
          const el = visible[0] || matches[0] || null;
          if (el) return { el, strategy: 'css', candidates: matches.length };
        } catch (error: any) {
          // Fall through to "contains" parsing and provide a better hint if that fails too.
          const containsSel = parseContainsSelector(trimmed);
          if (!containsSel) {
            return {
              el: null,
              strategy: 'css',
              candidates: 0,
              error: 'Invalid selector.',
              hint: `querySelector failed: ${error?.message || String(error)}`,
            };
          }
        }

        // If CSS yielded nothing (or was invalid but looked like contains), try contains-based matching.
        const containsSel = parseContainsSelector(trimmed);
        if (containsSel) {
          const { el, candidates } = findByText(containsSel.text, containsSel.base);
          return el
            ? { el, strategy: 'contains/text', candidates }
            : { el: null, strategy: 'contains', candidates, error: 'Element not found.' };
        }

        // Finally, try a deep selector match for open shadow roots if the normal query returned nothing.
        const deep = deepQuerySelectorAll(trimmed);
        const deepVisible = deep.filter(isVisible);
        const el = deepVisible[0] || deep[0] || null;
        if (el) return { el, strategy: 'css(deep)', candidates: deep.length };

        return { el: null, strategy: 'css', candidates: 0, error: 'Element not found.' };
      };

      const clickElement = (el: HTMLElement) => {
        try {
          el.scrollIntoView({ block: 'center', inline: 'center' } as any);
        } catch {}
        el.focus?.();

        const rect = el.getBoundingClientRect();
        const cx = Math.max(1, Math.min(window.innerWidth - 2, rect.left + rect.width / 2));
        const cy = Math.max(1, Math.min(window.innerHeight - 2, rect.top + rect.height / 2));
        const top = document.elementFromPoint(cx, cy) as HTMLElement | null;
        const target = top && (top === el || el.contains(top)) ? top : el;

        const fireMouse = (type: string) => {
          target.dispatchEvent(
            new MouseEvent(type, {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: cx,
              clientY: cy,
              button: 0,
            }),
          );
        };

        const firePointer = (type: string) => {
          try {
            (target as any).dispatchEvent(
              new PointerEvent(type, {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: cx,
                clientY: cy,
                button: 0,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true,
              }),
            );
          } catch {}
        };

        firePointer('pointerover');
        fireMouse('mouseover');
        firePointer('pointerdown');
        fireMouse('mousedown');
        firePointer('pointerup');
        fireMouse('mouseup');
        fireMouse('click');
        (target as any).click?.();
        return { success: true };
      };

      const start = performance.now();
      const deadline = start + Math.max(0, waitMs || 0);
      while (performance.now() <= deadline) {
        const resolved = resolveElement(sel);
        if (resolved.el) {
          const result = clickElement(resolved.el);
          return { ...result, strategy: resolved.strategy, candidates: resolved.candidates };
        }
        await sleep(120);
      }

      // One last attempt after timeout to return the best error/hint.
      const resolved = resolveElement(sel);
      if (resolved.el) {
        const result = clickElement(resolved.el);
        return { ...result, strategy: resolved.strategy, candidates: resolved.candidates };
      }

      return {
        success: false,
        error: resolved.error || 'Element not found.',
        hint:
          resolved.hint ||
          (sel.trim().toLowerCase().includes('contains') || sel.trim().toLowerCase().includes('has-text')
            ? 'Use a CSS selector, `text=...`, `tag.contains("...")`, or `button:has-text("...")`.'
            : 'Try a more specific selector or increase timeoutMs.'),
      };
    };
    let result = await this.runInTab(tabId, clickScript, [selector, timeoutMs]);
    if (result?.error === 'Element not found.') {
      result = await this.runInAllFrames(tabId, clickScript, [selector, timeoutMs]);
    }
    return result || { success: false, error: 'Script execution failed.' };
  }

  private async clickAt(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) {
      return {
        success: false,
        error:
          'No session tab available. Pass tabId from describeSessionTabs(), or select a tab in the UI before running.',
      };
    }

    const x = typeof args.x === 'number' ? args.x : NaN;
    const y = typeof args.y === 'number' ? args.y : NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return { success: false, error: 'Missing or invalid x/y coordinates.' };
    }

    const button = ['left', 'right', 'middle'].includes(args.button) ? args.button : 'left';
    const doubleClick = args.doubleClick === true;

    await this.sendOverlay(tabId, {
      label: doubleClick ? 'Double-click' : 'Click',
      note: `(${Math.round(x)}, ${Math.round(y)})`,
      durationMs: 1500,
    });

    const clickAtScript = (cx: number, cy: number, btn: string, dblClick: boolean) => {
      const buttonCode = btn === 'right' ? 2 : btn === 'middle' ? 1 : 0;
      const el = document.elementFromPoint(cx, cy) as HTMLElement | null;

      const tag = el ? el.tagName.toLowerCase() : null;
      const id = el?.id || null;
      const text = el?.textContent?.trim().slice(0, 80) || null;

      const firePointer = (type: string, target: EventTarget) => {
        try {
          target.dispatchEvent(
            new PointerEvent(type, {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: cx,
              clientY: cy,
              button: buttonCode,
              pointerId: 1,
              pointerType: 'mouse',
              isPrimary: true,
            }),
          );
        } catch {}
      };

      const fireMouse = (type: string, target: EventTarget) => {
        target.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: cx,
            clientY: cy,
            button: buttonCode,
          }),
        );
      };

      const target: EventTarget = el || document.documentElement;

      // Focus the element if possible
      if (el && typeof el.focus === 'function') {
        el.focus();
      }

      // Full pointer + mouse event sequence
      firePointer('pointerover', target);
      fireMouse('mouseover', target);
      firePointer('pointerdown', target);
      fireMouse('mousedown', target);
      firePointer('pointerup', target);
      fireMouse('mouseup', target);
      fireMouse('click', target);

      if (dblClick) {
        firePointer('pointerdown', target);
        fireMouse('mousedown', target);
        firePointer('pointerup', target);
        fireMouse('mouseup', target);
        fireMouse('click', target);
        fireMouse('dblclick', target);
      }

      if (btn === 'right') {
        fireMouse('contextmenu', target);
      }

      // Also call native .click() for maximum compatibility
      if (el && typeof (el as any).click === 'function' && btn === 'left') {
        (el as any).click();
      }

      return {
        success: true,
        x: cx,
        y: cy,
        button: btn,
        doubleClick: dblClick,
        elementHit: el
          ? {
              tag,
              id,
              className: el.className ? String(el.className).slice(0, 120) : null,
              text: text ? (text.length > 80 ? text.slice(0, 77) + '…' : text) : null,
            }
          : null,
      };
    };

    const result = await this.runInTab(tabId, clickAtScript, [x, y, button, doubleClick]);
    return result || { success: false, error: 'Script execution failed.' };
  }

  private async type(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) {
      return {
        success: false,
        error:
          'No session tab available. Pass tabId from describeSessionTabs(), or select a tab in the UI before running.',
      };
    }
    const selector = String(args.selector || '');
    const text = String(args.text ?? '');
    const timeoutMs =
      typeof args.timeoutMs === 'number' && Number.isFinite(args.timeoutMs) ? Math.max(0, args.timeoutMs) : 5000;
    const preview = text.length > 28 ? `${text.slice(0, 28)}…` : text;
    await this.sendOverlay(tabId, {
      label: 'Type',
      selector,
      note: preview ? `"${preview}"` : undefined,
      bringIntoView: true,
      durationMs: 2200,
    });
    const typeScript = async (sel: string, value: string, waitMs: number) => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const isVisible = (el: HTMLElement) => {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        return true;
      };

      const safeQuery = (selector: string) => {
        try {
          return document.querySelector<HTMLElement>(selector);
        } catch (error: any) {
          return { __error: `Invalid selector: ${error?.message || String(error)}` } as any;
        }
      };

      const safeQueryAll = (selector: string) => {
        try {
          return Array.from(document.querySelectorAll<HTMLElement>(selector));
        } catch {
          return [] as HTMLElement[];
        }
      };

      const resolveEditable = (candidate: HTMLElement | null) => {
        if (!candidate) return null;
        if (
          candidate instanceof HTMLInputElement ||
          candidate instanceof HTMLTextAreaElement ||
          (candidate as HTMLElement).isContentEditable
        ) {
          return candidate;
        }
        // Common pattern: selector points at a wrapper (e.g. CodeMirror/Monaco); find an editable descendant.
        const descendant =
          candidate.querySelector<HTMLElement>(
            'textarea, input, [contenteditable="true"], [contenteditable=""], [role="textbox"]',
          ) || null;
        if (descendant) return descendant;
        return null;
      };

      let el: HTMLElement | null = null;
      const start = performance.now();
      const deadline = start + Math.max(0, waitMs || 0);
      while (performance.now() <= deadline) {
        if (sel) {
          const q = safeQuery(sel);
          if ((q as any)?.__error) {
            return { success: false, error: (q as any).__error };
          }
          el = resolveEditable(q as HTMLElement | null);
        }
        if (!el) {
          const active = document.activeElement as HTMLElement | null;
          if (
            active &&
            (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active.isContentEditable)
          ) {
            el = active;
          }
        }
        if (!el) {
          const candidates = safeQueryAll(
            'input, textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]',
          );
          const fallback = candidates.find(isVisible) || candidates[0] || null;
          if (fallback) el = fallback;
        }
        if (el) break;
        await sleep(120);
      }

      if (!el) {
        return {
          success: false,
          error: 'Element not found.',
          hint: 'Try a more specific selector or increase timeoutMs.',
        };
      }

      const dispatchInputEvents = (target: HTMLElement) => {
        try {
          target.dispatchEvent(
            new InputEvent('input', {
              bubbles: true,
              inputType: 'insertText',
              data: value,
            }),
          );
        } catch {
          target.dispatchEvent(new Event('input', { bubbles: true }));
        }
        target.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const setNativeValue = (target: HTMLInputElement | HTMLTextAreaElement, nextValue: string) => {
        const proto = Object.getPrototypeOf(target);
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
        if (descriptor?.set) {
          descriptor.set.call(target, nextValue);
        } else {
          target.value = nextValue;
        }
      };

      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        const inputType = el instanceof HTMLInputElement ? el.type : 'text';
        if (inputType === 'checkbox' || inputType === 'radio') {
          return { success: false, error: 'Element is a checkbox/radio. Use click instead.' };
        }
        try {
          el.scrollIntoView({ block: 'center', inline: 'center' } as any);
        } catch {}
        el.focus();
        if (typeof el.select === 'function') {
          el.select();
        }
        setNativeValue(el, value);
        dispatchInputEvents(el);
        return { success: true };
      }

      if ((el as HTMLElement).isContentEditable) {
        try {
          el.scrollIntoView({ block: 'center', inline: 'center' } as any);
        } catch {}
        el.focus();
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          const range = document.createRange();
          range.selectNodeContents(el);
          selection.addRange(range);
        }
        document.execCommand?.('insertText', false, value);
        if (el.textContent !== value) {
          el.textContent = value;
        }
        dispatchInputEvents(el);
        return { success: true };
      }

      return {
        success: false,
        error: 'Target is not an input or editable element.',
        hint: 'Use a selector that targets an <input>, <textarea>, or [contenteditable] node (or click to focus it first).',
      };
    };
    let result = await this.runInTab(tabId, typeScript, [selector, text, timeoutMs]);
    if (result?.error === 'Element not found.') {
      result = await this.runInAllFrames(tabId, typeScript, [selector, text, timeoutMs]);
    }
    return result || { success: false, error: 'Script execution failed.' };
  }

  private async pressKey(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) {
      return {
        success: false,
        error:
          'No session tab available. Pass tabId from describeSessionTabs(), or select a tab in the UI before running.',
      };
    }
    const key = String(args.key || '');
    const selector = args.selector ? String(args.selector) : '';
    await this.sendOverlay(tabId, {
      label: 'Press key',
      selector: selector || undefined,
      note: key,
      bringIntoView: Boolean(selector),
      durationMs: 1500,
    });
    const result = await this.runInTab(
      tabId,
      (k, sel) => {
        const target = sel ? document.querySelector<HTMLElement>(sel) : document.body;
        if (!target) return { success: false, error: 'Target not found.' };
        target.focus?.();
        target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
        target.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }));
        return { success: true };
      },
      [key, selector],
    );
    return result || { success: false, error: 'Script execution failed.' };
  }

  private async scroll(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) {
      return {
        success: false,
        error:
          'No session tab available. Pass tabId from describeSessionTabs(), or select a tab in the UI before running.',
      };
    }
    const direction = String(args.direction || 'down');
    const amount = typeof args.amount === 'number' ? args.amount : 600;
    const selector = args.selector ? String(args.selector) : '';
    await this.sendOverlay(tabId, {
      label: 'Scroll',
      note: direction === 'down' || direction === 'up' ? `${direction} ${amount}px` : direction,
      durationMs: 1200,
    });
    const result = await this.runInTab(
      tabId,
      (dir, amt, sel) => {
        const resolveScroller = () => {
          if (sel) {
            const el = document.querySelector(sel);
            if (el && (el as HTMLElement).scrollHeight - (el as HTMLElement).clientHeight > 24) {
              return el as HTMLElement;
            }
          }

          const root = (document.scrollingElement || document.documentElement) as HTMLElement | null;
          if (root && root.scrollHeight - root.clientHeight > 24) return root;

          // Fall back: find a likely scroll container (many apps don't scroll the window).
          const nodes = Array.from(
            document.querySelectorAll<HTMLElement>(
              'main, [role="main"], [data-scroll], .scroll, .scroller, .scroll-container, .cm-scroller, .CodeMirror-scroll',
            ),
          );
          const extras = Array.from(document.querySelectorAll<HTMLElement>('body *')).slice(0, 1200);
          const candidates = nodes.length ? nodes.concat(extras) : extras;

          let best: HTMLElement | null = null;
          let bestScore = 0;
          for (const el of candidates) {
            if (!el || el === document.body) continue;
            const ch = el.clientHeight || 0;
            if (ch < 80) continue;
            const overflow = getComputedStyle(el).overflowY;
            if (!(overflow === 'auto' || overflow === 'scroll')) continue;
            const delta = (el.scrollHeight || 0) - ch;
            if (delta < 40) continue;
            const score = delta + ch * 0.25;
            if (score > bestScore) {
              bestScore = score;
              best = el;
            }
          }

          return best || root || (document.documentElement as HTMLElement);
        };

        const scroller = resolveScroller();
        const before = scroller.scrollTop;
        const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);

        const normalized = String(dir || 'down').toLowerCase();
        if (normalized === 'top') {
          scroller.scrollTop = 0;
        } else if (normalized === 'bottom') {
          scroller.scrollTop = maxTop;
        } else if (normalized === 'up') {
          scroller.scrollTop = Math.max(0, before - amt);
        } else {
          scroller.scrollTop = Math.min(maxTop, before + amt);
        }

        const after = scroller.scrollTop;
        return {
          success: true,
          scroller: {
            tag: scroller.tagName,
            id: scroller.id || null,
            className: scroller.className || null,
          },
          before,
          after,
          moved: after !== before,
        };
      },
      [direction, amount, selector],
    );
    return result || { success: false, error: 'Script execution failed.' };
  }

  private async getContent(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) {
      return {
        success: false,
        error:
          'No session tab available. Pass tabId from describeSessionTabs(), or select a tab in the UI before running.',
      };
    }
    const type = String(args.type || args.mode || 'text');
    const selector = args.selector ? String(args.selector) : '';
    const maxChars = typeof args.maxChars === 'number' && args.maxChars > 0 ? args.maxChars : 8000;
    await this.sendOverlay(tabId, {
      label: 'Read page',
      note: selector ? `from ${selector}` : type,
      durationMs: 1200,
    });
    const result = await this.runInTab(
      tabId,
      (t, sel, limit) => {
        const base = sel ? document.querySelector<HTMLElement>(sel) : document.body;
        if (!base) return { success: false, error: 'Target not found.' };
        const normalizedType = ['text', 'html', 'title', 'url', 'links'].includes(t) ? t : 'text';
        const truncate = (value: string) => {
          const length = value.length;
          if (length <= limit) {
            return { content: value, truncated: false, contentLength: length };
          }
          return { content: value.slice(0, limit), truncated: true, contentLength: length };
        };
        if (normalizedType === 'html') {
          const result = truncate(base.innerHTML);
          return { success: true, ...result };
        }
        if (normalizedType === 'title') {
          const result = truncate(document.title || '');
          return { success: true, ...result };
        }
        if (normalizedType === 'url') {
          const result = truncate(window.location.href || '');
          return { success: true, ...result };
        }
        if (normalizedType === 'links') {
          const links = Array.from(base.querySelectorAll('a'))
            .slice(0, 200)
            .map((link) => ({
              text: link.textContent || '',
              href: link.href,
            }));
          const result = truncate(JSON.stringify(links));
          return { success: true, items: links.length, ...result };
        }
        const result = truncate(base.innerText || '');
        return { success: true, ...result };
      },
      [type, selector, maxChars],
    );
    return result || { success: false, error: 'Script execution failed.' };
  }

  private async findHtml(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) {
      return {
        success: false,
        error:
          'No session tab available. Pass tabId from describeSessionTabs(), or select a tab in the UI before running.',
      };
    }

    const htmlSnippet = String(args.htmlSnippet || args.snippet || '').trim();
    if (!htmlSnippet) {
      return {
        success: false,
        error: 'Missing htmlSnippet parameter.',
      };
    }

    const selector = args.selector ? String(args.selector) : '';
    const normalizeWhitespace = args.normalizeWhitespace === true;
    const maxMatches = Math.max(1, Math.min(20, Math.floor(Number(args.maxMatches) || 8)));
    await this.sendOverlay(tabId, {
      label: 'Find HTML snippet',
      note: selector ? `within ${selector}` : 'in document markup',
      durationMs: 700,
    });

    const result = await this.runInTab(
      tabId,
      (scopeSelector, needle, normalizeWs, matchLimit) => {
        const normalize = (value: string) => {
          if (!normalizeWs) return value;
          return value.replace(/\s+/g, ' ').trim();
        };

        let scope: HTMLElement | null = null;
        try {
          if (scopeSelector) {
            scope = document.querySelector(scopeSelector);
          }
        } catch {
          scope = null;
        }
        const sourceNode = scope || document.documentElement;
        if (!sourceNode) return { success: false, error: 'Target scope not found.' };

        const rawSource = sourceNode.outerHTML || '';
        const source = normalize(rawSource);
        const normalizedNeedle = normalize(needle);
        const indexNeedle = normalizeWs ? normalizedNeedle : needle;
        const haystack = normalizeWs ? source : rawSource;

        const matches: Array<{ index: number; context: string }> = [];
        const searchNeedle = normalizeWs ? indexNeedle : needle;
        if (searchNeedle && searchNeedle.length > 0) {
          let position = 0;
          while (matches.length < matchLimit) {
            const foundAt = haystack.indexOf(searchNeedle, position);
            if (foundAt < 0) break;
            const contextStart = Math.max(0, foundAt - 120);
            const contextEnd = Math.min(haystack.length, foundAt + searchNeedle.length + 120);
            matches.push({
              index: foundAt,
              context: haystack.slice(contextStart, contextEnd),
            });
            position = foundAt + Math.max(1, searchNeedle.length);
          }
        }

        if (!normalizeWs && matches.length === 0 && normalizedNeedle && normalizedNeedle !== needle) {
          const fallbackNeedle = normalizedNeedle;
          let position = 0;
          while (matches.length < matchLimit) {
            const foundAt = source.indexOf(fallbackNeedle, position);
            if (foundAt < 0) break;
            const contextStart = Math.max(0, foundAt - 120);
            const contextEnd = Math.min(source.length, foundAt + fallbackNeedle.length + 120);
            matches.push({
              index: -1,
              context: source.slice(contextStart, contextEnd),
            });
            position = foundAt + Math.max(1, fallbackNeedle.length);
          }
        }

        return {
          success: true,
          hasMatch: matches.length > 0,
          matchCount: matches.length,
          matched: matches.length > 0 ? `Found ${matches.length} match(es) for provided HTML.` : 'No exact match found.',
          scopeSelector: scopeSelector || ':root',
          snippetLength: normalizeWs ? normalizedNeedle.length : needle.length,
          sourceLength: haystack.length,
          matches,
        };
      },
      [selector, htmlSnippet, normalizeWhitespace, maxMatches],
    );

    return result || { success: false, error: 'Script execution failed.' };
  }

  private async screenshot(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) {
      return {
        success: false,
        error:
          'No session tab available. Pass tabId from describeSessionTabs(), or select a tab in the UI before running.',
      };
    }
    const tab = await chrome.tabs.get(tabId);
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    await this.sendOverlay(tabId, { label: 'Screenshot captured', durationMs: 1000 }, 1);
    return { success: true, dataUrl };
  }

  private async getTabs() {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    return {
      success: true,
      tabs: tabs.map((tab) => ({ id: tab.id, title: tab.title, url: tab.url })),
    };
  }

  private async groupTabs(args: Record<string, any>) {
    if (!this.supportsTabGroups) {
      return { success: false, error: 'Tab grouping is not supported in this browser.' };
    }
    const tabIds = Array.isArray(args.tabIds) ? args.tabIds.filter((id) => typeof id === 'number') : [];
    if (!tabIds.length) {
      return { success: false, error: 'No tab ids provided.' };
    }
    await this.groupTabsInternal(tabIds, { title: args.title, color: args.color });
    return { success: true, tabIds };
  }

  private async groupTabsInternal(tabIds: number[], options: GroupOptions) {
    if (!this.supportsTabGroups || !tabIds.length) return;
    const groupId = await chrome.tabs.group({ tabIds });
    if (options.title || options.color) {
      await chrome.tabGroups.update(groupId, {
        title: options.title,
        color: options.color,
      });
    }
  }

  /**
   * Get information about video elements on the page.
   */
  private async getVideoInfo(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) {
      return {
        success: false,
        error:
          'No session tab available. Pass tabId from describeSessionTabs(), or select a tab in the UI before running.',
      };
    }

    const selector = args.selector ? String(args.selector) : '';
    await this.sendOverlay(tabId, { label: 'Get video info', durationMs: 800 }, 1);

    const result = await this.runInTab(
      tabId,
      (sel: string) => {
        const videos = sel
          ? Array.from(document.querySelectorAll<HTMLVideoElement>(sel))
          : Array.from(document.querySelectorAll<HTMLVideoElement>('video'));

        if (videos.length === 0) {
          return {
            success: false,
            error: 'No video elements found on the page.',
            hint: 'Make sure the page has a <video> element, or provide a specific selector.',
          };
        }

        const info = videos.map((video, index) => ({
          index,
          src: video.currentSrc || video.src || null,
          currentSrc: video.currentSrc || null,
          duration: video.duration || 0,
          currentTime: video.currentTime || 0,
          paused: video.paused,
          ended: video.ended,
          muted: video.muted,
          volume: video.volume,
          playbackRate: video.playbackRate || 1,
          readyState: video.readyState,
          networkState: video.networkState,
          videoWidth: video.videoWidth || 0,
          videoHeight: video.videoHeight || 0,
          aspectRatio: video.videoWidth && video.videoHeight ? `${video.videoWidth}x${video.videoHeight}` : null,
          id: video.id || null,
          className: video.className || null,
        }));

        return {
          success: true,
          videoCount: videos.length,
          videos: info,
        };
      },
      [selector],
    );

    return result || { success: false, error: 'Script execution failed.' };
  }

  /**
   * Watch and analyze a video by capturing frames at intervals.
   * Returns frame data URLs that can be passed to a vision model.
   */
  private async watchVideo(args: Record<string, any>) {
    const tabId = await this.resolveTabId(args);
    if (!tabId) {
      return {
        success: false,
        error:
          'No session tab available. Pass tabId from describeSessionTabs(), or select a tab in the UI before running.',
      };
    }

    const selector = args.selector ? String(args.selector) : '';
    const durationSeconds = Math.min(Math.max(1, Number(args.durationSeconds) || 10), 60);
    const frameIntervalSeconds = Math.min(Math.max(0.5, Number(args.frameIntervalSeconds) || 2), 10);
    const question = args.question ? String(args.question) : null;

    // Limit max frames to prevent memory issues
    const maxFrames = 30;
    const effectiveInterval = Math.max(frameIntervalSeconds, durationSeconds / maxFrames);

    await this.sendOverlay(
      tabId,
      {
        label: 'Watching video',
        note: `${durationSeconds}s at ${effectiveInterval.toFixed(1)}s intervals`,
        durationMs: (durationSeconds + 3) * 1000,
      },
      1,
    );

    // First check video exists and get basic info
    const videoCheck = await this.runInTab(
      tabId,
      (sel: string) => {
        const video = sel
          ? document.querySelector<HTMLVideoElement>(sel)
          : document.querySelector<HTMLVideoElement>('video');

        if (!video) {
          return {
            success: false,
            error: 'No video element found on the page.',
            hint: 'Make sure the page has a <video> element, or provide a specific selector.',
          };
        }

        if (video.readyState < 2) {
          return {
            success: false,
            error: 'Video has not loaded enough data.',
            readyState: video.readyState,
            hint: 'Wait for the video to load before analyzing.',
          };
        }

        return {
          success: true,
          video: {
            src: video.currentSrc || video.src || null,
            duration: video.duration || 0,
            currentTime: video.currentTime || 0,
            paused: video.paused,
            videoWidth: video.videoWidth || 640,
            videoHeight: video.videoHeight || 480,
          },
        };
      },
      [selector],
    );

    if (!videoCheck?.success) {
      return videoCheck || { success: false, error: 'Failed to check video.' };
    }

    // Capture frames with proper async waiting for seek
    const frames: Array<{ time: number; timeFormatted: string; dataUrl: string }> = [];
    const startTime = Math.max(0, videoCheck.video.currentTime);
    const endTime = Math.min(videoCheck.video.duration || startTime + durationSeconds, startTime + durationSeconds);

    for (
      let currentTime = startTime;
      currentTime <= endTime && frames.length < maxFrames;
      currentTime += effectiveInterval
    ) {
      // Use a script that returns a promise to properly wait for seek
      const frameResult = await new Promise<{
        success: boolean;
        time?: number;
        timeFormatted?: string;
        dataUrl?: string;
        error?: string;
      }>((resolve) => {
        chrome.scripting.executeScript(
          {
            target: { tabId },
            func: (sel: string, targetTime: number, seekTimeoutMs: number) => {
              return new Promise((res) => {
                const video = sel
                  ? document.querySelector<HTMLVideoElement>(sel)
                  : document.querySelector<HTMLVideoElement>('video');

                if (!video) {
                  res({ success: false, error: 'Video element not found.' });
                  return;
                }

                // Check for cross-origin (tainted) video
                try {
                  const testCanvas = document.createElement('canvas');
                  testCanvas.width = 1;
                  testCanvas.height = 1;
                  const testCtx = testCanvas.getContext('2d');
                  testCtx?.drawImage(video, 0, 0, 1, 1);
                  testCtx?.getImageData(0, 0, 1, 1);
                } catch (corsError) {
                  res({
                    success: false,
                    error:
                      'Video is cross-origin and cannot be captured. The video source must be same-origin or have CORS headers.',
                  });
                  return;
                }

                const captureFrame = () => {
                  const canvas = document.createElement('canvas');
                  const maxDim = 512;
                  let width = video.videoWidth || 640;
                  let height = video.videoHeight || 480;

                  if (width > maxDim || height > maxDim) {
                    const scale = maxDim / Math.max(width, height);
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                  }

                  canvas.width = width;
                  canvas.height = height;

                  const ctx = canvas.getContext('2d');
                  if (!ctx) {
                    res({ success: false, error: 'Failed to create canvas.' });
                    return;
                  }

                  try {
                    ctx.drawImage(video, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    const mins = Math.floor(targetTime / 60);
                    const secs = Math.floor(targetTime % 60);
                    const timeFormatted = `${mins}:${secs.toString().padStart(2, '0')}`;
                    res({ success: true, time: targetTime, timeFormatted, dataUrl });
                  } catch (e: any) {
                    res({ success: false, error: e?.message || 'Failed to capture frame.' });
                  }
                };

                // If already at the right time, capture immediately
                if (Math.abs(video.currentTime - targetTime) < 0.1) {
                  captureFrame();
                  return;
                }

                // Set up seek listener
                const onSeeked = () => {
                  video.removeEventListener('seeked', onSeeked);
                  clearTimeout(timeout);
                  // Small delay to ensure frame is rendered
                  setTimeout(captureFrame, 50);
                };

                const timeout = setTimeout(() => {
                  video.removeEventListener('seeked', onSeeked);
                  res({ success: false, error: 'Seek timed out.' });
                }, seekTimeoutMs);

                video.addEventListener('seeked', onSeeked);

                try {
                  video.currentTime = targetTime;
                } catch (seekError: any) {
                  video.removeEventListener('seeked', onSeeked);
                  clearTimeout(timeout);
                  res({ success: false, error: `Seek failed: ${seekError?.message || 'Unknown error'}` });
                }
              });
            },
            args: [selector, currentTime, 2000],
          },
          (results) => {
            if (results?.[0]?.result) {
              resolve(results[0].result as any);
            } else {
              resolve({ success: false, error: 'Script execution failed.' });
            }
          },
        );
      });

      if (frameResult?.success && frameResult.dataUrl) {
        frames.push({
          time: frameResult.time!,
          timeFormatted: frameResult.timeFormatted!,
          dataUrl: frameResult.dataUrl,
        });
      } else if (frameResult?.error) {
        console.warn(`Frame capture at ${currentTime}s failed:`, frameResult.error);
      }

      // Small delay between frames
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    if (frames.length === 0) {
      return {
        success: false,
        error: 'Failed to capture any frames from the video.',
        hint: 'The video may be protected (DRM), cross-origin, or not loaded properly.',
      };
    }

    return {
      success: true,
      video: videoCheck.video,
      frameCount: frames.length,
      frameIntervalSeconds: effectiveInterval,
      frames,
      question,
      note: `Captured ${frames.length} frames from video. These frames can be analyzed with a vision-capable model.`,
    };
  }
}
