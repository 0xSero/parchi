/**
 * Context Handler Module
 * Handles context compaction and message appending
 */

import { createMessage, normalizeConversationHistory } from '../../../ai/message-schema.js';
import type { Message } from '../../../ai/message-schema.js';
import { appendTrace } from '../chat/trace-store.js';
import { clampContextHistory, clearReportImages, clearToolCallViews } from './panel-session-memory.js';
import { SidePanelUI } from './panel-ui.js';
import { sanitizeTracePayload } from './trace-sanitizer.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Append context messages to history
 */
export const appendContextMessages = function appendContextMessages(
  this: SidePanelUI & Record<string, unknown>,
  responseMessages?: Array<Record<string, unknown>>,
  fallbackContent?: string,
  fallbackThinking?: string | null,
) {
  if (!responseMessages || responseMessages.length === 0) {
    const assistantEntry = createMessage({
      role: 'assistant',
      content: fallbackContent || '',
      thinking: fallbackThinking || null,
    });
    if (assistantEntry) {
      this.contextHistory.push(assistantEntry);
      clampContextHistory(this.contextHistory);
    }
    return;
  }
  const normalized = normalizeConversationHistory(responseMessages as unknown as Message[]);
  this.contextHistory.push(...normalized);
  clampContextHistory(this.contextHistory);
};

sidePanelProto.appendContextMessages = appendContextMessages;

/**
 * Handle context compaction messages
 */
export const handleContextCompaction = function handleContextCompaction(
  this: SidePanelUI & Record<string, unknown>,
  message: {
    trimmedCount?: number;
    preservedCount?: number;
    source?: string;
    contextUsage?: { percent?: number };
    beforeContextUsage?: { percent?: number };
    contextMessages?: Array<Record<string, unknown>>;
    newSessionId?: string;
    startFreshSession?: boolean;
    summary?: string;
    compactionMetrics?: Record<string, unknown>;
  },
) {
  const trimmedCount = Number(message.trimmedCount || 0);
  const preservedCount = Number(message.preservedCount || 0);
  const source = String(message.source || 'auto');
  const percent =
    typeof message.contextUsage?.percent === 'number'
      ? Math.max(0, Math.min(100, Math.round(message.contextUsage.percent)))
      : null;
  const beforePercent =
    typeof message.beforeContextUsage?.percent === 'number'
      ? Math.max(0, Math.min(100, Math.round(message.beforeContextUsage.percent)))
      : null;

  const parts = [
    trimmedCount > 0 ? `${trimmedCount} summarized` : 'Context compacted',
    preservedCount > 0 ? `${preservedCount} preserved` : null,
    beforePercent !== null && percent !== null ? `${beforePercent}% → ${percent}%` : null,
    beforePercent === null && percent !== null ? `${percent}% after compaction` : null,
  ].filter(Boolean as unknown as (x: string | null) => x is string);

  if (parts.length > 0) {
    this.updateStatus(`Context compacted: ${parts.join(', ')}`, 'success');
  }

  const normalized = normalizeConversationHistory(message.contextMessages as unknown as Message[]);
  this.contextHistory = normalized;
  clampContextHistory(this.contextHistory);
  this.sessionId = message.newSessionId || this.sessionId;

  if (message.startFreshSession === true) {
    this.displayHistory = [];
    this.elements.chatMessages.innerHTML = '';
    this.lastChatTurn = null;
    this.pendingTurnDraft = null;
    this.historyTurnMap.clear();
    this.currentPlan = null;
    this.hidePlanDrawer?.();
    clearToolCallViews(this.toolCallViews);
    clearReportImages(this.reportImages, this.reportImageOrder, this.selectedReportImageIds);
  }

  const summaryText = message.summary || 'Context compacted.';
  const summaryEntry = createMessage({
    role: 'system',
    content: summaryText,
    meta: {
      kind: 'summary',
      summaryOfCount: message.trimmedCount,
      source: 'auto',
    },
  });
  if (summaryEntry) {
    this.displayHistory.push(summaryEntry);
    this.displaySummaryMessage(summaryEntry);
  }

  if (typeof (message.contextUsage as Record<string, number>)?.approxTokens === 'number') {
    this.updateContextUsage((message.contextUsage as Record<string, number>).approxTokens);
  }

  this.setContextCompactionState?.({
    inProgress: false,
    lastResult: 'success',
    lastMessage: parts.join(', '),
    lastTrimmedCount: trimmedCount,
    lastPreservedCount: preservedCount,
    lastSource: source,
    lastCompactedAt: Date.now(),
    lastCompletedAt: Date.now(),
    lastBeforePercent: beforePercent,
    lastAfterPercent: percent,
    lastMetrics:
      message.compactionMetrics && typeof message.compactionMetrics === 'object'
        ? (sanitizeTracePayload(message.compactionMetrics) as Record<string, unknown>)
        : null,
  });

  void appendTrace({
    sessionId: this.sessionId,
    ts: Date.now(),
    kind: 'compaction_event',
    stage: 'applied',
    source,
    note: parts.join(', '),
    details: sanitizeTracePayload({
      trimmedCount,
      preservedCount,
      beforeContextUsage: message.beforeContextUsage,
      contextUsage: message.contextUsage,
      metrics: message.compactionMetrics,
    }),
  }).finally(() => {
    if (this.isContextInspectorPopoverOpen?.()) {
      void this.refreshContextInspectorLog?.();
    }
  });

  // Trigger compaction sweep animation on the context bar
  const bar = document.getElementById('contextBar');
  if (bar) {
    bar.classList.remove('compacting');
    // Force reflow so re-adding the class restarts the animation
    void bar.offsetWidth;
    bar.classList.add('compacting');
    bar.addEventListener('animationend', () => bar.classList.remove('compacting'), { once: true });
  }

  // Auto-continue: if compaction was triggered automatically at end of turn,
  // send a continuation prompt so the model resumes with the compacted context.
  if (source === 'auto' && !this.elements.composer?.classList.contains('running')) {
    setTimeout(() => {
      this.elements.userInput.value =
        'Continue where you left off. The context was compacted — use the summary above as your source of truth.';
      this.sendMessage();
    }, 400);
  }
};

sidePanelProto.handleContextCompaction = handleContextCompaction;
