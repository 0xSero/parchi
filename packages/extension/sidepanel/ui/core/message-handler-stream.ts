/**
 * Message Handler - Stream Module
 * Handles streaming message updates
 */

import { SidePanelUI } from './panel-ui.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Handle stream start message
 */
export const handleStreamStart = function handleStreamStart(this: SidePanelUI & Record<string, unknown>) {
  this.streamingReasoning = '';
  this.handleAssistantStream({ status: 'start' });
};

sidePanelProto.handleStreamStart = handleStreamStart;

/**
 * Handle stream delta message
 */
export const handleStreamDelta = function handleStreamDelta(this: SidePanelUI & Record<string, unknown>, message: any) {
  if (message.channel === 'reasoning') {
    const delta = message.content || '';
    this.streamingReasoning = `${this.streamingReasoning}${delta}`;
    this.latestThinking = this.streamingReasoning;
    if (!this.streamingState) {
      this.startStreamingMessage();
    }
    this.updateStreamReasoning(delta);
    return;
  }
  this.handleAssistantStream({ status: 'delta', content: message.content });
};

sidePanelProto.handleStreamDelta = handleStreamDelta;

/**
 * Handle stream stop message
 */
export const handleStreamStop = function handleStreamStop(this: SidePanelUI & Record<string, unknown>) {
  this.handleAssistantStream({ status: 'stop' });
};

sidePanelProto.handleStreamStop = handleStreamStop;

/**
 * Handle run start message
 */
export const handleRunStart = function handleRunStart(this: SidePanelUI & Record<string, unknown>) {
  this.streamingUsageEstimatedTokens = 0;
  this.streamingUsageEstimatedTokensApplied = 0;
};

sidePanelProto.handleRunStart = handleRunStart;
