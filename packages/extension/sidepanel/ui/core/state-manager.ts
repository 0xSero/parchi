/**
 * State Manager Module
 * Manages sidepanel state, lifecycle, and watchdog functionality
 */

import { pruneOldTraces } from '../chat/trace-store.js';
import { setSidebarOpen } from './panel-navigation.js';
import { SidePanelUI } from './panel-ui.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Initialize the sidepanel UI and connect to background
 */
export const init = async function init(this: SidePanelUI & Record<string, unknown>) {
  try {
    this.connectLifecyclePort();
    this.setupEventListeners();
    this.setupPlanDrawer();
    this.setupMissionControl();
    this.setupResizeObserver();
    setSidebarOpen(this.elements, false);
    await this.loadSettings();
    await this.initAccountPanel?.();
    this.initProviderCardListeners?.();
    this.populateProviderDropdown?.();
    this.renderApiProviderGrid?.();
    await this.loadWorkflows();
    await this.loadHistoryList();
    this.updateContextUsage?.();
    this.updateStatus('Ready', 'success');
    this.syncAgentComposerState?.();
    this.updateModelDisplay();
    this.fetchAvailableModels();
    this.updateChatEmptyState?.();
    this.initMascotBubble?.();
    // Prune old traces (>7 days) in background — fire and forget
    pruneOldTraces().catch(() => {});
  } catch (error) {
    console.error('[Parchi] init() failed:', error);
    this.updateStatus('Initialization failed - check console', 'error');
  }
};

sidePanelProto.init = init;

/**
 * Connect lifecycle port for background communication
 */
export const connectLifecyclePort = function connectLifecyclePort(this: SidePanelUI & Record<string, unknown>) {
  if (this.lifecyclePort) return;
  try {
    const port = chrome.runtime.connect({ name: 'sidepanel-lifecycle' });
    this.lifecyclePort = port;
    port.onDisconnect.addListener(() => {
      if (this.lifecyclePort === port) {
        this.lifecyclePort = null;
      }
    });
  } catch (error) {
    console.warn('[Parchi] Failed to connect sidepanel lifecycle port:', error);
  }
};

sidePanelProto.connectLifecyclePort = connectLifecyclePort;

/**
 * Request to stop the current run
 */
export const requestRunStop = function requestRunStop(this: SidePanelUI & Record<string, unknown>, note = 'Stopped') {
  if (!this.lifecyclePort) {
    this.connectLifecyclePort?.();
  }
  const payload = {
    type: 'stop_run',
    sessionId: this.sessionId,
    note,
  };
  try {
    void chrome.runtime.sendMessage(payload);
  } catch {}
  try {
    this.lifecyclePort?.postMessage(payload);
  } catch {}
};

sidePanelProto.requestRunStop = requestRunStop;

/**
 * Setup resize observer for chat messages
 */
export const setupResizeObserver = function setupResizeObserver(this: SidePanelUI & Record<string, unknown>) {
  if (!this.elements.chatMessages || typeof ResizeObserver === 'undefined') return;
  this.chatResizeObserver = new ResizeObserver(() => {
    if (this.shouldAutoScroll() && this.isNearBottom) {
      this.scrollToBottom();
    }
  });
  this.chatResizeObserver.observe(this.elements.chatMessages);
};

sidePanelProto.setupResizeObserver = setupResizeObserver;

/**
 * Flush any queued message and send it
 */
export const flushQueuedMessage = function flushQueuedMessage(this: SidePanelUI & Record<string, unknown>) {
  if (!this.queuedMessage) return;
  const msg = this.queuedMessage;
  this.queuedMessage = null;
  // Stuff the queued text into the input and send
  this.elements.userInput.value = msg;
  this.sendMessage();
};

sidePanelProto.flushQueuedMessage = flushQueuedMessage;

/**
 * Start the watchdog timer to detect stuck states
 */
export const startWatchdog = function startWatchdog(this: SidePanelUI & Record<string, unknown>) {
  this.stopWatchdog();
  this._lastRuntimeMessageAt = Date.now();
  this._watchdogTimerId = setInterval(() => {
    const isRunning = this.elements.composer?.classList.contains('running');
    if (!isRunning) {
      this.stopWatchdog();
      return;
    }
    const silence = Date.now() - (this._lastRuntimeMessageAt || 0);
    if (silence > 90_000) {
      this.recoverFromStuckState();
    }
  }, 15_000);
};

sidePanelProto.startWatchdog = startWatchdog;

/**
 * Stop the watchdog timer
 */
export const stopWatchdog = function stopWatchdog(this: SidePanelUI & Record<string, unknown>) {
  if (this._watchdogTimerId != null) {
    clearInterval(this._watchdogTimerId as unknown as number);
    this._watchdogTimerId = null;
  }
};

sidePanelProto.stopWatchdog = stopWatchdog;

/**
 * Insert a stopped divider in the chat
 */
export const insertStoppedDivider = function insertStoppedDivider(this: SidePanelUI & Record<string, unknown>) {
  const el = document.createElement('div');
  el.className = 'stopped-divider';
  el.innerHTML = '<span>Stopped</span>';
  this.elements.chatMessages?.appendChild(el);
  this.scrollToBottom();
};

sidePanelProto.insertStoppedDivider = insertStoppedDivider;

/**
 * Recover from a stuck state when background is unresponsive
 */
export const recoverFromStuckState = function recoverFromStuckState(this: SidePanelUI & Record<string, unknown>) {
  if (!this.lifecyclePort) {
    this.connectLifecyclePort?.();
  }
  const backgroundReachable = Boolean(this.lifecyclePort);
  this._lastRuntimeMessageAt = Date.now();

  if (backgroundReachable) {
    this.showErrorBanner('No runtime updates for 90s. The model may still be working.', {
      category: 'timeout',
      action: 'Wait, or press Stop if the run is hung.',
    });
    if (!this.thinkingTimerId) {
      this.updateStatus('Waiting on model…', 'active');
    }
    return;
  }

  this.stopWatchdog();
  this.stopThinkingTimer?.();
  this.stopRunTimer?.();
  this.elements.composer?.classList.remove('running');
  this.pendingTurnDraft = null;
  this.pendingRecordedContext = null;
  this.hideRecordedContextBadge?.();
  this.pendingToolCount = 0;
  this.isStreaming = false;
  this.activeToolName = null;
  this.queuedMessage = null;
  this.updateActivityState();
  this.finishStreamingMessage();
  this.showErrorBanner('Run interrupted — the background service is unavailable. You can send the message again.', {
    category: 'timeout',
    action: 'Try sending your message again.',
  });
  this.updateStatus('Interrupted', 'warning');
};

sidePanelProto.recoverFromStuckState = recoverFromStuckState;
