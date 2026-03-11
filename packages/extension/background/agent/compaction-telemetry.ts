import type { ServiceContext } from '../service-context.js';
import type { SessionState } from '../service-types.js';
import { captureCompaction } from '../telemetry.js';
import type { CompactionDecision } from './compaction-decision.js';
import type { RunContextCompactionOptions } from './compaction-shared.js';

export function emitCompactionDecisionTelemetry(
  ctx: ServiceContext,
  sessionState: SessionState,
  options: RunContextCompactionOptions,
  decision: CompactionDecision,
): void {
  const { currentPercent, forceCompaction, compactionCheck, keepRecentTokens } = decision;

  ctx.sendRuntime(options.runMeta, {
    type: 'compaction_event',
    stage: 'decision',
    source: options.source || 'auto',
    note: forceCompaction
      ? 'Compaction forced by user request.'
      : `Compaction decision evaluated at ${currentPercent}% context usage.`,
    details: {
      shouldCompact: compactionCheck.shouldCompact,
      forced: forceCompaction,
      contextLimit: options.contextLimit,
      approxTokens: compactionCheck.approxTokens,
      reserveTokens: decision.reserveTokens,
      keepRecentTokens,
    },
  });

  ctx.emitTokenTrace(options.runMeta, sessionState, {
    action: 'compaction_decision',
    reason: forceCompaction ? 'manual_force' : compactionCheck.shouldCompact ? 'threshold_exceeded' : 'below_threshold',
    note: forceCompaction
      ? 'Compaction forced by user request.'
      : `Compaction decision evaluated at ${currentPercent}% context usage.`,
    afterPatch: {
      contextApproxTokens: compactionCheck.approxTokens,
      contextLimit: options.contextLimit,
      contextPercent: currentPercent,
    },
    details: {
      shouldCompact: compactionCheck.shouldCompact,
      forced: forceCompaction,
      reserveTokens: decision.reserveTokens,
      keepRecentTokens,
    },
  });

  void captureCompaction(
    'decision',
    {
      shouldCompact: compactionCheck.shouldCompact,
      forced: forceCompaction,
      percent: currentPercent,
      approxTokens: compactionCheck.approxTokens,
    },
    { sessionId: options.runMeta.sessionId, runId: options.runMeta.runId, turnId: options.runMeta.turnId },
  );
}

export function emitCompactionSkippedTelemetry(
  ctx: ServiceContext,
  sessionState: SessionState,
  options: RunContextCompactionOptions,
  decision: CompactionDecision,
): void {
  const { currentPercent, compactionCheck, reserveTokens } = decision;
  const skipReason = `${options.statusPrefix || 'Context'} is at ${currentPercent}% (${compactionCheck.approxTokens}/${options.contextLimit} tokens).`;

  ctx.sendRuntime(options.runMeta, {
    type: 'compaction_event',
    stage: 'skipped',
    source: options.source || 'auto',
    note: skipReason,
    details: {
      reason: 'below_threshold',
      shouldCompact: false,
      forced: false,
      contextLimit: options.contextLimit,
      approxTokens: compactionCheck.approxTokens,
      percent: currentPercent,
      reserveTokens,
    },
  });

  ctx.emitTokenTrace(options.runMeta, sessionState, {
    action: 'compaction_skipped',
    reason: 'below_threshold',
    note: skipReason,
    afterPatch: {
      contextApproxTokens: compactionCheck.approxTokens,
      contextLimit: options.contextLimit,
      contextPercent: currentPercent,
    },
    details: { stage: 'skipped', shouldCompact: false, forced: false, reserveTokens },
  });

  void captureCompaction(
    'skipped',
    { reason: 'below_threshold', percent: currentPercent, approxTokens: compactionCheck.approxTokens },
    { sessionId: options.runMeta.sessionId, runId: options.runMeta.runId, turnId: options.runMeta.turnId },
  );
}

export function emitCompactionStartTelemetry(
  ctx: ServiceContext,
  sessionState: SessionState,
  options: RunContextCompactionOptions,
  decision: CompactionDecision,
): void {
  const { currentPercent, forceCompaction, compactionCheck, keepRecentTokens, reserveTokens } = decision;

  ctx.sendRuntime(options.runMeta, {
    type: 'compaction_event',
    stage: 'start',
    source: options.source || 'auto',
    note: 'Compaction started.',
    details: {
      forced: forceCompaction,
      contextLimit: options.contextLimit,
      approxTokens: compactionCheck.approxTokens,
      percent: currentPercent,
      reserveTokens,
      keepRecentTokens,
    },
  });

  ctx.emitTokenTrace(options.runMeta, sessionState, {
    action: 'compaction_start',
    reason: forceCompaction ? 'manual_force' : 'threshold_exceeded',
    note: 'Compaction started.',
    afterPatch: {
      contextApproxTokens: compactionCheck.approxTokens,
      contextLimit: options.contextLimit,
      contextPercent: currentPercent,
    },
    details: { stage: 'start', forced: forceCompaction, reserveTokens },
  });

  void captureCompaction(
    'start',
    { forced: forceCompaction, percent: currentPercent, approxTokens: compactionCheck.approxTokens },
    { sessionId: options.runMeta.sessionId, runId: options.runMeta.runId, turnId: options.runMeta.turnId },
  );

  ctx.sendRuntime(options.runMeta, {
    type: 'run_status',
    phase: 'finalizing',
    attempts: { api: 0, tool: 0, finalize: 0 },
    maxRetries: { api: 0, tool: 0, finalize: 0 },
    note: forceCompaction
      ? `${options.statusPrefix || 'Context'} compaction started (${currentPercent}%, ${compactionCheck.approxTokens}/${options.contextLimit} tokens).`
      : `${options.statusPrefix || 'Context'} near limit (${currentPercent}%, ${compactionCheck.approxTokens}/${options.contextLimit} tokens). Compaction started.`,
    stage: 'compaction',
    source: options.source || 'auto',
  });
}
