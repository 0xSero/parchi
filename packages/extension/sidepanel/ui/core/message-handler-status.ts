/**
 * Message Handler - Status Module
 * Handles run status related messages
 */

import { SidePanelUI } from './panel-ui.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Handle run status messages
 */
export const handleRunStatusMessage = function handleRunStatusMessage(
  this: SidePanelUI & Record<string, unknown>,
  message: any,
) {
  const phase = typeof message.phase === 'string' ? message.phase : '';
  const isCompactionStage = String(message.stage || '') === 'compaction';

  if (isCompactionStage) {
    if (phase === 'planning' || phase === 'executing' || phase === 'finalizing') {
      this.setContextCompactionState?.({
        inProgress: true,
        lastResult: null,
        lastMessage: message.note || null,
      });
    } else if (phase === 'completed') {
      this.setContextCompactionState?.({
        inProgress: false,
        lastMessage: message.note || null,
        lastCompletedAt: Date.now(),
      });
    } else if (phase === 'failed' || phase === 'stopped') {
      this.setContextCompactionState?.({
        inProgress: false,
        lastResult: phase === 'stopped' ? 'skipped' : 'error',
        lastMessage: message.note || null,
        lastCompletedAt: Date.now(),
      });
    }
  }

  if (phase === 'stopped' || phase === 'failed' || phase === 'completed') {
    this.stopWatchdog?.();
    this.stopThinkingTimer?.();
    this.stopRunTimer?.();
    this.elements.composer?.classList.remove('running');
    this.pendingTurnDraft = null;
    this.pendingRecordedContext = null;
    this.hideRecordedContextBadge?.();
    this.pendingToolCount = 0;
    this.isStreaming = false;
    this.activeToolName = null;
    this.streamingUsageEstimatedTokens = 0;
    this.streamingUsageEstimatedTokensApplied = 0;
    this.updateActivityState();
    this.finishStreamingMessage();
  }

  if (phase === 'stopped') {
    this.updateStatus(message.note || 'Stopped', 'warning');
    this.flushQueuedMessage?.();
  } else if (phase === 'failed') {
    this.updateStatus(message.note || 'Failed', 'error');
    this.flushQueuedMessage?.();
  } else if (phase === 'completed') {
    this.updateStatus(message.note || 'Ready', 'success');
  } else if (phase === 'planning' || phase === 'executing' || phase === 'finalizing') {
    const phaseLabel = phase.charAt(0).toUpperCase() + phase.slice(1);
    const retryInfo =
      message.attempts && message.maxRetries
        ? (() => {
            const parts: string[] = [];
            if (message.attempts.api > 0) parts.push(`api ${message.attempts.api}/${message.maxRetries.api}`);
            if (message.attempts.tool > 0) parts.push(`tool ${message.attempts.tool}/${message.maxRetries.tool}`);
            return parts.length ? ` (retries: ${parts.join(', ')})` : '';
          })()
        : '';
    this.updateStatus(message.note || `${phaseLabel}${retryInfo}`, 'active');
  } else if (phase) {
    this.updateStatus(message.note || phase, 'active');
  }
};

sidePanelProto.handleRunStatusMessage = handleRunStatusMessage;
