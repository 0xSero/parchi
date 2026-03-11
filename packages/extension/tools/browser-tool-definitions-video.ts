import type { ToolDefinition } from '@parchi/shared';

/** Video-related tools */
export const VIDEO_TOOLS = [
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
