import type { AgentLoopDiagnostics } from './agent-loop-shared.js';

export function createLatencyMetricsBuilder(diagnostics: AgentLoopDiagnostics) {
  return function buildLatencyMetrics(): Record<string, unknown> {
    const completedAt = Date.now();
    const metrics: Record<string, unknown> = {
      runStartAt: diagnostics.runStartedAt,
      completedAt,
      totalMs: Math.max(0, completedAt - diagnostics.runStartedAt),
      stream: diagnostics.streamResponsesEnabled,
    };
    if (diagnostics.firstChunkAt != null)
      metrics.ttfbMs = Math.max(0, diagnostics.firstChunkAt - diagnostics.runStartedAt);
    if (diagnostics.firstTextTokenAt != null)
      metrics.firstTokenMs = Math.max(0, diagnostics.firstTextTokenAt - diagnostics.runStartedAt);
    if (diagnostics.modelAttempts > 0) metrics.modelAttempts = diagnostics.modelAttempts;
    return metrics;
  };
}

export function createBenchmarkContextBuilder(diagnostics: AgentLoopDiagnostics) {
  return function buildBenchmarkContext(success: boolean, errorCategory?: string): Record<string, unknown> {
    const payload: Record<string, unknown> = { success };
    const provider = diagnostics.benchmarkProvider || diagnostics.latestErrorContext.provider;
    const model = diagnostics.benchmarkModel || diagnostics.latestErrorContext.model;
    const route = diagnostics.benchmarkRoute || diagnostics.latestErrorContext.route;
    if (provider) payload.provider = provider;
    if (model) payload.model = model;
    if (route) payload.route = route;
    if (errorCategory) payload.errorCategory = errorCategory;
    return payload;
  };
}

export function createInitialDiagnostics(): AgentLoopDiagnostics {
  return {
    runStartedAt: Date.now(),
    streamResponsesEnabled: false,
    firstChunkAt: null,
    firstTextTokenAt: null,
    modelAttempts: 0,
    benchmarkRoute: 'none',
    benchmarkProvider: '',
    benchmarkModel: '',
    latestErrorContext: {},
  };
}
