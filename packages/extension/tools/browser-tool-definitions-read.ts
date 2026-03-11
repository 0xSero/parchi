import type { ToolDefinition } from '@parchi/shared';

/** Content extraction and reading tools */
export const READ_TOOLS = [
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
