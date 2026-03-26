import type { ToolDefinition } from '@parchi/shared';
import { ADVANCED_BROWSER_TOOL_DEFINITIONS } from './browser-tool-definitions-advanced.js';
import { MAX_SESSION_TABS } from './browser-tool-shared.js';

const MAX_TABS = MAX_SESSION_TABS;

/** Navigation tools */
const NAVIGATION_TOOLS = [
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
    description: `Open a new tab with a URL. Limited to ${MAX_TABS} tabs per session.`,
    input_schema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'Absolute URL to open.' } },
      required: ['url'],
    },
  },
] as const satisfies readonly ToolDefinition[];

/** Interaction tools */
const INTERACTION_TOOLS = [
  {
    name: 'click',
    description: 'Click an element by selector. Supports CSS, text selectors like `text=Create note`.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to click.' },
        timeoutMs: { type: 'number', description: 'Optional wait timeout (ms).' },
        tabId: { type: 'number', description: 'Optional tab id.' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'clickAt',
    description: 'Click at exact viewport coordinates (x, y). Use when selectors fail.',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X coordinate from left edge.' },
        y: { type: 'number', description: 'Y coordinate from top edge.' },
        button: { type: 'string', enum: ['left', 'right', 'middle'], description: 'Mouse button.' },
        doubleClick: { type: 'boolean', description: 'Double-click if true.' },
        tabId: { type: 'number', description: 'Optional tab id.' },
      },
      required: ['x', 'y'],
    },
  },
  {
    name: 'type',
    description: 'Type text into input/textarea/contenteditable.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector for input.' },
        text: { type: 'string', description: 'Text to enter.' },
        timeoutMs: { type: 'number', description: 'Optional wait timeout (ms).' },
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
        key: { type: 'string', description: 'Keyboard key (e.g., Enter).' },
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
        selector: { type: 'string', description: 'Optional scrollable container.' },
        tabId: { type: 'number', description: 'Optional tab id.' },
      },
    },
  },
] as const satisfies readonly ToolDefinition[];

/** Content extraction and reading tools */
const READ_TOOLS = [
  {
    name: 'waitFor',
    description: 'Wait for a selector or page JavaScript condition to become true.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Optional selector to wait for.' },
        text: { type: 'string', description: 'Optional text that must appear in the matched element or page scope.' },
        script: {
          type: 'string',
          description: 'Optional JavaScript expression or function body that must evaluate truthy.',
        },
        args: {
          type: 'array',
          description: 'Optional JSON-serializable arguments exposed to the script as args.',
          items: {},
        },
        pollIntervalMs: { type: 'number', description: 'Polling interval in milliseconds. Defaults to 250.' },
        timeoutMs: { type: 'number', description: 'Maximum wait time in milliseconds.' },
        tabId: { type: 'number', description: 'Optional tab id.' },
      },
    },
  },
  {
    name: 'evaluate',
    description: 'Execute JavaScript in the page context and return a JSON-serializable result.',
    input_schema: {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description:
            'JavaScript source to execute. It may be an expression or function body. Use return for multi-line bodies.',
        },
        args: {
          type: 'array',
          description: 'Optional JSON-serializable arguments exposed to the script as args.',
          items: {},
        },
        tabId: { type: 'number', description: 'Optional tab id.' },
      },
      required: ['script'],
    },
  },
  {
    name: 'getContent',
    description: 'Extract page content.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'text, html, title, url, or links.' },
        selector: { type: 'string', description: 'Optional selector to scope.' },
        tabId: { type: 'number', description: 'Optional tab id.' },
      },
    },
  },
  {
    name: 'findHtml',
    description: 'Check if HTML snippet exists in page DOM.',
    input_schema: {
      type: 'object',
      properties: {
        htmlSnippet: { type: 'string', description: 'Exact HTML snippet.' },
        selector: { type: 'string', description: 'Optional scope selector.' },
        normalizeWhitespace: { type: 'boolean', description: 'Collapse whitespace.' },
        maxMatches: { type: 'number', description: 'Max matches (default 8).' },
        tabId: { type: 'number', description: 'Optional tab id.' },
      },
      required: ['htmlSnippet'],
    },
  },
  {
    name: 'screenshot',
    description: 'Capture screenshot of current tab.',
    input_schema: {
      type: 'object',
      properties: { tabId: { type: 'number', description: 'Optional tab id.' } },
    },
  },
] as const satisfies readonly ToolDefinition[];

