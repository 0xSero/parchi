import { DEFAULT_COMPACTION_SETTINGS } from '../../../ai/compaction/index.js';
import { normalizeConversationHistory } from '../../../ai/messages/schema.js';
import type { Message } from '../../../ai/messages/schema.js';
import { applyCompactionResult } from './apply.js';
import { buildCompactionMetrics, evaluateCompactionDecision } from './decision.js';
import { type RunContextCompactionOptions, profileUsesCodexOAuth } from './shared.js';
import { prepareCompactionSlice } from './slicing.js';
import { generateCompactionSummary } from './summary.js';
import {
  emitCompactionDecisionTelemetry,
  emitCompactionSkippedTelemetry,
  emitCompactionStartTelemetry,
} from './telemetry.js';

export async function runContextCompaction(
  ctx: import('../../service-context.js').ServiceContext,
  options: RunContextCompactionOptions,
): Promise<{ compacted: boolean; reason?: string }> {
  const sessionState = ctx.getSessionState(options.runMeta.sessionId);
  const decision = evaluateCompactionDecision(options);
  const { forceCompaction, keepRecentTokens, compactionCheck, currentPercent } = decision;

  let compactionMetrics = buildCompactionMetrics(options, decision);

  emitCompactionDecisionTelemetry(ctx, sessionState, options, decision);

  if (!forceCompaction && !compactionCheck.shouldCompact) {
    emitCompactionSkippedTelemetry(ctx, sessionState, options, decision);
    return {
      compacted: false,
      reason: `${options.statusPrefix || 'Context'} is at ${currentPercent}% (${compactionCheck.approxTokens}/${options.contextLimit} tokens).`,
    };
  }

  emitCompactionStartTelemetry(ctx, sessionState, options, decision);

  const nextHistory = normalizeConversationHistory(Array.isArray(options.history) ? options.history : []);
  const slice = prepareCompactionSlice(nextHistory as Message[], keepRecentTokens, forceCompaction);
  if ('skipReason' in slice) {
    ctx.sendRuntime(options.runMeta, {
      type: 'compaction_event',
      stage: 'skipped',
      source: options.source || 'auto',
      note: slice.skipReason,
      details: { reason: 'no_messages_to_summarize', forced: forceCompaction },
    });
    ctx.emitTokenTrace(options.runMeta, sessionState, {
      action: 'compaction_skipped',
      reason: 'no_messages_to_summarize',
      note: slice.skipReason,
      details: { stage: 'skipped', forced: forceCompaction },
    });
    return { compacted: false, reason: slice.skipReason };
  }

  const summaryResult = await generateCompactionSummary(ctx, sessionState, options, slice.promptText, {
    messagesToSummarizeCount: slice.messagesToSummarize.length,
    preservedCandidateCount: slice.preserved.length,
    hasPreviousSummary: Boolean(slice.previousSummary),
    reserveTokens: DEFAULT_COMPACTION_SETTINGS.reserveTokens,
  });

  compactionMetrics = {
    ...compactionMetrics,
    summary: {
      ...(compactionMetrics.summary as Record<string, unknown>),
      usage: summaryResult.summaryUsage,
      textLength: summaryResult.summaryText.length,
      generationMs: summaryResult.summaryGenerationMs,
      hasThinking: summaryResult.hasThinking,
      usesCodexOAuth: profileUsesCodexOAuth(options.orchestratorProfile),
    },
  };

  return applyCompactionResult(
    ctx,
    sessionState,
    options,
    nextHistory,
    slice.messagesToSummarize,
    slice.preserved,
    {
      shouldCompact: compactionCheck.shouldCompact,
      percent: compactionCheck.percent,
      approxTokens: compactionCheck.approxTokens,
    },
    summaryResult.summaryText,
    summaryResult.summaryUsage,
    compactionMetrics,
  );
}
