import type { ToolDefinition } from '@parchi/shared';

type ProfileSchema = {
  type: string;
  description: string;
  enum?: string[];
};

export function getSubagentToolDefinitions(profileSchema: ProfileSchema): ToolDefinition[] {
  return [
    {
      name: 'spawn_subagent',
      description:
        'Spawn a sub-agent in its own dedicated Chrome tab. The agent operates independently with full browser tools scoped to its tab.',
      input_schema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Short display name for this agent (e.g. "Price Checker")' },
          url: {
            type: 'string',
            description: 'Starting URL to open in the agent tab. Defaults to about:blank.',
          },
          profile: profileSchema,
          prompt: { type: 'string', description: 'System prompt for the sub-agent' },
          tasks: { type: 'array', items: { type: 'string' }, description: 'Task list for the sub-agent' },
          goal: { type: 'string', description: 'Single goal string if tasks not provided' },
        },
      },
    },
    {
      name: 'subagent_complete',
      description: 'Sub-agent calls this when finished to return a summary payload.',
      input_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          data: { type: 'object' },
        },
        required: ['summary'],
      },
    },
    {
      name: 'list_subagents',
      description: 'List running and completed sub-agents for this session.',
      input_schema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'await_subagent',
      description: 'Wait for one or more running sub-agents, then finalize matching orchestrator tasks.',
      input_schema: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Single agent id to wait for.' },
          agentIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs of agents to wait for. Omit to wait for all running agents.',
          },
          timeout: {
            type: 'number',
            description: 'Max seconds to wait (default 300).',
          },
        },
      },
    },
    {
      name: 'await_agents',
      description: 'Legacy alias for await_subagent. Wait for one or more running sub-agents to complete.',
      input_schema: {
        type: 'object',
        properties: {
          agentIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs of agents to wait for. Omit to wait for all running agents.',
          },
          timeout: {
            type: 'number',
            description: 'Max seconds to wait (default 300).',
          },
        },
      },
    },
  ];
}
