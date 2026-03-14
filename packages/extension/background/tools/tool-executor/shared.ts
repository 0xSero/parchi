import type { RuntimeMessageBase } from '@parchi/shared';
import type { RunMeta, SessionState } from '../../service-types.js';

export type ToolExecutionArgs = Record<string, unknown>;
export type ToolExecutionSettings = Record<string, unknown>;
export type ToolExecutionProfile = Record<string, unknown> | null | undefined;

export type ToolExecutionOptions = {
  runMeta: RunMeta;
  settings: ToolExecutionSettings;
  visionProfile?: ToolExecutionProfile;
  runtimeMeta?: Pick<RuntimeMessageBase, 'agentId' | 'agentName' | 'agentKind' | 'agentSessionId' | 'parentSessionId'>;
};

export type NestedToolExecutor = (
  toolName: string,
  args: ToolExecutionArgs,
  options: ToolExecutionOptions,
  toolCallId?: string,
) => Promise<unknown>;

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
