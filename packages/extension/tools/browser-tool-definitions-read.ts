import type { ToolDefinition } from '@parchi/shared';

/** Content extraction and reading tools */
export const READ_TOOLS = [
  {
    name: 'waitFor',
    description:
      'Wait for a selector, text, or JavaScript condition to become true. Prefer selector or text over script on CSP-strict sites (social networks, banking, Google apps) — script conditions may return "csp_blocked" on those hosts. At least one of selector, text, or script is required.',
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'Selector to wait for. CSP-safe — preferred over script on strict-CSP pages.',
        },
        text: {
          type: 'string',
          description:
            'Text that must appear in the matched element or page scope. CSP-safe — preferred over script on strict-CSP pages.',
        },
        script: {
          type: 'string',
          description:
            'JavaScript expression or function body that must evaluate truthy. May fail with "csp_blocked" on strict-CSP pages — use selector or text instead if that happens.',
        },
        args: {
          type: 'array',
          description: 'Optional JSON-serializable arguments exposed to the script as args.',
          items: {},
        },
        pollIntervalMs: {
          type: 'number',
          description: 'Polling interval in milliseconds. Defaults to 250.',
        },
        timeoutMs: {
          type: 'number',
          description: 'Maximum wait time in milliseconds.',
        },
        tabId: { type: 'number', description: 'Optional tab id.' },
      },
    },
  },
  {
    name: 'evaluate',
    description:
      'Execute JavaScript in the page context and return a JSON-serializable result. May fail with "csp_blocked" on strict-CSP sites (social networks, banking, Google apps) — if that happens, use getContent, waitFor(selector|text), findHtml, or screenshot instead. Do NOT retry evaluate after a csp_blocked error on the same page.',
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
    description:
      'Extract page content. Result is truncated to maxChars (default 8000) with a `truncated` flag — raise maxChars if you need the full content. CSP-safe — does not use string eval. Auto-retries once on "frame_detached" (transient frame removal during SPA navigation); if it still fails, wait briefly then retry.',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'text, html, title, url, or links.' },
        selector: { type: 'string', description: 'Optional selector to scope.' },
        maxChars: { type: 'number', description: 'Maximum characters to return before truncating. Defaults to 8000.' },
        tabId: { type: 'number', description: 'Optional tab id.' },
      },
    },
  },
  {
    name: 'findHtml',
    description:
      'Check if HTML snippet exists in page DOM. CSP-safe — use this for markup verification on strict-CSP pages where evaluate would fail.',
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
