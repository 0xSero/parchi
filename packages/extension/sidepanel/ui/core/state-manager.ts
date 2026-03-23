/**
 * State Manager Module
 * Manages sidepanel state and lifecycle
 */

import { pruneOldTraces } from '../chat/trace-store.js';
import { setSidebarOpen } from './panel-navigation.js';
import { SidePanelUI } from './panel-ui.js';

// Import watchdog module (registers methods on SidePanelUI.prototype)
import './watchdog-manager.js';

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
  // Remove the queued message banner
  const composerWrapper = this.elements.composer?.closest('.composer-wrapper');
  composerWrapper?.querySelector('.queued-message-banner')?.remove();
  // Stuff the queued text into the input and send
  this.elements.userInput.value = msg;
  this.sendMessage();
};

sidePanelProto.flushQueuedMessage = flushQueuedMessage;
