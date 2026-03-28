import type { SessionState } from '../../service-types.js';
export type {
  NestedToolExecutor,
  ToolExecutionArgs,
  ToolExecutionOptions,
  ToolExecutionProfile,
  ToolExecutionSettings,
} from '../subagent/types-shared.js';

export const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const formatToolExecutorError = (error: unknown, fallback = 'Tool execution failed') => {
  if (error instanceof Error && error.message) return error.message;
  const message = String(error ?? '').trim();
  return message || fallback;
};

export function attachPlanToResult(result: unknown, toolName: string, sessionState: SessionState) {
  if (!sessionState.currentPlan || toolName === 'set_plan') return result;
  if (isObjectRecord(result)) {
    return { ...result, plan: sessionState.currentPlan };
  }
  return { result, plan: sessionState.currentPlan };
}
