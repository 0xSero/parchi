/**
 * Message Handler - Subagent Module
 * Handles subagent start/complete messages
 */

import { SidePanelUI } from './panel-ui.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Handle subagent start message
 */
export const handleSubagentStart = function handleSubagentStart(
  this: SidePanelUI & Record<string, unknown>,
  message: any,
) {
  this.addSubagent(message.id, message.name, message.tasks);
  this.updateStatus(`Sub-agent "${message.name}" started`, 'active');
};

sidePanelProto.handleSubagentStart = handleSubagentStart;

/**
 * Handle subagent complete message
 */
export const handleSubagentComplete = function handleSubagentComplete(
  this: SidePanelUI & Record<string, unknown>,
  message: any,
) {
  const status = message.success ? 'completed' : 'error';
  this.updateSubagentStatus(message.id, status, message.summary);
  if (message.success) {
    this.updateStatus(`Sub-agent "${message.name || message.id}" completed`, 'success');
  } else {
    this.updateStatus(`Sub-agent "${message.name || message.id}" failed`, 'error');
  }
};

sidePanelProto.handleSubagentComplete = handleSubagentComplete;
