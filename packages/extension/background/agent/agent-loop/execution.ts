import type { ServiceContext } from '../../service-context.js';
import type { RunMeta, SessionState } from '../../service-types.js';
import { getTokenVisibilitySnapshot, normalizeContextPercent } from '../../session-manager.js';
import { captureCompaction } from '../../telemetry.js';
import type { AgentLoopDiagnostics, AgentResponseResult, PreparedAgentLoopRun } from './shared.js';

export async function handleProviderCompactionDetection(
  ctx: ServiceContext,
  runMeta: RunMeta,
  sessionState: SessionState,
  response: AgentResponseResult,
  prepared: PreparedAgentLoopRun,
): Promise<void> {
  const inputTokens = Number(response.totalUsage.inputTokens || 0);
  const currentTokenSnapshot = getTokenVisibilitySnapshot(sessionState);
  const previousInputTokens = Number(currentTokenSnapshot.providerInputTokens ?? Number.NaN);
  const previousOutputTokens = Number(currentTokenSnapshot.providerOutputTokens ?? Number.NaN);

  if (inputTokens > 0 && Number.isFinite(previousInputTokens) && Number.isFinite(previousOutputTokens)) {
    const expectedMinInputTokens = previousInputTokens + previousOutputTokens;
    if (expectedMinInputTokens > 0 && inputTokens < expectedMinInputTokens) {
      const tokensRemoved = expectedMinInputTokens - inputTokens;
      const detectionNote = `Provider compaction inferred: ${tokensRemoved} input tokens removed.`;
      ctx.sendRuntime(runMeta, {
        type: 'compaction_event',
        stage: 'provider_detected',
        source: 'provider',
        note: detectionNote,
        details: {
          previousInputTokens,
          previousOutputTokens,
          expectedMinInputTokens,
          actualInputTokens: inputTokens,
          tokensRemoved,
          model: prepared.orchestratorProfile.model || prepared.settings.model || '',
          provider: prepared.orchestratorProfile.provider || prepared.settings.provider || '',
        },
      });
      ctx.emitTokenTrace(runMeta, sessionState, {
        action: 'provider_compaction_detected',
        reason: 'input_tokens_drop',
        note: detectionNote,
        details: {
          previousInputTokens,
          previousOutputTokens,
          expectedMinInputTokens,
          actualInputTokens: inputTokens,
          tokensRemoved,
        },
      });
      void captureCompaction(
        'provider_detected',
        {
          previousInputTokens,
          previousOutputTokens,
          expectedMinInputTokens,
          actualInputTokens: inputTokens,
          tokensRemoved,
        },
        { sessionId: runMeta.sessionId, runId: runMeta.runId, turnId: runMeta.turnId },
      );
    }
  }
}

export function emitAssistantFinalTrace(
  ctx: ServiceContext,
  runMeta: RunMeta,
  sessionState: SessionState,
  response: AgentResponseResult,
  prepared: PreparedAgentLoopRun,
): void {
  const inputTokens = Number(response.totalUsage.inputTokens || 0);
  const outputTokens = Number(response.totalUsage.outputTokens || 0);
  const totalTokens = Number(response.totalUsage.totalTokens || inputTokens + outputTokens);
  const currentTokenSnapshot = getTokenVisibilitySnapshot(sessionState);
  const totalDelta = totalTokens > 0 ? totalTokens : inputTokens + outputTokens;
  ctx.emitTokenTrace(runMeta, sessionState, {
    action: 'assistant_final',
    reason: inputTokens > 0 ? 'new_assistant_usage' : 'estimate_fallback',
    note:
      inputTokens > 0
        ? 'Assistant usage recorded from provider response.'
        : 'Assistant usage missing; using fallback totals.',
    afterPatch: {
      providerInputTokens: inputTokens > 0 ? inputTokens : currentTokenSnapshot.providerInputTokens,
      providerOutputTokens: outputTokens > 0 ? outputTokens : currentTokenSnapshot.providerOutputTokens,
      contextApproxTokens: totalTokens > 0 ? totalTokens : currentTokenSnapshot.contextApproxTokens,
      contextLimit:
        prepared.orchestratorProfile.contextLimit ||
        prepared.settings.contextLimit ||
        currentTokenSnapshot.contextLimit,
      contextPercent: normalizeContextPercent(
        totalTokens > 0 ? totalTokens : currentTokenSnapshot.contextApproxTokens,
        prepared.orchestratorProfile.contextLimit ||
          prepared.settings.contextLimit ||
          currentTokenSnapshot.contextLimit,
      ),
      sessionInputTokens: currentTokenSnapshot.sessionInputTokens + inputTokens,
      sessionOutputTokens: currentTokenSnapshot.sessionOutputTokens + outputTokens,
      sessionTotalTokens: currentTokenSnapshot.sessionTotalTokens + totalDelta,
    },
    details: { inputTokens, outputTokens, totalTokens, responseMessageCount: response.responseMessages.length },
  });
}

