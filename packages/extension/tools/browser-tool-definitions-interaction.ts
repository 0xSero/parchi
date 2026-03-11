import type { ToolDefinition } from '@parchi/shared';

/** Interaction tools for clicking, typing, and scrolling */
export const INTERACTION_TOOLS = [
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
