/**
 * Message Processor Module
 * Main entry point for handling runtime messages from the background service
 */

import { SidePanelUI } from './panel-ui.js';

// Import sub-modules (each registers handler methods on SidePanelUI.prototype)
import './message-handlers/index.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Handle incoming runtime messages from the background service
 * Routes to specialized handler methods
 */
export const handleRuntimeMessage = function handleRuntimeMessage(
  this: SidePanelUI & Record<string, unknown>,
  message: any,
) {
  this._lastRuntimeMessageAt = Date.now();

  // Delegate subagent messages
  if (message?.agentId && message.agentId !== 'main' && this.handleSubagentRuntimeMessage?.(message)) {
    return;
  }

  // Only render events for the current session
  if (message?.sessionId && typeof message.sessionId === 'string' && message.sessionId !== this.sessionId) {
    return;
  }

  // Route to appropriate handler based on message type
  switch (message.type) {
    case 'assistant_stream_start':
      this.handleStreamStart();
      return;
    case 'assistant_stream_delta':
      this.handleStreamDelta(message);
      return;
    case 'assistant_stream_stop':
      this.handleStreamStop();
      return;
    case 'user_run_start':
      this.handleRunStart();
      return;
    case 'run_status':
      this.handleRunStatusMessage(message);
      return;
    case 'token_trace':
      this.handleTokenTrace(message);
      return;
    case 'compaction_event':
      this.handleCompactionEvent(message);
      return;
    case 'plan_update':
      this.handlePlanUpdate(message);
      return;
    case 'manual_plan_update':
      this.handleManualPlanUpdate(message);
      return;
    case 'tool_execution_start':
      this.handleToolStart(message);
      return;
    case 'tool_execution_result':
      this.handleToolResult(message);
      return;
    case 'assistant_final':
      this.handleAssistantFinal(message);
      return;
    case 'context_compacted':
      this.handleContextCompaction(message);
      return;
    case 'run_error':
      this.handleRunError(message);
      return;
    case 'run_warning':
      this.handleRunWarning(message);
      return;
    case 'report_image_captured':
      this.handleReportImageCaptured(message);
      return;
    case 'report_images_selection':
      this.handleReportImagesSelection(message);
      return;
    case 'create_file':
      this.handleCreateFile(message);
      return;
    case 'subagent_start':
      this.handleSubagentStart(message);
      return;
    case 'subagent_complete':
      this.handleSubagentComplete(message);
      return;
  }
};

sidePanelProto.handleRuntimeMessage = handleRuntimeMessage;
