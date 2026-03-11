// Tool set builder for AI SDK
import type { ToolDefinition } from '@parchi/shared';
import { jsonSchema, tool } from 'ai';

export type { ToolDefinition };

export function buildToolSet(
  tools: ToolDefinition[],
  execute: (toolName: string, args: Record<string, unknown>, options: { toolCallId: string }) => Promise<unknown>,
) {
  const entries = tools.map((definition) => {
    const schema = definition.input_schema || { type: 'object', properties: {} };
    return [
      definition.name,
      tool({
        description: definition.description,
        inputSchema: jsonSchema(schema),
        execute: async (args, options) =>
          execute(definition.name, args as Record<string, unknown>, { toolCallId: options.toolCallId }),
      }),
    ] as const;
  });
  return Object.fromEntries(entries);
}
