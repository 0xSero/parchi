/**
 * Base types for runtime messages.
 */
import type { RunPlan } from './plan.js';
import type { RetryCounts, RunPhase } from './runtime-types.js';

export const RUNTIME_MESSAGE_SCHEMA_VERSION = 2 as const;

export type RuntimeMessageBase = {
  schemaVersion: typeof RUNTIME_MESSAGE_SCHEMA_VERSION;
  runId: string;
  sessionId: string;
  turnId?: string;
  timestamp: number;
  agentId?: string;
  agentName?: string;
  agentKind?: 'orchestrator' | 'subagent';
  agentSessionId?: string;
  parentSessionId?: string;
};

export type UserRunStart = RuntimeMessageBase & {
  type: 'user_run_start';
  message: string;
};

export type AssistantStreamStart = RuntimeMessageBase & {
  type: 'assistant_stream_start';
};

export type AssistantStreamDelta = RuntimeMessageBase & {
  type: 'assistant_stream_delta';
  content: string;
  channel?: 'text' | 'reasoning';
};

export type AssistantStreamStop = RuntimeMessageBase & {
  type: 'assistant_stream_stop';
};

export type ToolExecutionStart = RuntimeMessageBase & {
  type: 'tool_execution_start';
  tool: string;
  id?: string;
  args: Record<string, unknown>;
  stepIndex?: number;
  stepTitle?: string;
};

export type ToolExecutionResult = RuntimeMessageBase & {
  type: 'tool_execution_result';
  tool: string;
  id?: string;
  args?: Record<string, unknown>;
  result: unknown;
  stepIndex?: number;
  stepTitle?: string;
};

export type PlanUpdate = RuntimeMessageBase & {
  type: 'plan_update';
  plan: RunPlan;
};

export type ManualPlanUpdate = RuntimeMessageBase & {
  type: 'manual_plan_update';
  steps: Array<{
    title: string;
    status?: 'pending' | 'running' | 'done' | 'blocked';
    notes?: string;
  }>;
};

export type RunStatus = RuntimeMessageBase & {
  type: 'run_status';
  phase: RunPhase;
  attempts: RetryCounts;
  maxRetries: RetryCounts;
  lastError?: string;
  note?: string;
  stage?: string;
  source?: string;
};

export type AssistantResponse = RuntimeMessageBase & {
  type: 'assistant_response';
  content: string;
  thinking?: string | null;
  model?: string;
};
