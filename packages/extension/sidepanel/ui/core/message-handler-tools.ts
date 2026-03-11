/**
 * Message Handler - Tools Module
 * Handles tool execution messages
 */

import { appendTrace } from '../chat/trace-store.js';
import { capTurnToolEvents, clampHistoryTurnMap } from './history-manager.js';
import { SidePanelUI } from './panel-ui.js';
import { sanitizeTracePayload } from './trace-sanitizer.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Handle tool execution start
 */
export const handleToolStart = function handleToolStart(this: SidePanelUI & Record<string, unknown>, message: any) {
  this.pendingToolCount += 1;
  this.clearErrorBanner();
  this.updateActivityState();
  this.activeToolName = message.tool || null;
  if (!this.streamingState) {
    this.startStreamingMessage();
  }

  if (typeof message.stepIndex === 'number') {
    this.ensureStepContainer(message.stepIndex, message.stepTitle);
  }

  if (!this.isReplayingHistory && this.pendingTurnDraft?.userMessage) {
    const now = Date.now();
    const turnId = message.turnId || `turn-${now}`;
    const existing = this.historyTurnMap.get(turnId) as Record<string, unknown> | undefined;
    const entry = existing || {
      id: turnId,
      startedAt: this.pendingTurnDraft.startedAt,
      userMessage: this.pendingTurnDraft.userMessage,
      plan: this.currentPlan || null,
      toolEvents: [] as Record<string, unknown>[],
    };
    (entry.toolEvents as Record<string, unknown>[]).push({
      type: 'tool_execution_start',
      tool: message.tool,
      id: message.id,
      args: sanitizeTracePayload(message.args),
      stepIndex: message.stepIndex,
      stepTitle: message.stepTitle,
      timestamp: message.timestamp,
    });
    capTurnToolEvents(entry as { toolEvents: Record<string, unknown>[] });
    this.historyTurnMap.set(turnId, entry as any);
    clampHistoryTurnMap(this);

    appendTrace({
      sessionId: this.sessionId,
      ts: Date.now(),
      kind: 'tool_start',
      tool: message.tool,
      toolId: message.id,
      args: sanitizeTracePayload(message.args),
      stepIndex: message.stepIndex,
      stepTitle: message.stepTitle,
    });
  }

  this.displayToolExecution(message.tool, message.args, null, message.id);
};

sidePanelProto.handleToolStart = handleToolStart;

/**
 * Handle tool execution result
 */
export const handleToolResult = function handleToolResult(this: SidePanelUI & Record<string, unknown>, message: any) {
  this.pendingToolCount = Math.max(0, this.pendingToolCount - 1);
  this.updateActivityState();
  this.activeToolName = null;
  if (!this.streamingState) {
    this.startStreamingMessage();
  }

  if (typeof message.stepIndex === 'number') {
    this.ensureStepContainer(message.stepIndex, message.stepTitle);
  }

  if (!this.isReplayingHistory && this.pendingTurnDraft?.userMessage) {
    const now = Date.now();
    const turnId = message.turnId || `turn-${now}`;
    const existing = this.historyTurnMap.get(turnId) as Record<string, unknown> | undefined;
    const entry = existing || {
      id: turnId,
      startedAt: this.pendingTurnDraft.startedAt,
      userMessage: this.pendingTurnDraft.userMessage,
      plan: this.currentPlan || null,
      toolEvents: [] as Record<string, unknown>[],
    };
    (entry.toolEvents as Record<string, unknown>[]).push({
      type: 'tool_execution_result',
      tool: message.tool,
      id: message.id,
      args: sanitizeTracePayload(message.args),
      result: sanitizeTracePayload(message.result),
      stepIndex: message.stepIndex,
      stepTitle: message.stepTitle,
      timestamp: message.timestamp,
    });
    capTurnToolEvents(entry as { toolEvents: Record<string, unknown>[] });
    this.historyTurnMap.set(turnId, entry as any);
    clampHistoryTurnMap(this as { historyTurnMap: Map<string, unknown> });

    appendTrace({
      sessionId: this.sessionId,
      ts: Date.now(),
      kind: 'tool_result',
      tool: message.tool,
      toolId: message.id,
      args: sanitizeTracePayload(message.args),
      result: sanitizeTracePayload(message.result),
      stepIndex: message.stepIndex,
      stepTitle: message.stepTitle,
    });
  }

  this.displayToolExecution(message.tool, message.args, message.result, message.id);
};

sidePanelProto.handleToolResult = handleToolResult;
