/**
 * Message Handler - Plan Module
 * Handles plan update messages
 */

import { appendTrace } from '../chat/trace-store.js';
import { SidePanelUI } from './panel-ui.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Handle plan update messages
 */
export const handlePlanUpdate = function handlePlanUpdate(this: SidePanelUI & Record<string, unknown>, message: any) {
  this.applyPlanUpdate(message.plan);

  if (!this.isReplayingHistory && this.pendingTurnDraft?.userMessage) {
    const now = Date.now();
    const turnId = message.turnId || `turn-${now}`;
    const existing = this.historyTurnMap.get(turnId) as Record<string, unknown> | undefined;
    const entry = existing || {
      id: turnId,
      startedAt: this.pendingTurnDraft.startedAt,
      userMessage: this.pendingTurnDraft.userMessage,
      plan: null,
      toolEvents: [],
    };
    entry.plan = message.plan;
    this.historyTurnMap.set(turnId, entry as any);

    appendTrace({
      sessionId: this.sessionId,
      ts: Date.now(),
      kind: 'plan_update',
      plan: message.plan,
    });
  }
};

sidePanelProto.handlePlanUpdate = handlePlanUpdate;

/**
 * Handle manual plan update
 */
export const handleManualPlanUpdate = function handleManualPlanUpdate(
  this: SidePanelUI & Record<string, unknown>,
  message: any,
) {
  this.applyManualPlanUpdate(message.steps);
};

sidePanelProto.handleManualPlanUpdate = handleManualPlanUpdate;
