/**
 * Message Handler - Tokens Module
 * Handles token trace and compaction event messages
 */

import { appendTrace } from '../chat/trace-store.js';
import { SidePanelUI } from './panel-ui.js';
import { sanitizeTracePayload } from './trace-sanitizer.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Handle token trace messages
 */
export const handleTokenTrace = function handleTokenTrace(this: SidePanelUI & Record<string, unknown>, message: any) {
  const action = typeof message.action === 'string' ? message.action : '';
  const reason = typeof message.reason === 'string' ? message.reason : '';
  const note = typeof message.note === 'string' ? message.note : '';
  const before = sanitizeTracePayload(message.before || null);
  const after = sanitizeTracePayload(message.after || null);
  const details = sanitizeTracePayload(message.details || null);

  appendTrace({
    sessionId: this.sessionId,
    ts: Date.now(),
    kind: 'token_trace',
    action,
    reason,
    note,
    before,
    after,
    details,
  });

  const beforeSnapshot =
    before && typeof before === 'object' ? (before as Record<string, unknown>) : ({} as Record<string, unknown>);
  const afterSnapshot =
    after && typeof after === 'object' ? (after as Record<string, unknown>) : ({} as Record<string, unknown>);

  const nextSessionInput = Number(afterSnapshot.sessionInputTokens);
  const nextSessionOutput = Number(afterSnapshot.sessionOutputTokens);
  const nextSessionTotal = Number(afterSnapshot.sessionTotalTokens);

  if (Number.isFinite(nextSessionInput) && Number.isFinite(nextSessionOutput) && Number.isFinite(nextSessionTotal)) {
    const previousSessionInput = Number(beforeSnapshot.sessionInputTokens || 0);
    const previousSessionOutput = Number(beforeSnapshot.sessionOutputTokens || 0);
    const previousSessionTotal = Number(beforeSnapshot.sessionTotalTokens || 0);

    this.sessionTokenTotals = {
      inputTokens: Math.max(0, nextSessionInput),
      outputTokens: Math.max(0, nextSessionOutput),
      totalTokens: Math.max(0, nextSessionTotal),
    };
    this.sessionTokensUsed = Math.max(0, Number(afterSnapshot.contextApproxTokens || nextSessionInput));
    this.lastUsage = {
      inputTokens: Math.max(0, nextSessionInput - previousSessionInput),
      outputTokens: Math.max(0, nextSessionOutput - previousSessionOutput),
      totalTokens: Math.max(0, nextSessionTotal - previousSessionTotal),
    };
    this.updateActivityState();
  }

  const nextContextApprox = Number(afterSnapshot.contextApproxTokens);
  if (Number.isFinite(nextContextApprox) && nextContextApprox > 0) {
    this.updateContextUsage(nextContextApprox);
  }
};

sidePanelProto.handleTokenTrace = handleTokenTrace;

/**
 * Handle compaction event messages
 */
export const handleCompactionEvent = function handleCompactionEvent(
  this: SidePanelUI & Record<string, unknown>,
  message: any,
) {
  const stage = typeof message.stage === 'string' ? message.stage : '';
  const note = typeof message.note === 'string' ? message.note : '';
  const source = typeof message.source === 'string' ? message.source : 'auto';
  const details =
    message.details && typeof message.details === 'object'
      ? (sanitizeTracePayload(message.details) as Record<string, unknown>)
      : {};

  this.setContextCompactionState?.({
    lastEvent: { stage, note: note || null, source, details, timestamp: Date.now() },
  });

  if (stage === 'start' || stage === 'summary_request') {
    this.setContextCompactionState?.({
      inProgress: true,
      lastResult: null,
      lastMessage: note || 'Compaction in progress…',
    });
    this.updateStatus(note || 'Compacting context…', 'active');
  } else if (stage === 'summary_result') {
    this.updateStatus(note || 'Compaction summary generated.', 'active');
  } else if (stage === 'provider_detected') {
    this.setContextCompactionState?.({
      inProgress: false,
      lastMessage: note || 'Provider compaction detected.',
      lastCompletedAt: Date.now(),
    });
    this.updateStatus(note || 'Provider compaction detected.', 'warning');
  } else if (stage === 'skipped') {
    this.setContextCompactionState?.({
      inProgress: false,
      lastResult: 'skipped',
      lastMessage: note || 'Compaction skipped',
      lastCompletedAt: Date.now(),
    });
    this.updateStatus(note || 'Compaction skipped', 'warning');
  } else if (stage === 'failed') {
    this.setContextCompactionState?.({
      inProgress: false,
      lastResult: 'error',
      lastMessage: note || 'Compaction failed',
      lastCompletedAt: Date.now(),
    });
    this.updateStatus(note || 'Compaction failed', 'error');
  }

  void appendTrace({
    sessionId: this.sessionId,
    ts: Date.now(),
    kind: 'compaction_event',
    stage,
    source,
    note,
    details,
  }).finally(() => {
    if (this.isContextInspectorPopoverOpen?.()) {
      void this.refreshContextInspectorLog?.();
    }
  });
};

sidePanelProto.handleCompactionEvent = handleCompactionEvent;
