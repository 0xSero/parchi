/**
 * Message Handler - Tools Module
 * Handles tool execution messages
 */

import { appendTrace } from '../../chat/trace-store.js';
import { capTurnToolEvents, clampHistoryTurnMap } from '../history-manager.js';
import { SidePanelUI } from '../panel-ui.js';
import { sanitizeTracePayload } from '../trace-sanitizer.js';

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

/**
 * Handle create_file messages — render a download card in the chat
 */
export const handleCreateFile = function handleCreateFile(this: SidePanelUI & Record<string, unknown>, message: any) {
  const filename = String(message.filename || 'download');
  const content = String(message.content || '');
  const mimeType = String(message.mimeType || 'text/plain');
  const sizeKb = Math.max(1, Math.round(new TextEncoder().encode(content).byteLength / 1024));

  const card = document.createElement('div');
  card.className = 'file-artifact-card';
  this.tagAgentView?.(card, 'main');
  card.innerHTML = `
    <div class="file-artifact-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
        <polyline points="9 15 12 18 15 15"/>
      </svg>
    </div>
    <div class="file-artifact-info">
      <span class="file-artifact-name">${this.escapeHtml(filename)}</span>
      <span class="file-artifact-meta">${this.escapeHtml(mimeType)} · ${sizeKb} KB</span>
    </div>
    <button class="file-artifact-download" title="Download">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    </button>
  `;

  card.querySelector('.file-artifact-download')?.addEventListener('click', () => {
    this.downloadFile(content, filename, mimeType);
  });
  // Also allow clicking the whole card
  card.addEventListener('click', (e: Event) => {
    if (!(e.target as HTMLElement).closest('.file-artifact-download')) {
      this.downloadFile(content, filename, mimeType);
    }
  });

  const streamEventsEl = this.streamingState?.eventsEl;
  if (streamEventsEl) {
    streamEventsEl.appendChild(card);
  } else if (this.elements.chatMessages) {
    this.elements.chatMessages.appendChild(card);
  }
  this.scrollToBottom();
};

sidePanelProto.handleCreateFile = handleCreateFile;
