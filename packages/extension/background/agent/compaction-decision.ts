import { DEFAULT_COMPACTION_SETTINGS, estimateContextTokens, shouldCompact } from '../../ai/compaction.js';
import { normalizeConversationHistory } from '../../ai/message-schema.js';
import type { RunContextCompactionOptions } from './compaction-shared.js';

export type CompactionDecision = {
  shouldCompact: boolean;
  forceCompaction: boolean;
  currentPercent: number;
  keepRecentTokens: number;
  reserveTokens: number;
  compactionCheck: {
    shouldCompact: boolean;
    percent: number;
    approxTokens: number;
  };
};

export function evaluateCompactionDecision(options: RunContextCompactionOptions): CompactionDecision {
  const compactionSettings = DEFAULT_COMPACTION_SETTINGS;
  const nextHistory = normalizeConversationHistory(Array.isArray(options.history) ? options.history : []);
  const contextUsage = estimateContextTokens(nextHistory);
  const compactionCheck = shouldCompact({
    contextTokens: contextUsage.tokens,
    contextLimit: options.contextLimit,
    settings: compactionSettings,
  });
  const currentPercent = Math.max(0, Math.min(100, Math.round(compactionCheck.percent * 100)));
  const forceCompaction = options.force === true;
  const keepRecentTokens = forceCompaction
    ? Math.max(320, Math.floor(options.contextLimit * 0.02))
    : compactionSettings.keepRecentTokens;

  return {
    shouldCompact: compactionCheck.shouldCompact,
    forceCompaction,
    currentPercent,
    keepRecentTokens,
    reserveTokens: compactionSettings.reserveTokens,
    compactionCheck,
  };
}

export function buildCompactionMetrics(
  options: RunContextCompactionOptions,
  decision: CompactionDecision,
): Record<string, unknown> {
  return {
    runId: options.runMeta.runId,
    turnId: options.runMeta.turnId,
    sessionId: options.runMeta.sessionId,
    source: options.source || 'auto',
    forced: decision.forceCompaction,
    contextLimit: options.contextLimit,
    decision: {
      shouldCompact: decision.compactionCheck.shouldCompact,
      percent: decision.currentPercent,
      approxTokens: decision.compactionCheck.approxTokens,
      reserveTokens: DEFAULT_COMPACTION_SETTINGS.reserveTokens,
      keepRecentTokens: decision.keepRecentTokens,
    },
    summary: {
      provider: String(options.orchestratorProfile?.provider || ''),
      model: String(options.orchestratorProfile?.model || ''),
    },
    compaction: {
      beforeApproxTokens: decision.compactionCheck.approxTokens,
      beforePercent: decision.currentPercent,
    },
  };
}
