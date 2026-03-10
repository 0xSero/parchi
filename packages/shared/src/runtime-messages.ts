/**
 * Unified runtime message module - re-exports all message types and utilities.
 * This is the main entry point for runtime message types.
 */
// Re-export extracted helper types
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

// Re-export base types and early message variants
export {
  RUNTIME_MESSAGE_SCHEMA_VERSION,
  type RuntimeMessageBase,
  type UserRunStart,
  type AssistantStreamStart,
  type AssistantStreamDelta,
  type AssistantStreamStop,
  type ToolExecutionStart,
  type ToolExecutionResult,
  type PlanUpdate,
  type ManualPlanUpdate,
  type RunStatus,
  type AssistantResponse,
} from './runtime-messages-base.js';

// Re-export extended message types
export type {
  AssistantFinal,
  CompactionEvent,
  ContextCompacted,
  ReportImageCaptured,
  ReportImageSummary,
  ReportImagesSelection,
  RunError,
  RunWarning,
  SessionTabsUpdate,
  SubagentComplete,
  SubagentStart,
  SubagentTabAssigned,
  TokenTraceEvent,
} from './runtime-messages-extended.js';

// Import for union type and type guard
import { RUNTIME_MESSAGE_SCHEMA_VERSION } from './runtime-messages-base.js';
import type {
  AssistantResponse,
  AssistantStreamDelta,
  AssistantStreamStart,
  AssistantStreamStop,
  ManualPlanUpdate,
  PlanUpdate,
  RunStatus,
  ToolExecutionResult,
  ToolExecutionStart,
  UserRunStart,
} from './runtime-messages-base.js';
import type {
  AssistantFinal,
  CompactionEvent,
  ContextCompacted,
  ReportImageCaptured,
  ReportImagesSelection,
  RunError,
  RunWarning,
  SessionTabsUpdate,
  SubagentComplete,
  SubagentStart,
  SubagentTabAssigned,
  TokenTraceEvent,
} from './runtime-messages-extended.js';

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
