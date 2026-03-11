import type { ToolDefinition } from '@parchi/shared';

/** Tab management tools */
export const TAB_TOOLS = [
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
