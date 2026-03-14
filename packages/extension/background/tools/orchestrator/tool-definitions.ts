import type { ToolDefinition } from '@parchi/shared';
import { getPlanToolDefinitions } from './plan-definitions.js';
import { getSubagentToolDefinitions } from './subagent-definitions.js';

type ProfileSchema = {
  type: string;
  description: string;
  enum?: string[];
};

export function getOrchestratorToolDefinitions(profileSchema: ProfileSchema): ToolDefinition[] {
  return [...getPlanToolDefinitions(profileSchema), ...getSubagentToolDefinitions(profileSchema)];
}
