import type { ToolDefinition } from '@parchi/shared';
import { MAX_SESSION_TABS } from './browser-tool-shared.js';

const MAX_TABS = MAX_SESSION_TABS;

/** Navigation and tab opening tools */
export const NAVIGATION_TOOLS = [
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
