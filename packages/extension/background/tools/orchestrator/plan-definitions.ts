import type { ToolDefinition } from '@parchi/shared';

type ProfileSchema = {
  type: string;
  description: string;
  enum?: string[];
};

export function getPlanToolDefinitions(profileSchema: ProfileSchema): ToolDefinition[] {
  return [
    {
      name: 'set_orchestrator_plan',
      description:
        'Create or replace the orchestrator DAG plan for this session. Use for dependency-aware multi-tab execution.',
      input_schema: {
        type: 'object',
        properties: {
          goal: { type: 'string', description: 'Top-level goal for the orchestrated run.' },
          assumptions: { type: 'array', items: { type: 'string' } },
          interviewQuestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                question: { type: 'string' },
                answerKey: { type: 'string' },
                required: { type: 'boolean' },
              },
              required: ['question'],
            },
          },
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                summary: { type: 'string' },
                kind: { type: 'string', enum: ['browser', 'research', 'synthesis', 'validation', 'handoff'] },
                status: {
                  type: 'string',
                  enum: ['pending', 'ready', 'running', 'blocked', 'completed', 'failed', 'cancelled'],
                },
                dependencies: { type: 'array', items: { type: 'string' } },
                sitePatterns: { type: 'array', items: { type: 'string' } },
                requiredSkills: { type: 'array', items: { type: 'string' } },
                assignedProfile: profileSchema,
                assignedTabId: { type: 'number' },
                prompt: { type: 'string' },
                inputs: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      key: { type: 'string' },
                      description: { type: 'string' },
                      required: { type: 'boolean' },
                      fromTaskId: { type: 'string' },
                    },
                    required: ['key'],
                  },
                },
                outputs: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      key: { type: 'string' },
                      description: { type: 'string' },
                      required: { type: 'boolean' },
                      fromTaskId: { type: 'string' },
                    },
                    required: ['key'],
                  },
                },
                validations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      kind: {
                        type: 'string',
                        enum: ['url_includes', 'dom_includes', 'whiteboard_key', 'tool_success', 'manual'],
                      },
                      value: { type: 'string' },
                      selector: { type: 'string' },
                      required: { type: 'boolean' },
                    },
                    required: ['kind'],
                  },
                },
                notes: { type: 'string' },
                maxAttempts: { type: 'number' },
              },
              required: ['title'],
            },
          },
          whiteboardKeys: { type: 'array', items: { type: 'string' } },
          maxConcurrentTabs: { type: 'number', description: '1-5 concurrent tab-bound workers.' },
        },
        required: ['goal', 'tasks'],
      },
    },
    {
      name: 'get_orchestrator_plan',
      description: 'Fetch the current orchestrator plan, validation issues, ready tasks, and whiteboard snapshot.',
      input_schema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'update_orchestrator_task',
      description: 'Update one orchestrator task status or assignment metadata.',
      input_schema: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'Task id to update.' },
          status: {
            type: 'string',
            enum: ['pending', 'ready', 'running', 'blocked', 'completed', 'failed', 'cancelled'],
          },
          notes: { type: 'string' },
          prompt: { type: 'string' },
          assignedProfile: profileSchema,
          assignedTabId: { type: 'number' },
        },
        required: ['taskId'],
      },
    },
    {
      name: 'dispatch_orchestrator_tasks',
      description: 'Dispatch ready orchestrator tasks into subagents, respecting the per-session tab cap.',
      input_schema: {
        type: 'object',
        properties: {
          maxTasks: { type: 'number', description: 'Optional max number of ready tasks to dispatch this tick.' },
        },
      },
    },
  ];
}
