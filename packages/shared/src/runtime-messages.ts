/**
 * Unified runtime message module.
 * Re-exports all types and provides the union type + type guard.
 */

// Re-export runtime-types for consumers
export {
  runStatusPhases,
  type ContextUsageSnapshot,
  type RetryCounts,
  type RunPhase,
  type RuntimeBenchmarkContext,
  type RuntimeLatencyMetrics,
  type TokenTraceSnapshot,
  type TokenUsage,
} from './runtime-types.js';

// Re-export all message types
export {
  RUNTIME_MESSAGE_SCHEMA_VERSION,
  type AssistantFinal,
  type AssistantResponse,
  type AssistantStreamDelta,
  type AssistantStreamStart,
  type AssistantStreamStop,
  type CompactionEvent,
  type ContextCompacted,
  type ManualPlanUpdate,
  type PlanUpdate,
  type ReportImageCaptured,
  type ReportImageSummary,
  type ReportImagesSelection,
  type RunError,
  type RunStatus,
  type RunWarning,
  type RuntimeMessageBase,
  type SessionTabsUpdate,
  type SubagentComplete,
  type SubagentStart,
  type SubagentTabAssigned,
  type TokenTraceEvent,
  type ToolExecutionResult,
  type ToolExecutionStart,
  type UserRunStart,
} from './runtime-message-types.js';

import { RUNTIME_MESSAGE_SCHEMA_VERSION } from './runtime-message-types.js';
import type {
  AssistantFinal,
  AssistantResponse,
  AssistantStreamDelta,
  AssistantStreamStart,
  AssistantStreamStop,
  CompactionEvent,
  ContextCompacted,
  ManualPlanUpdate,
  PlanUpdate,
  ReportImageCaptured,
  ReportImagesSelection,
  RunError,
  RunStatus,
  RunWarning,
  SessionTabsUpdate,
  SubagentComplete,
  SubagentStart,
  SubagentTabAssigned,
  TokenTraceEvent,
  ToolExecutionResult,
  ToolExecutionStart,
  UserRunStart,
} from './runtime-message-types.js';

/** Union of all runtime message types (22 variants). */
export type RuntimeMessage =
  | UserRunStart
  | AssistantStreamStart
  | AssistantStreamDelta
  | AssistantStreamStop
  | ToolExecutionStart
  | ToolExecutionResult
  | PlanUpdate
  | ManualPlanUpdate
  | RunStatus
  | AssistantResponse
  | AssistantFinal
  | RunError
  | RunWarning
  | TokenTraceEvent
  | CompactionEvent
  | ContextCompacted
  | SubagentStart
  | ReportImageCaptured
  | ReportImagesSelection
  | SubagentComplete
  | SubagentTabAssigned
  | SessionTabsUpdate;

/** All valid runtime message type strings. */
export const runtimeMessageTypes = [
  'user_run_start',
  'assistant_stream_start',
  'assistant_stream_delta',
  'assistant_stream_stop',
  'tool_execution_start',
  'tool_execution_result',
  'plan_update',
  'manual_plan_update',
  'run_status',
  'assistant_response',
  'assistant_final',
  'run_error',
  'run_warning',
  'token_trace',
  'compaction_event',
  'context_compacted',
  'subagent_start',
  'report_image_captured',
  'report_images_selection',
  'subagent_complete',
  'subagent_tab_assigned',
  'session_tabs_update',
] as const;

export type RuntimeMessageType = (typeof runtimeMessageTypes)[number];

/** Type guard to validate runtime messages. */
export function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as {
    type?: string;
    schemaVersion?: number;
    runId?: string;
    sessionId?: string;
    timestamp?: number;
  };
  if (message.schemaVersion !== RUNTIME_MESSAGE_SCHEMA_VERSION) return false;
  if (typeof message.type !== 'string') return false;
  if (!runtimeMessageTypes.includes(message.type as RuntimeMessageType)) return false;
  if (typeof message.runId !== 'string' || !message.runId) return false;
  if (typeof message.sessionId !== 'string' || !message.sessionId) return false;
  if (typeof message.timestamp !== 'number') return false;
  return true;
}
