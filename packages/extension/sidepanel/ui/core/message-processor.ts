/**
 * Message Processor Module
 * Handles runtime messages from the background service
 */

import { appendTrace } from '../chat/trace-store.js';
import { recordUsage } from '../settings/usage-store.js';
import { capTurnToolEvents, clampHistoryTurnMap } from './history-manager.js';
import { SidePanelUI } from './panel-ui.js';
import { sanitizeTracePayload } from './trace-sanitizer.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Handle incoming runtime messages from the background service
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

  // Handle stream start
  if (message.type === 'assistant_stream_start') {
    this.streamingReasoning = '';
    this.handleAssistantStream({ status: 'start' });
    return;
  }

  // Handle stream delta
  if (message.type === 'assistant_stream_delta') {
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
    return;
  }

  // Handle stream stop
  if (message.type === 'assistant_stream_stop') {
    this.handleAssistantStream({ status: 'stop' });
    return;
  }

  // Handle run start
  if (message.type === 'user_run_start') {
    this.streamingUsageEstimatedTokens = 0;
    this.streamingUsageEstimatedTokensApplied = 0;
    return;
  }

  // Handle run status updates
  if (message.type === 'run_status') {
    handleRunStatusMessage.call(this, message);
    return;
  }

  // Handle token trace
  if (message.type === 'token_trace') {
    handleTokenTraceMessage.call(this, message);
    return;
  }

  // Handle compaction event
  if (message.type === 'compaction_event') {
    handleCompactionEventMessage.call(this, message);
    return;
  }

  // Handle plan updates
  if (message.type === 'plan_update') {
    handlePlanUpdateMessage.call(this, message);
    return;
  }

  if (message.type === 'manual_plan_update') {
    this.applyManualPlanUpdate(message.steps);
    return;
  }

  // Handle tool execution
  if (message.type === 'tool_execution_start') {
    handleToolExecutionStart.call(this, message);
    return;
  }

  if (message.type === 'tool_execution_result') {
    handleToolExecutionResult.call(this, message);
    return;
  }

  // Handle assistant final message
  if (message.type === 'assistant_final') {
    handleAssistantFinalMessage.call(this, message);
    return;
  }

  // Handle context compaction
  if (message.type === 'context_compacted') {
    this.handleContextCompaction(message);
    return;
  }

  // Handle run errors and warnings
  if (message.type === 'run_error') {
    handleRunErrorMessage.call(this, message);
    return;
  }

  if (message.type === 'run_warning') {
    handleRunWarningMessage.call(this, message);
    return;
  }

  // Handle report images
  if (message.type === 'report_image_captured') {
    this.recordReportImage?.(message.image);
    this.updateReportImageSelection?.(message.selectedImageIds || []);
    return;
  }

  if (message.type === 'report_images_selection') {
    this.updateReportImageSelection?.(message.selectedImageIds || []);
    return;
  }

  // Handle subagent messages
  if (message.type === 'subagent_start') {
    this.addSubagent(message.id, message.name, message.tasks);
    this.updateStatus(`Sub-agent "${message.name}" started`, 'active');
    return;
  }

  if (message.type === 'subagent_complete') {
    const status = message.success ? 'completed' : 'error';
    this.updateSubagentStatus(message.id, status, message.summary);
    if (message.success) {
      this.updateStatus(`Sub-agent "${message.name || message.id}" completed`, 'success');
    } else {
      this.updateStatus(`Sub-agent "${message.name || message.id}" failed`, 'error');
    }
    return;
  }
};

sidePanelProto.handleRuntimeMessage = handleRuntimeMessage;

/**
 * Handle run status messages
 */
function handleRunStatusMessage(this: SidePanelUI & Record<string, unknown>, message: any) {
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
}

/**
 * Handle token trace messages
 */
