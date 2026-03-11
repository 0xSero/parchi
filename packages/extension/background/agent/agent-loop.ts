import type { Message } from '../../ai/message-schema.js';
import type { ServiceContext } from '../service-context.js';
import type { RunMeta, SessionState } from '../service-types.js';
import {
  createBenchmarkContextBuilder,
  createInitialDiagnostics,
  createLatencyMetricsBuilder,
} from './agent-loop-diagnostics.js';
import {
  emitAssistantFinalTrace,
  handleAgentError,
  handleProviderCompactionDetection,
  runPostResponseCompaction,
  sendAssistantFinal,
  sendUserRunStart,
} from './agent-loop-execution.js';
import { prepareAgentLoopRun } from './agent-loop-prepare.js';
import { resolveAgentResponse } from './agent-loop-response.js';
import type { RecordedContext } from './agent-loop-shared.js';

export async function processUserMessage(
  ctx: ServiceContext,
  userMessage: string,
  conversationHistory: Message[],
  selectedTabs: chrome.tabs.Tab[],
  sessionId: string,
  meta?: Partial<RunMeta> & { origin?: 'sidepanel' | 'relay' },
  recordedContext?: RecordedContext,
) {
  const runMeta = createRunMeta(sessionId, meta);
  const origin = meta?.origin || 'sidepanel';
  if (origin === 'relay') ctx.relayActiveRunIds.add(runMeta.runId);
  const controller = ctx.registerActiveRun(runMeta, origin);
  const abortSignal = controller.signal;
  const sessionState = ctx.getSessionState(sessionId);
  const diagnostics = createInitialDiagnostics();
  const buildLatencyMetrics = createLatencyMetricsBuilder(diagnostics);
  const buildBenchmarkContext = createBenchmarkContextBuilder(diagnostics);

  initializeSessionState(sessionState);
  sendUserRunStart(ctx, runMeta, sessionState, userMessage, conversationHistory);

  try {
    const preparedOrBlocked = await prepareAgentLoopRun(
      ctx,
      runMeta,
      abortSignal,
      sessionId,
      userMessage,
      conversationHistory,
      selectedTabs,
      recordedContext,
      diagnostics,
    );
    if ('blocked' in preparedOrBlocked) {
      ctx.sendRuntime(runMeta, {
        type: 'run_error',
        message: preparedOrBlocked.message,
        latency: buildLatencyMetrics(),
        benchmark: buildBenchmarkContext(false, 'config'),
      });
      return;
    }

    const prepared = preparedOrBlocked;
    const response = await resolveAgentResponse(prepared, diagnostics, buildLatencyMetrics, buildBenchmarkContext);
    if (!response) return;

    sendAssistantFinal(ctx, runMeta, response, prepared, buildLatencyMetrics, buildBenchmarkContext);
    await handleProviderCompactionDetection(ctx, runMeta, sessionState, response, prepared);
    emitAssistantFinalTrace(ctx, runMeta, sessionState, response, prepared);
    await runPostResponseCompaction(ctx, runMeta, response, prepared, abortSignal);
  } catch (error) {
    handleAgentError(ctx, runMeta, error, diagnostics, buildLatencyMetrics, buildBenchmarkContext, abortSignal);
  } finally {
    ctx.cleanupRun(runMeta, origin);
    if (origin === 'relay') ctx.relayActiveRunIds.delete(runMeta.runId);
  }
}

function createRunMeta(sessionId: string, meta?: { runId?: string; turnId?: string }): RunMeta {
  return {
    runId:
      typeof meta?.runId === 'string' && meta.runId
        ? meta.runId
        : `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    turnId:
      typeof meta?.turnId === 'string' && meta.turnId
        ? meta.turnId
        : `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sessionId,
  };
}

function initializeSessionState(sessionState: SessionState): void {
  sessionState.lastBrowserAction = null;
  sessionState.awaitingVerification = false;
  sessionState.currentStepVerified = false;
}
