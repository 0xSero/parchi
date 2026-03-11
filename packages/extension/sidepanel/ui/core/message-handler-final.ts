/**
 * Message Handler - Final Module
 * Handles assistant final message and usage tracking
 */

import { appendTrace } from '../chat/trace-store.js';
import { recordUsage } from '../settings/usage-store.js';
import { clampHistoryTurnMap } from './history-manager.js';
import { SidePanelUI } from './panel-ui.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Handle assistant final message
 */
export const handleAssistantFinal = function handleAssistantFinal(
  this: SidePanelUI & Record<string, unknown>,
  message: any,
) {
  if (!this.isReplayingHistory && this.pendingTurnDraft?.userMessage) {
    const now = Date.now();
    const turnId = message.turnId || `turn-${now}`;
    const existing = this.historyTurnMap.get(turnId) as Record<string, unknown> | undefined;
    const entry = existing || {
      id: turnId,
      startedAt: this.pendingTurnDraft.startedAt,
      userMessage: this.pendingTurnDraft.userMessage,
      plan: this.currentPlan || null,
      toolEvents: [],
    };
    (entry as Record<string, unknown>).assistantFinal = {
      content: message.content,
      thinking: message.thinking || null,
      model: message.model || null,
      usage: message.usage || null,
    };
    this.historyTurnMap.set(turnId, entry as any);
    clampHistoryTurnMap(this as { historyTurnMap: Map<string, unknown> });

    appendTrace({
      sessionId: this.sessionId,
      ts: Date.now(),
      kind: 'assistant_final',
      content: message.content,
      thinking: message.thinking || null,
      model: message.model || null,
      usage: message.usage || null,
    });
  }

  this.displayAssistantMessage(message.content, message.thinking, message.usage, message.model);
  this.appendContextMessages(message.responseMessages, message.content, message.thinking);

  // Record usage to persistent local store
  if (message.usage && (message.usage.inputTokens || message.usage.outputTokens)) {
    const activeConfig = (this.configs as Record<string, any>)?.[this.currentConfig as string] || {};
    const usageModel = message.model || activeConfig.model || 'unknown';
    const usageProvider = activeConfig.provider || 'unknown';
    recordUsage(usageModel, usageProvider, {
      inputTokens: message.usage.inputTokens || 0,
      outputTokens: message.usage.outputTokens || 0,
    }).catch((err: Error) => console.warn('[Parchi] recordUsage failed:', err));
  }

  if (message.usage?.inputTokens) {
    this.updateContextUsage(message.usage.inputTokens);
  } else if (message.contextUsage?.approxTokens) {
    this.updateContextUsage(message.contextUsage.approxTokens);
  } else {
    this.updateContextUsage();
  }

  if (!this.isReplayingHistory) {
    this.pendingTurnDraft = null;
  }

  void this.clearParchiRuntimeHealth?.();
};

sidePanelProto.handleAssistantFinal = handleAssistantFinal;
