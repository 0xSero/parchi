import type { ToolDefinition } from '@parchi/shared';

/** Advanced runtime/debugging tools for dynamic web apps */
export const ADVANCED_BROWSER_TOOL_DEFINITIONS = [
  {
    name: 'repl',
    description:
      'Sandboxed JavaScript REPL with browserjs() helper for clean DOM interaction and navigate() for multi-page workflows. Use for complex scraping, data extraction, batch operations, and building interactive workflows. browserjs() provides: querySelector, querySelectorAll, getText, getHtml, getAttribute, click, fill, getLinks, getTableData, url, title, scrollTo, waitForSelector. console.log() output is captured and returned.',
    input_schema: {
      type: 'object',
      properties: {
        script: {
          type: 'string',
          description:
            'JavaScript function body to execute. Has access to: browserjs() for DOM helpers, navigate(url) for page navigation, console.log/warn/error for captured output, args[] for passed arguments.',
        },
        args: {
          type: 'array',
          description: 'Optional JSON-serializable arguments available as args[] in the script.',
          items: {},
        },
        tabId: { type: 'number', description: 'Optional tab id.' },
      },
      required: ['script'],
    },
  },
  {
    name: 'ask_user_element',
    description:
      'Ask the user to visually select a DOM element on the page. Shows an interactive overlay where the user can hover and click to pick an element. Returns the selector, tag, text content, and attributes of the chosen element. Use when you need the user to point out a specific element they want to interact with.',
    input_schema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Message to show the user explaining what to select (e.g. "Click the button you want me to monitor").',
        },
        tabId: { type: 'number', description: 'Optional tab id.' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'native_click',
    description:
      'Dispatch trusted Chrome browser input events via the debugger protocol. Bypasses synthetic event detection used by some websites. Use as a last resort when normal click/type tools fail because the site blocks JavaScript-dispatched events.',
    input_schema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X viewport coordinate.' },
        y: { type: 'number', description: 'Y viewport coordinate.' },
        action: {
          type: 'string',
          enum: ['click', 'type', 'press'],
          description: 'Action type: click at coordinates, type text, or press a key.',
        },
        text: { type: 'string', description: 'Text to type (for action=type).' },
        key: { type: 'string', description: 'Key to press (for action=press), e.g. "Enter", "Tab".' },
        tabId: { type: 'number', description: 'Optional tab id.' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_cors_rules',
    description:
      'Manage local declarativeNetRequest CORS proxy rules. Add rules to bypass CORS restrictions for specific domains, or list/remove existing rules. Rules are applied locally within the browser — no external proxy needed.',
    input_schema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['add', 'remove', 'list'],
          description: 'Action to perform on CORS rules.',
        },
        domain: {
          type: 'string',
          description: 'Domain pattern to add/remove CORS bypass for (e.g. "api.example.com").',
        },
        ruleId: {
          type: 'number',
          description: 'Rule ID to remove (for action=remove).',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'watchNetwork',
    description:
      'Start or refresh network capture for the current page so later reads can inspect recent fetch/XHR responses and metadata.',
    input_schema: {
      type: 'object',
      properties: {
        clearExisting: {
          type: 'boolean',
          description: 'If true (default), clear any previously captured entries before watching.',
        },
        tabId: { type: 'number', description: 'Optional tab id.' },
      },
    },
  },
  {
    name: 'getNetworkLog',
    description:
      'Read recently captured network requests and responses for the current page, with optional filtering and response body snippets.',
    input_schema: {
      type: 'object',
      properties: {
        urlIncludes: { type: 'string', description: 'Only include entries whose URL contains this substring.' },
        method: { type: 'string', description: 'Optional HTTP method filter (GET, POST, etc).' },
        status: { type: 'number', description: 'Optional HTTP status filter.' },
        limit: { type: 'number', description: 'Maximum number of entries to return (default 20, max 50).' },
        includeBody: {
          type: 'boolean',
          description: 'If true, include truncated response body text when available.',
        },
        clearAfterRead: {
          type: 'boolean',
          description: 'If true, clear the captured log after returning the current entries.',
        },
        tabId: { type: 'number', description: 'Optional tab id.' },
      },
    },
  },
] as const satisfies readonly ToolDefinition[];