function handleTokenTraceMessage(this: SidePanelUI & Record<string, unknown>, message: any) {
  const action = typeof message.action === 'string' ? message.action : '';
  const reason = typeof message.reason === 'string' ? message.reason : '';
  const note = typeof message.note === 'string' ? message.note : '';
  const before = sanitizeTracePayload(message.before || null);
  const after = sanitizeTracePayload(message.after || null);
  const details = sanitizeTracePayload(message.details || null);

  appendTrace({
    sessionId: this.sessionId,
    ts: Date.now(),
    kind: 'token_trace',
    action,
    reason,
    note,
    before,
    after,
    details,
  });

  const beforeSnapshot =
    before && typeof before === 'object' ? (before as Record<string, unknown>) : ({} as Record<string, unknown>);
  const afterSnapshot =
    after && typeof after === 'object' ? (after as Record<string, unknown>) : ({} as Record<string, unknown>);

  const nextSessionInput = Number(afterSnapshot.sessionInputTokens);
  const nextSessionOutput = Number(afterSnapshot.sessionOutputTokens);
  const nextSessionTotal = Number(afterSnapshot.sessionTotalTokens);

  if (Number.isFinite(nextSessionInput) && Number.isFinite(nextSessionOutput) && Number.isFinite(nextSessionTotal)) {
    const previousSessionInput = Number(beforeSnapshot.sessionInputTokens || 0);
    const previousSessionOutput = Number(beforeSnapshot.sessionOutputTokens || 0);
    const previousSessionTotal = Number(beforeSnapshot.sessionTotalTokens || 0);

    this.sessionTokenTotals = {
      inputTokens: Math.max(0, nextSessionInput),
      outputTokens: Math.max(0, nextSessionOutput),
      totalTokens: Math.max(0, nextSessionTotal),
    };
    this.sessionTokensUsed = Math.max(0, Number(afterSnapshot.contextApproxTokens || nextSessionInput));
    this.lastUsage = {
      inputTokens: Math.max(0, nextSessionInput - previousSessionInput),
      outputTokens: Math.max(0, nextSessionOutput - previousSessionOutput),
      totalTokens: Math.max(0, nextSessionTotal - previousSessionTotal),
    };
    this.updateActivityState();
  }

  const nextContextApprox = Number(afterSnapshot.contextApproxTokens);
  if (Number.isFinite(nextContextApprox) && nextContextApprox > 0) {
    this.updateContextUsage(nextContextApprox);
  }
}

/**
 * Handle compaction event messages
 */
function handleCompactionEventMessage(this: SidePanelUI & Record<string, unknown>, message: any) {
  const stage = typeof message.stage === 'string' ? message.stage : '';
  const note = typeof message.note === 'string' ? message.note : '';
  const source = typeof message.source === 'string' ? message.source : 'auto';
  const details =
    message.details && typeof message.details === 'object'
      ? (sanitizeTracePayload(message.details) as Record<string, unknown>)
      : {};

  this.setContextCompactionState?.({
    lastEvent: { stage, note: note || null, source, details, timestamp: Date.now() },
  });

  if (stage === 'start' || stage === 'summary_request') {
    this.setContextCompactionState?.({
      inProgress: true,
      lastResult: null,
      lastMessage: note || 'Compaction in progress…',
    });
    this.updateStatus(note || 'Compacting context…', 'active');
  } else if (stage === 'summary_result') {
    this.updateStatus(note || 'Compaction summary generated.', 'active');
  } else if (stage === 'provider_detected') {
    this.setContextCompactionState?.({
      inProgress: false,
      lastMessage: note || 'Provider compaction detected.',
      lastCompletedAt: Date.now(),
    });
    this.updateStatus(note || 'Provider compaction detected.', 'warning');
  } else if (stage === 'skipped') {
    this.setContextCompactionState?.({
      inProgress: false,
      lastResult: 'skipped',
      lastMessage: note || 'Compaction skipped',
      lastCompletedAt: Date.now(),
    });
    this.updateStatus(note || 'Compaction skipped', 'warning');
  } else if (stage === 'failed') {
    this.setContextCompactionState?.({
      inProgress: false,
      lastResult: 'error',
      lastMessage: note || 'Compaction failed',
      lastCompletedAt: Date.now(),
    });
    this.updateStatus(note || 'Compaction failed', 'error');
  }

  void appendTrace({
    sessionId: this.sessionId,
    ts: Date.now(),
    kind: 'compaction_event',
    stage,
    source,
    note,
    details,
  }).finally(() => {
    if (this.isContextInspectorPopoverOpen?.()) {
      void this.refreshContextInspectorLog?.();
    }
  });
}

/**
 * Handle plan update messages
 */
function handlePlanUpdateMessage(this: SidePanelUI & Record<string, unknown>, message: any) {
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
}

/**
 * Handle tool execution start messages
 */
function handleToolExecutionStart(this: SidePanelUI & Record<string, unknown>, message: any) {
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
}

/**
 * Handle tool execution result messages
 */
function handleToolExecutionResult(this: SidePanelUI & Record<string, unknown>, message: any) {
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
}

/**
 * Handle assistant final message
 */
function handleAssistantFinalMessage(this: SidePanelUI & Record<string, unknown>, message: any) {
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
}

/**
 * Handle run error messages
 */
function handleRunErrorMessage(this: SidePanelUI & Record<string, unknown>, message: any) {
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
}

/**
 * Handle run warning messages
 */
function handleRunWarningMessage(this: SidePanelUI & Record<string, unknown>, message: any) {
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
}