export async function runPostResponseCompaction(
  ctx: ServiceContext,
  runMeta: RunMeta,
  response: AgentResponseResult,
  prepared: PreparedAgentLoopRun,
  abortSignal: AbortSignal,
): Promise<void> {
  const { normalizeConversationHistory } = await import('../../../ai/messages/schema.js');
  const { runContextCompaction } = await import('../compaction/runner.js');
  const nextHistory = normalizeConversationHistory([...response.currentHistory, ...response.responseMessages]);
  const contextLimit = prepared.orchestratorProfile.contextLimit || prepared.settings.contextLimit || 200000;
  await runContextCompaction(ctx, {
    runMeta,
    history: nextHistory,
    contextLimit,
    orchestratorProfile: prepared.orchestratorProfile,
    model: prepared.model,
    abortSignal,
    source: 'auto',
  });
}

export function handleAgentError(
  ctx: ServiceContext,
  runMeta: RunMeta,
  error: unknown,
  diagnostics: AgentLoopDiagnostics,
  buildLatencyMetrics: () => Record<string, unknown>,
  buildBenchmarkContext: (success: boolean, errorCategory?: string) => Record<string, unknown>,
  abortSignal: AbortSignal,
): void {
  if (abortSignal.aborted || ctx.isRunCancelled(runMeta.runId)) return;
  console.error('Error processing user message:', error);
  const { classifyApiError } = require('../../../ai/errors/classifier.js');
  const { APICallError } = require('@ai-sdk/provider');
  const classified = classifyApiError(error, { ...diagnostics.latestErrorContext });
  let message = classified.message;
  if (classified.category === 'unknown' && APICallError.isInstance(error)) {
    const apiError = error as { statusCode?: number; responseBody?: string; message?: string };
    const status = apiError.statusCode ? ` Status ${apiError.statusCode}.` : '';
    const body = apiError.responseBody ? ` Response: ${apiError.responseBody.slice(0, 500)}` : '';
    message = `${apiError.message || 'Unknown error'}${status}${body}`;
  }
  ctx.sendRuntime(runMeta, {
    type: 'run_error',
    message,
    errorCategory: classified.category,
    action: classified.action,
    recoverable: classified.recoverable,
    latency: buildLatencyMetrics(),
    benchmark: buildBenchmarkContext(false, classified.category),
  });
}

export function sendUserRunStart(
  ctx: ServiceContext,
  runMeta: RunMeta,
  sessionState: SessionState,
  userMessage: string,
  conversationHistory: unknown[],
): void {
  ctx.emitTokenTrace(runMeta, sessionState, {
    action: 'user_run_start',
    reason: 'turn_started',
    note: 'Turn started. Baseline token snapshot captured.',
    details: {
      messageLength: String(userMessage || '').length,
      historyMessageCount: Array.isArray(conversationHistory) ? conversationHistory.length : 0,
    },
  });
  ctx.sendRuntime(runMeta, { type: 'user_run_start', message: userMessage });
}

export function sendAssistantFinal(
  ctx: ServiceContext,
  runMeta: RunMeta,
  response: AgentResponseResult,
  prepared: PreparedAgentLoopRun,
  buildLatencyMetrics: () => Record<string, unknown>,
  buildBenchmarkContext: (success: boolean) => Record<string, unknown>,
): void {
  ctx.sendRuntime(runMeta, {
    type: 'assistant_final',
    content: response.finalText,
    thinking: response.reasoningText || null,
    model: prepared.orchestratorProfile.model || prepared.settings.model || '',
    usage: {
      inputTokens: response.totalUsage.inputTokens || 0,
      outputTokens: response.totalUsage.outputTokens || 0,
      totalTokens: response.totalUsage.totalTokens || 0,
    },
    responseMessages: response.responseMessages,
    latency: buildLatencyMetrics(),
    benchmark: buildBenchmarkContext(true),
  });
}
