import type { ToolDefinition } from '@parchi/shared';
import { getPlanToolDefinitions } from './orchestrator-plan-definitions.js';
import { getSubagentToolDefinitions } from './orchestrator-subagent-definitions.js';

type ProfileSchema = {
  type: string;
  description: string;
  enum?: string[];
};

export function getOrchestratorToolDefinitions(profileSchema: ProfileSchema): ToolDefinition[] {
  return [...getPlanToolDefinitions(profileSchema), ...getSubagentToolDefinitions(profileSchema)];
}
