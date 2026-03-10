/**
 * Shared types for runtime message system.
 * These types are used across multiple message variants and can be reused independently.
 */

/** Token usage statistics from the provider. */
export type TokenUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

/** Context usage snapshot for tracking context window utilization. */
export type ContextUsageSnapshot = {
  approxTokens?: number;
  contextLimit?: number;
  percent?: number;
};

/** Snapshot of token state for tracing. */
export type TokenTraceSnapshot = {
  providerInputTokens?: number | null;
  providerOutputTokens?: number | null;
  contextApproxTokens?: number | null;
  contextLimit?: number | null;
  contextPercent?: number | null;
  sessionInputTokens?: number;
  sessionOutputTokens?: number;
  sessionTotalTokens?: number;
};

/** Latency metrics for a single run. */
export type RuntimeLatencyMetrics = {
  runStartAt: number;
  completedAt: number;
  totalMs: number;
  ttfbMs?: number;
  firstTokenMs?: number;
  stream: boolean;
  modelAttempts?: number;
};

/** Context for benchmarking and error classification. */
export type RuntimeBenchmarkContext = {
  success: boolean;
  provider?: string;
  model?: string;
  route?: string;
  errorCategory?: string;
};

/** Retry counters for different operation types. */
export type RetryCounts = {
  api: number;
  tool: number;
  finalize: number;
};

/** Run phases for status tracking. */
export const runStatusPhases = ['planning', 'executing', 'finalizing', 'completed', 'stopped', 'failed'] as const;

export type RunPhase = (typeof runStatusPhases)[number];