/** Tab management tools */
const TAB_TOOLS = [
  {
    name: 'getTabs',
    description: 'List tabs in current window.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'closeTab',
    description: 'Close a tab by id.',
    input_schema: {
      type: 'object',
      properties: { tabId: { type: 'number', description: 'Tab id to close.' } },
      required: ['tabId'],
    },
  },
  {
    name: 'switchTab',
    description: 'Activate a tab by id.',
    input_schema: {
      type: 'object',
      properties: { tabId: { type: 'number', description: 'Tab id to activate.' } },
      required: ['tabId'],
    },
  },
  {
    name: 'focusTab',
    description: 'Focus a tab by id.',
    input_schema: {
      type: 'object',
      properties: { tabId: { type: 'number', description: 'Tab id to focus.' } },
      required: ['tabId'],
    },
  },
  {
    name: 'groupTabs',
    description: 'Group tabs with optional name and color.',
    input_schema: {
      type: 'object',
      properties: {
        tabIds: { type: 'array', items: { type: 'number' }, description: 'Tabs to group.' },
        title: { type: 'string', description: 'Group title.' },
        color: { type: 'string', description: 'Group color.' },
      },
    },
  },
  {
    name: 'describeSessionTabs',
    description: 'List tabs captured for this session.',
    input_schema: { type: 'object', properties: {} },
  },
] as const satisfies readonly ToolDefinition[];

/** Video tools */
const VIDEO_TOOLS = [
  {
    name: 'watchVideo',
    description: 'Watch and analyze video. Captures frames for vision model.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Optional video selector.' },
        durationSeconds: { type: 'number', description: 'Seconds to analyze (max 60).' },
        frameIntervalSeconds: { type: 'number', description: 'Interval between frames.' },
        question: { type: 'string', description: 'Optional question about video.' },
        tabId: { type: 'number', description: 'Optional tab id.' },
      },
    },
  },
  {
    name: 'getVideoInfo',
    description: 'Get info about video elements on page.',
    input_schema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'Optional video selector.' },
        tabId: { type: 'number', description: 'Optional tab id.' },
      },
    },
  },
] as const satisfies readonly ToolDefinition[];

/** All browser tool definitions combined */
export const BASE_BROWSER_TOOL_DEFINITIONS = [
  ...NAVIGATION_TOOLS,
  ...INTERACTION_TOOLS,
  ...READ_TOOLS,
  ...TAB_TOOLS,
  ...VIDEO_TOOLS,
  ...ADVANCED_BROWSER_TOOL_DEFINITIONS,
] as const satisfies readonly ToolDefinition[];

/** Union type of all browser tool names */
export type BrowserToolName = (typeof BASE_BROWSER_TOOL_DEFINITIONS)[number]['name'];

/** Get tool definitions, optionally filtering tab groups if not supported */
export function getBrowserToolDefinitions(supportsTabGroups: boolean): ToolDefinition[] {
  return supportsTabGroups
    ? [...BASE_BROWSER_TOOL_DEFINITIONS]
    : BASE_BROWSER_TOOL_DEFINITIONS.filter((t) => t.name !== 'groupTabs');
}

/** Get a map of available tool names for quick lookup */
export function getBrowserToolMap(supportsTabGroups: boolean): Partial<Record<BrowserToolName, true>> {
  return Object.fromEntries(getBrowserToolDefinitions(supportsTabGroups).map((t) => [t.name, true] as const));
}
