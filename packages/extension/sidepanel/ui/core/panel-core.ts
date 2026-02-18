import { isRuntimeMessage } from '../../../../shared/src/runtime-messages.js';
import { createMessage, normalizeConversationHistory } from '../../../ai/message-schema.js';
import type { Message } from '../../../ai/message-schema.js';
import { bindSidebarNavigation, setSidebarOpen } from './panel-navigation.js';

const debounce = (fn: (...args: any[]) => void, ms: number) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};
import { SidePanelUI } from './panel-ui.js';

const resolveTextAreaMaxHeight = (textarea: HTMLTextAreaElement, fallbackHeight: number): number => {
  const computedMaxHeight = Number.parseFloat(getComputedStyle(textarea).maxHeight);
  if (Number.isFinite(computedMaxHeight) && computedMaxHeight > 0) {
    return computedMaxHeight;
  }
  return fallbackHeight;
};

const autoResizeTextArea = (textarea: HTMLTextAreaElement | null, maxHeight: number, minHeight = 0) => {
  if (!textarea) return;
  const resolvedMaxHeight = resolveTextAreaMaxHeight(textarea, maxHeight);
  const resolvedMinHeight = Math.min(Math.max(0, minHeight), resolvedMaxHeight);
  textarea.style.height = 'auto';
  const nextHeight = Math.min(textarea.scrollHeight, resolvedMaxHeight);
  const clampedHeight = Math.max(nextHeight, resolvedMinHeight);
  textarea.style.height = `${clampedHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > resolvedMaxHeight || clampedHeight >= resolvedMaxHeight ? 'auto' : 'hidden';
};

(SidePanelUI.prototype as any).init = async function init() {
  try {
    this.setupEventListeners();
    this.setupPlanDrawer();
    this.setupResizeObserver();
    setSidebarOpen(this.elements, false);
    await this.loadSettings();
    await this.initAccountPanel?.();
    await this.loadWorkflows();
    await this.loadHistoryList();
    this.updateStatus('Ready', 'success');
    this.updateModelDisplay();
    this.fetchAvailableModels();
    this.updateChatEmptyState?.();
    this.initMascotBubble?.();
  } catch (error) {
    console.error('[Parchi] init() failed:', error);
    this.updateStatus('Initialization failed - check console', 'error');
  }
};

(SidePanelUI.prototype as any).setupEventListeners = function setupEventListeners() {
  bindSidebarNavigation(this.elements, {
    onOpen: () => this.openSettingsPanel(),
    onClose: () => this.closeSidebar(),
  });

  this.elements.startNewSessionBtn?.addEventListener('click', () => this.startNewSession());
  this.elements.newSessionFab?.addEventListener('click', () => this.startNewSession());
  this.elements.clearHistoryBtn?.addEventListener('click', () => this.clearAllHistory());

  // History drawer
  this.elements.historyFab?.addEventListener('click', () => this.openHistoryDrawer());
  this.elements.closeHistoryDrawerBtn?.addEventListener('click', () => this.closeHistoryDrawer());
  this.elements.historyDrawerScrim?.addEventListener('click', () => this.closeHistoryDrawer());
  this.elements.drawerClearHistoryBtn?.addEventListener('click', () => this.clearAllHistory());
  this.elements.drawerNewSessionBtn?.addEventListener('click', () => {
    this.closeHistoryDrawer();
    this.startNewSession();
  });
  this.elements.historySearchInput?.addEventListener('input', debounce(() => {
    const query = (this.elements.historySearchInput?.value || '').trim();
    this.filterHistoryList(query);
  }, 150));

  // Provider change
  this.elements.provider?.addEventListener('change', () => {
    this.toggleCustomEndpoint();
    this.updateScreenshotToggleState();
  });

  // Custom endpoint validation
  this.elements.customEndpoint?.addEventListener('input', () => this.validateCustomEndpoint());

  // Temperature slider
  this.elements.temperature?.addEventListener('input', () => {
    if (this.elements.temperatureValue) {
      this.elements.temperatureValue.textContent = this.elements.temperature.value;
    }
  });

  // Configuration management
  this.elements.newConfigBtn?.addEventListener('click', () => this.createNewConfig());
  this.elements.newProfileInput?.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.createNewConfig();
    }
  });
  this.elements.deleteConfigBtn?.addEventListener('click', () => this.deleteConfig());
  this.elements.activeConfig?.addEventListener('change', () => this.switchConfig());

  this.elements.settingsTabSetupBtn?.addEventListener('click', () => this.switchSettingsTab('setup'));
  this.elements.settingsTabOauthBtn?.addEventListener('click', () => this.switchSettingsTab('oauth'));
  this.elements.settingsTabModelBtn?.addEventListener('click', () => this.switchSettingsTab('model'));
  this.elements.settingsTabBrowserBtn?.addEventListener('click', () => this.switchSettingsTab('browser'));
  this.elements.settingsTabNetworkBtn?.addEventListener('click', () => this.switchSettingsTab('network'));
  this.elements.settingsTabPromptBtn?.addEventListener('click', () => this.switchSettingsTab('prompt'));
  this.elements.settingsTabProfilesBtn?.addEventListener('click', () => this.switchSettingsTab('profiles'));
  this.elements.createProfileBtn?.addEventListener('click', () => this.createProfileFromInput());
  this.elements.agentGrid?.addEventListener('click', (event) => {
    const deleteBtn = (event.target as HTMLElement | null)?.closest('.agent-card-delete') as HTMLElement | null;
    if (deleteBtn) {
      event.stopPropagation();
      const profileName = deleteBtn.dataset.deleteProfile;
      if (profileName) this.deleteProfileByName(profileName);
      return;
    }
    const pill = (event.target as HTMLElement | null)?.closest('.role-pill');
    if (pill) {
      const role = (pill as HTMLElement).dataset.role;
      const profile = (pill as HTMLElement).dataset.profile;
      this.assignProfileRole(profile, role);
      return;
    }
    const card = (event.target as HTMLElement | null)?.closest('.agent-card');
    if (card) {
      const profile = (card as HTMLElement).dataset.profile;
      this.editProfile(profile);
    }
  });
  this.elements.refreshProfilesBtn?.addEventListener('click', () => this.renderProfileGrid());

  // Screenshot + vision controls
  this.elements.enableScreenshots?.addEventListener('change', () => this.updateScreenshotToggleState());
  this.elements.visionProfile?.addEventListener('change', () => {
    this.updateScreenshotToggleState();
    this.updatePromptSections?.();
  });
  this.elements.sendScreenshotsAsImages?.addEventListener('change', () => this.updateScreenshotToggleState());
  this.elements.orchestratorToggle?.addEventListener('change', () => this.updatePromptSections?.());
  this.elements.orchestratorProfile?.addEventListener('change', () => this.updatePromptSections?.());

  // Save settings
  this.elements.saveSettingsBtn?.addEventListener('click', () => {
    void this.saveSettings();
  });
  this.elements.saveRelayBtn?.addEventListener('click', async () => {
    await this.persistAllSettings({ silent: false });
    // Ensure the MV3 service worker wakes up and immediately applies the new config.
    try {
      await chrome.runtime.sendMessage({ type: 'relay_reconfigure' });
    } catch {}
  });

  this.elements.copyRelayEnvBtn?.addEventListener('click', async () => {
    const rawUrl = String(this.elements.relayUrl?.value || '').trim();
    const token = String(this.elements.relayToken?.value || '').trim();
    if (!rawUrl) {
      this.updateStatus('Enter a relay URL first', 'warning');
      return;
    }
    if (!token) {
      this.updateStatus('Enter a relay token first', 'warning');
      return;
    }

    let host = '127.0.0.1';
    let port = '17373';
    try {
      const url = new URL(rawUrl);
      host = url.hostname || host;
      port = url.port || port;
    } catch {
      const cleaned = rawUrl.replace(/^https?:\/\//, '');
      const [h, p] = cleaned.split(':');
      if (h) host = h;
      if (p) port = p;
    }

    const text = `export PARCHI_RELAY_TOKEN="${token}"
export PARCHI_RELAY_HOST="${host}"
export PARCHI_RELAY_PORT="${port}"`;

    try {
      await navigator.clipboard.writeText(text);
      this.updateStatus('Relay env vars copied', 'success');
    } catch {
      this.updateStatus('Unable to copy relay env vars', 'error');
    }
  });

  // Cancel settings
  this.elements.cancelSettingsBtn?.addEventListener('click', () => {
    void this.cancelSettings();
  });

  this.elements.exportSettingsBtn?.addEventListener('click', () => this.exportSettings());
  this.elements.importSettingsBtn?.addEventListener('click', () => {
    this.elements.importSettingsInput?.click();
  });
  this.elements.importSettingsInput?.addEventListener('change', (event) => this.importSettings(event));

  // Send message (or stop if running)
  this.elements.sendBtn?.addEventListener('click', () => {
    if (this.elements.composer?.classList.contains('running')) {
      try {
        void chrome.runtime.sendMessage({ type: 'stop_run', sessionId: this.sessionId });
      } catch {}
      this.stopWatchdog?.();
      this.stopThinkingTimer?.();
      this.stopRunTimer?.();
      this.elements.composer?.classList.remove('running');
      this.pendingTurnDraft = null;
      this.pendingToolCount = 0;
      this.isStreaming = false;
      this.activeToolName = null;
      this.updateActivityState();
      this.finishStreamingMessage();
      this.clearErrorBanner?.();
      this.updateStatus('Stopped', 'warning');
    } else {
      this.sendMessage();
    }
  });

  // Enter to send (Shift+Enter for newline), workflow menu gets priority
  this.elements.userInput?.addEventListener('keydown', (event: KeyboardEvent) => {
    if (this.workflowMenuOpen && this.handleWorkflowKeydown(event)) {
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  });

  // Auto-expand textarea height as user types
  const userInput = this.elements.userInput;
  userInput?.addEventListener('input', () => {
    autoResizeTextArea(userInput, 280);
    this.handleWorkflowInput();
  });
  this.elements.systemPrompt?.addEventListener('input', () => {
    autoResizeTextArea(this.elements.systemPrompt, 500, 500);
  });
  this.elements.profileEditorPrompt?.addEventListener('input', () => {
    autoResizeTextArea(this.elements.profileEditorPrompt, 500);
  });
  autoResizeTextArea(userInput, 280);
  autoResizeTextArea(this.elements.systemPrompt, 500, 500);
  autoResizeTextArea(this.elements.profileEditorPrompt, 500);

  // Model selector (now shows profiles)
  this.elements.modelSelect?.addEventListener('change', () => {
    void this.handleModelSelectChange();
  });

  // File upload
  this.elements.fileBtn?.addEventListener('click', () => {
    this.elements.fileInput?.click();
  });
  this.elements.fileInput?.addEventListener('change', (event) => this.handleFileSelection(event));

  // Zoom controls
  this.elements.zoomInBtn?.addEventListener('click', () => this.adjustUiZoom(0.05));
  this.elements.zoomOutBtn?.addEventListener('click', () => this.adjustUiZoom(-0.05));
  this.elements.zoomResetBtn?.addEventListener('click', () => this.applyUiZoom(1));
  this.elements.uiZoom?.addEventListener('input', () => {
    const value = Number.parseFloat(this.elements.uiZoom.value || '1');
    this.applyUiZoom(value);
  });

  // Tab selector
  this.elements.tabSelectorBtn?.addEventListener('click', () => this.toggleTabSelector());
  this.elements.closeTabSelector?.addEventListener('click', () => this.closeTabSelector());
  this.elements.tabSelectorAddActive?.addEventListener('click', () => this.addActiveTabToSelection());
  this.elements.tabSelectorClear?.addEventListener('click', () => this.clearSelectedTabs());
  const tabBackdrop = this.elements.tabSelector?.querySelector('.modal-backdrop');
  tabBackdrop?.addEventListener('click', () => this.closeTabSelector());

  // Export button
  this.elements.exportBtn?.addEventListener('click', () => this.showExportMenu());

  this.elements.chatMessages?.addEventListener('scroll', () => this.handleChatScroll());
  this.elements.scrollToLatestBtn?.addEventListener('click', () => this.scrollToBottom({ force: true }));

  // Stop/reset is now handled by the send button above

  // Profile editor controls
  this.elements.profileEditorProvider?.addEventListener('change', () => this.toggleProfileEditorEndpoint());
  this.elements.profileEditorHeaders?.addEventListener('input', () => this.validateProfileEditorHeaders());
  this.elements.profileEditorTemperature?.addEventListener('input', () => {
    if (this.elements.profileEditorTemperatureValue) {
      this.elements.profileEditorTemperatureValue.textContent = this.elements.profileEditorTemperature.value;
    }
  });
  this.elements.saveProfileBtn?.addEventListener('click', () => this.saveProfileEdits());
  this.elements.refreshProfileJsonBtn?.addEventListener('click', () => this.refreshProfileJsonEditor());
  this.elements.copyProfileJsonBtn?.addEventListener('click', () => this.copyProfileJsonEditor());
  this.elements.applyProfileJsonBtn?.addEventListener('click', () => this.applyProfileJsonEditor());

  // Provider headers validation
  this.elements.customHeaders?.addEventListener('input', () => this.validateCustomHeaders());

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message) => {
    if (isRuntimeMessage(message)) {
      this.handleRuntimeMessage(message);
    }
  });

  // Keep relay connection status fresh while Settings is open.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (!changes.relayConnected && !changes.relayLastError) return;
    const next: Record<string, any> = {};
    if (changes.relayConnected) next.relayConnected = changes.relayConnected.newValue;
    if (changes.relayLastError) next.relayLastError = changes.relayLastError.newValue;
    this.updateRelayStatusFromSettings?.(next);
  });
};

(SidePanelUI.prototype as any).setupResizeObserver = function setupResizeObserver() {
  if (!this.elements.chatMessages || typeof ResizeObserver === 'undefined') return;
  this.chatResizeObserver = new ResizeObserver(() => {
    if (this.shouldAutoScroll() && this.isNearBottom) {
      this.scrollToBottom();
    }
  });
  this.chatResizeObserver.observe(this.elements.chatMessages);
};

(SidePanelUI.prototype as any).startWatchdog = function startWatchdog() {
  this.stopWatchdog();
  this._lastRuntimeMessageAt = Date.now();
  this._watchdogTimerId = setInterval(() => {
    const isRunning = this.elements.composer?.classList.contains('running');
    if (!isRunning) {
      this.stopWatchdog();
      return;
    }
    const silence = Date.now() - this._lastRuntimeMessageAt;
    if (silence > 90_000) {
      this.recoverFromStuckState();
    }
  }, 15_000);
};

(SidePanelUI.prototype as any).stopWatchdog = function stopWatchdog() {
  if (this._watchdogTimerId != null) {
    clearInterval(this._watchdogTimerId);
    this._watchdogTimerId = null;
  }
};

(SidePanelUI.prototype as any).recoverFromStuckState = function recoverFromStuckState() {
  this.stopWatchdog();
  this.stopThinkingTimer?.();
  this.stopRunTimer?.();
  this.elements.composer?.classList.remove('running');
  this.pendingTurnDraft = null;
  this.pendingToolCount = 0;
  this.isStreaming = false;
  this.activeToolName = null;
  this.updateActivityState();
  this.finishStreamingMessage();
  this.showErrorBanner('Connection lost — the background service may have restarted. You can send a new message.', {
    category: 'timeout',
    action: 'Try sending your message again.',
  });
  this.updateStatus('Disconnected', 'error');
};

(SidePanelUI.prototype as any).handleRuntimeMessage = function handleRuntimeMessage(message: any) {
  this._lastRuntimeMessageAt = Date.now();
  // Runtime messages are broadcast to all extension views. Only render events
  // that belong to the currently active session to avoid spilling output across
  // New Chat / history-loaded sessions.
  if (message?.sessionId && typeof message.sessionId === 'string' && message.sessionId !== this.sessionId) {
    return;
  }
  if (message.type === 'assistant_stream_start') {
    this.streamingReasoning = '';
    this.handleAssistantStream({ status: 'start' });
    return;
  }
  if (message.type === 'assistant_stream_delta') {
    if (message.channel === 'reasoning') {
      const delta = message.content || '';
      this.streamingReasoning = `${this.streamingReasoning}${delta}`;
      // Track thinking text for later use but don't render a second inline block;
      // updateStreamReasoning already renders the .stream-event-reasoning block.
      this.latestThinking = this.streamingReasoning;
      // When streaming is disabled, the background still emits reasoning deltas,
      // but we won't get assistant_stream_start. Create a container so reasoning
      // and tool events can render inline in chat.
      if (!this.streamingState) {
        this.startStreamingMessage();
      }
      this.updateStreamReasoning(delta);
      return;
    }
    this.handleAssistantStream({ status: 'delta', content: message.content });
    return;
  }
  if (message.type === 'assistant_stream_stop') {
    this.handleAssistantStream({ status: 'stop' });
    return;
  }

  if (message.type === 'run_status') {
    const phase = typeof message.phase === 'string' ? message.phase : '';
    if (phase === 'stopped' || phase === 'failed' || phase === 'completed') {
      this.stopWatchdog?.();
      this.stopThinkingTimer?.();
      this.stopRunTimer?.();
      this.elements.composer?.classList.remove('running');
      this.pendingTurnDraft = null;
      this.pendingToolCount = 0;
      this.isStreaming = false;
      this.activeToolName = null;
      this.updateActivityState();
      this.finishStreamingMessage();
    }

    if (phase === 'stopped') {
      this.updateStatus(message.note || 'Stopped', 'warning');
    } else if (phase === 'failed') {
      this.updateStatus(message.note || 'Failed', 'error');
    } else if (phase === 'completed') {
      this.updateStatus(message.note || 'Ready', 'success');
    } else if (phase) {
      this.updateStatus(message.note || phase, 'active');
    }
    return;
  }

  if (message.type === 'plan_update') {
    this.applyPlanUpdate(message.plan);

    if (!this.isReplayingHistory && this.pendingTurnDraft?.userMessage) {
      const now = Date.now();
      const turnId = (message as any).turnId || `turn-${now}`;
      const existing = this.historyTurnMap.get(turnId);
      const entry =
        existing ||
        ({
          id: turnId,
          startedAt: this.pendingTurnDraft.startedAt,
          userMessage: this.pendingTurnDraft.userMessage,
          plan: null,
          toolEvents: [],
        } as any);
      entry.plan = message.plan;
      this.historyTurnMap.set(turnId, entry);
    }

    return;
  }

  if (message.type === 'manual_plan_update') {
    this.applyManualPlanUpdate(message.steps);
    return;
  }

  if (message.type === 'tool_execution_start') {
    this.pendingToolCount += 1;
    this.clearErrorBanner();
    this.updateActivityState();
    this.activeToolName = message.tool || null;
    // Track which tab the model is interacting with.
    // Many browser tools resolve tabId internally via resolveTabId() so args.tabId
    // may be missing. Fall back to the session's active tab for known browser tools.
    const browserTools = ['navigate', 'openTab', 'click', 'type', 'pressKey', 'scroll',
      'getContent', 'screenshot', 'switchTab', 'focusTab', 'closeTab', 'watchVideo', 'getVideoInfo'];
    let toolTabId = typeof message.args?.tabId === 'number' ? message.args.tabId : null;
    if (!toolTabId && browserTools.includes(message.tool)) {
      toolTabId = this.sessionTabsState?.activeTabId ?? null;
    }
    this.setInteractingTab(toolTabId);
    if (!this.streamingState) {
      this.startStreamingMessage();
    }

    if (typeof (message as any).stepIndex === 'number') {
      this.ensureStepContainer((message as any).stepIndex, (message as any).stepTitle);
    }

    if (!this.isReplayingHistory && this.pendingTurnDraft?.userMessage) {
      const now = Date.now();
      const turnId = (message as any).turnId || `turn-${now}`;
      const existing = this.historyTurnMap.get(turnId);
      const entry =
        existing ||
        ({
          id: turnId,
          startedAt: this.pendingTurnDraft.startedAt,
          userMessage: this.pendingTurnDraft.userMessage,
          plan: this.currentPlan || null,
          toolEvents: [],
        } as any);
      entry.toolEvents.push({
        type: 'tool_execution_start',
        tool: message.tool,
        id: (message as any).id,
        args: (message as any).args,
        stepIndex: (message as any).stepIndex,
        stepTitle: (message as any).stepTitle,
        timestamp: (message as any).timestamp,
      });
      this.historyTurnMap.set(turnId, entry);
    }

    this.displayToolExecution(message.tool, message.args, null, message.id);
    return;
  }
  if (message.type === 'tool_execution_result') {
    this.pendingToolCount = Math.max(0, this.pendingToolCount - 1);
    this.updateActivityState();
    this.activeToolName = null;
    if (this.pendingToolCount === 0) {
      this.setInteractingTab(null);
    }
    if (!this.streamingState) {
      this.startStreamingMessage();
    }

    if (typeof (message as any).stepIndex === 'number') {
      this.ensureStepContainer((message as any).stepIndex, (message as any).stepTitle);
    }

    if (!this.isReplayingHistory && this.pendingTurnDraft?.userMessage) {
      const now = Date.now();
      const turnId = (message as any).turnId || `turn-${now}`;
      const existing = this.historyTurnMap.get(turnId);
      const entry =
        existing ||
        ({
          id: turnId,
          startedAt: this.pendingTurnDraft.startedAt,
          userMessage: this.pendingTurnDraft.userMessage,
          plan: this.currentPlan || null,
          toolEvents: [],
        } as any);
      entry.toolEvents.push({
        type: 'tool_execution_result',
        tool: message.tool,
        id: (message as any).id,
        args: (message as any).args,
        result: (message as any).result,
        stepIndex: (message as any).stepIndex,
        stepTitle: (message as any).stepTitle,
        timestamp: (message as any).timestamp,
      });
      this.historyTurnMap.set(turnId, entry);
    }

    this.displayToolExecution(message.tool, message.args, message.result, message.id);
    return;
  }

  if (message.type === 'assistant_final') {
    if (!this.isReplayingHistory && this.pendingTurnDraft?.userMessage) {
      const now = Date.now();
      const turnId = (message as any).turnId || `turn-${now}`;
      const existing = this.historyTurnMap.get(turnId);
      const entry =
        existing ||
        ({
          id: turnId,
          startedAt: this.pendingTurnDraft.startedAt,
          userMessage: this.pendingTurnDraft.userMessage,
          plan: this.currentPlan || null,
          toolEvents: [],
        } as any);
      entry.assistantFinal = {
        content: message.content,
        thinking: message.thinking || null,
        model: message.model || null,
        usage: (message as any).usage || null,
      };
      this.historyTurnMap.set(turnId, entry);
    }

    this.displayAssistantMessage(message.content, message.thinking, message.usage, message.model);
    this.appendContextMessages(message.responseMessages, message.content, message.thinking);
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

    return;
  }

  if (message.type === 'context_compacted') {
    this.handleContextCompaction(message);
    return;
  }

  if (message.type === 'run_error') {
    this.stopWatchdog?.();
    this.stopThinkingTimer?.();
    this.stopRunTimer?.();
    this.elements.composer?.classList.remove('running');
    this.pendingTurnDraft = null;
    this.pendingToolCount = 0;
    this.isStreaming = false;
    this.activeToolName = null;
    this.updateActivityState();
    this.finishStreamingMessage();
    this.showErrorBanner(message.message, {
      category: (message as any).errorCategory,
      action: (message as any).action,
    });
    this.updateStatus('Error', 'error');
    return;
  }
  if (message.type === 'run_warning') {
    this.showErrorBanner(message.message);
    return;
  }
  if (message.type === 'session_tabs_update') {
    this.handleSessionTabsUpdate(message);
    return;
  }
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

(SidePanelUI.prototype as any).appendContextMessages = function appendContextMessages(
  responseMessages?: Array<Record<string, unknown>>,
  fallbackContent?: string,
  fallbackThinking?: string | null,
) {
  if (!responseMessages || responseMessages.length === 0) {
    const assistantEntry = createMessage({
      role: 'assistant',
      content: fallbackContent || '',
      thinking: fallbackThinking || null,
    });
    if (assistantEntry) {
      this.contextHistory.push(assistantEntry);
    }
    return;
  }
  const normalized = normalizeConversationHistory(responseMessages as unknown as Message[]);
  this.contextHistory.push(...normalized);
};

(SidePanelUI.prototype as any).handleContextCompaction = function handleContextCompaction(message: any) {
  const trimmedCount = Number(message.trimmedCount || 0);
  const preservedCount = Number(message.preservedCount || 0);
  const percent = typeof message.contextUsage?.percent === 'number' ? Math.max(0, Math.min(100, Math.round(message.contextUsage.percent))) : null;
  const parts = [
    trimmedCount > 0 ? `${trimmedCount} summarized` : 'Context compacted',
    preservedCount > 0 ? `${preservedCount} preserved` : null,
    percent !== null ? `${percent}% after compaction` : null,
  ].filter(Boolean);
  if (parts.length > 0) {
    this.updateStatus(`Context compacted: ${parts.join(', ')}`, 'success');
  }

  const normalized = normalizeConversationHistory(message.contextMessages as unknown as Message[]);
  this.contextHistory = normalized;
  this.sessionId = message.newSessionId || this.sessionId;

  const summaryText = message.summary || 'Context compacted.';
  const summaryEntry = createMessage({
    role: 'system',
    content: summaryText,
    meta: {
      kind: 'summary',
      summaryOfCount: message.trimmedCount,
      source: 'auto',
    },
  });
  if (summaryEntry) {
    this.displayHistory.push(summaryEntry);
    this.displaySummaryMessage(summaryEntry);
  }

  if (message.contextUsage?.approxTokens) {
    this.updateContextUsage(message.contextUsage.approxTokens);
  }
};
