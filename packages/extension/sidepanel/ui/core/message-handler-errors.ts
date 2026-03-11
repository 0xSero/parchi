/**
 * Message Handler - Errors Module
 * Handles run errors and warnings
 */

import { SidePanelUI } from './panel-ui.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Handle run error messages
 */
export const handleRunError = function handleRunError(this: SidePanelUI & Record<string, unknown>, message: any) {
  this.stopWatchdog?.();
  this.stopThinkingTimer?.();
  this.stopRunTimer?.();
  this.elements.composer?.classList.remove('running');
  this.pendingTurnDraft = null;
  this.pendingToolCount = 0;
  this.isStreaming = false;
  this.activeToolName = null;
  this.streamingUsageEstimatedTokens = 0;
  this.streamingUsageEstimatedTokensApplied = 0;
  this.updateActivityState();
  this.nullifyFinalizedToolData?.();
  this.finishStreamingMessage();
  this.showErrorBanner(message.message, {
    category: message.errorCategory,
    action: message.action,
    recoverable: message.recoverable,
  });
  if (String(message.stage || '') === 'compaction') {
    this.setContextCompactionState?.({
      inProgress: false,
      lastResult: 'error',
      lastMessage: message.message || 'Compaction failed',
      lastCompletedAt: Date.now(),
    });
  }
  void this.setParchiRuntimeHealth?.({
    level: 'error',
    summary: String(message.message || 'Paid runtime failed.'),
    detail: String(message.action || ''),
    category: String(message.errorCategory || ''),
  });
  this.updateStatus('Error', 'error');
  this.flushQueuedMessage?.();
};

sidePanelProto.handleRunError = handleRunError;

/**
 * Handle run warning messages
 */
export const handleRunWarning = function handleRunWarning(this: SidePanelUI & Record<string, unknown>, message: any) {
  const isCompactionWarning = String(message.stage || '') === 'compaction';
  if (!isCompactionWarning) {
    this.showErrorBanner(message.message);
  }
  if (isCompactionWarning) {
    this.setContextCompactionState?.({
      inProgress: false,
      lastResult: 'skipped',
      lastMessage: message.message || 'No compaction applied',
      lastCompletedAt: Date.now(),
    });
    this.updateStatus(message.message || 'Compaction skipped', 'warning');
  }
  const warningText = String(message.message || '');
  if (warningText) {
    const lower = warningText.toLowerCase();
    if (lower.includes('model') || lower.includes('retrying') || lower.includes('unavailable')) {
      void this.setParchiRuntimeHealth?.({
        level: 'warning',
        summary: warningText,
      });
    }
  }
};

sidePanelProto.handleRunWarning = handleRunWarning;
