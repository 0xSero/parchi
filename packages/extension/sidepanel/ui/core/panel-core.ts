import { isRuntimeMessage } from '@parchi/shared';
import { createMessage, normalizeConversationHistory } from '../../../ai/message-schema.js';
import type { Message } from '../../../ai/message-schema.js';
import { appendTrace, pruneOldTraces } from '../chat/trace-store.js';
import { recordUsage } from '../settings/usage-store.js';
import { bindSidebarNavigation, setSidebarOpen } from './panel-navigation.js';
import { clampContextHistory, clearReportImages, clearToolCallViews } from './panel-session-memory.js';

const debounce = (fn: (...args: any[]) => void, ms: number) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};
import { SidePanelUI } from './panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

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
  textarea.style.overflowY =
    textarea.scrollHeight > resolvedMaxHeight || clampedHeight >= resolvedMaxHeight ? 'auto' : 'hidden';
};

const MAX_HISTORY_TURN_ENTRIES = 200;
const MAX_TOOL_EVENTS_PER_TURN = 160;
const MAX_TRACE_STRING_LENGTH = 4000;
const MAX_TRACE_ARRAY_ITEMS = 40;
const MAX_TRACE_OBJECT_KEYS = 60;

const clampHistoryTurnMap = (self: any) => {
  if (!self?.historyTurnMap || self.historyTurnMap.size <= MAX_HISTORY_TURN_ENTRIES) return;
  const overflow = self.historyTurnMap.size - MAX_HISTORY_TURN_ENTRIES;
  const keys = self.historyTurnMap.keys();
  for (let i = 0; i < overflow; i += 1) {
    const key = keys.next().value;
    if (key === undefined) break;
    self.historyTurnMap.delete(key);
  }
};

const capTurnToolEvents = (turnEntry: any) => {
  if (!turnEntry || !Array.isArray(turnEntry.toolEvents)) return;
  if (turnEntry.toolEvents.length <= MAX_TOOL_EVENTS_PER_TURN) return;
  turnEntry.toolEvents.splice(0, turnEntry.toolEvents.length - MAX_TOOL_EVENTS_PER_TURN);
};

const sanitizeTracePayload = (value: any, depth = 0): any => {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.startsWith('data:image/') || value.startsWith('data:application/octet-stream')) {
      return '[omitted dataUrl]';
    }
    if (value.length <= MAX_TRACE_STRING_LENGTH) return value;
    return `${value.slice(0, MAX_TRACE_STRING_LENGTH)}…`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'function') return undefined;
  if (depth > 5) return '[truncated]';
  if (Array.isArray(value)) {
    const cap = Math.min(value.length, MAX_TRACE_ARRAY_ITEMS);
    const out = new Array(cap);
    for (let i = 0; i < cap; i += 1) {
      out[i] = sanitizeTracePayload(value[i], depth + 1);
    }
    if (value.length > cap) {
      out.push(`[+${value.length - cap} items truncated]`);
    }
    return out;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: sanitizeTracePayload(value.stack || '', depth + 1),
    };
  }
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    let keysSeen = 0;
    for (const [key, raw] of Object.entries(value)) {
      keysSeen += 1;
      if (keysSeen > MAX_TRACE_OBJECT_KEYS) {
        out.__truncatedKeys = `[+${Object.keys(value).length - MAX_TRACE_OBJECT_KEYS} keys truncated]`;
        break;
      }
      const lower = key.toLowerCase();
      if (lower.includes('dataurl') || lower === 'dataurl' || lower.endsWith('base64')) {
        out[key] = '[omitted dataUrl]';
        continue;
      }
      if (lower === 'frames' && Array.isArray(raw)) {
        out[key] = { count: raw.length, omitted: true };
        continue;
      }
      out[key] = sanitizeTracePayload(raw, depth + 1);
    }
    return out;
  }
  return String(value);
};

sidePanelProto.init = async function init() {
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

sidePanelProto.connectLifecyclePort = function connectLifecyclePort() {
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

sidePanelProto.requestRunStop = function requestRunStop(note = 'Stopped') {
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

sidePanelProto.setupEventListeners = function setupEventListeners() {
  bindSidebarNavigation(this.elements, {
    onOpen: () => this.openSettingsPanel(),
    onClose: () => this.closeSidebar(),
  });

  const stopOnClose = () => {
    this.requestRunStop('Stopped (panel closed)');
  };
  window.addEventListener('pagehide', stopOnClose);
  window.addEventListener('beforeunload', () => {
    stopOnClose();
    this.autoSaveSessionJsonl?.();
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
  this.elements.historySearchInput?.addEventListener(
    'input',
    debounce(() => {
      const query = (this.elements.historySearchInput?.value || '').trim();
      this.filterHistoryList(query);
    }, 150),
  );

  const closeQuickActionsMenu = () => {
    this.elements.quickActionsMenu?.classList.add('hidden');
  };

  const closeComposerMoreMenu = () => {};

  // Composer tool buttons — direct click handlers with active state
  const setToolActive = (btn: HTMLButtonElement | null, active: boolean) => {
    btn?.classList.toggle('active', active);
  };

  this.elements.composerActionAttachFile?.addEventListener('click', () => {
    setToolActive(this.elements.composerActionAttachFile, true);
    this.elements.fileInput?.click();
    setTimeout(() => setToolActive(this.elements.composerActionAttachFile, false), 200);
  });
  this.elements.composerActionRecordContext?.addEventListener('click', () => {
    setToolActive(this.elements.composerActionRecordContext, true);
    this.elements.recordBtn?.click();
    setTimeout(() => setToolActive(this.elements.composerActionRecordContext, false), 200);
  });
  this.elements.composerActionSelectTabs?.addEventListener('click', () => {
    setToolActive(this.elements.composerActionSelectTabs, true);
    this.toggleTabSelector();
    setTimeout(() => setToolActive(this.elements.composerActionSelectTabs, false), 200);
  });
  this.elements.composerActionExport?.addEventListener('click', () => {
    setToolActive(this.elements.composerActionExport, true);
    this.showExportMenu();
    setTimeout(() => setToolActive(this.elements.composerActionExport, false), 200);
  });

  this.elements.quickActionsFab?.addEventListener('click', (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    const menu = this.elements.quickActionsMenu as HTMLElement | null;
    if (!menu) return;
    menu.classList.toggle('hidden');
    closeComposerMoreMenu();
  });
  this.elements.quickActionMissionControl?.addEventListener('click', () => {
    closeQuickActionsMenu();
    this.toggleMissionControl?.();
  });
  this.elements.quickActionSettings?.addEventListener('click', () => {
    closeQuickActionsMenu();
    this.openSettingsPanel?.();
  });
  this.elements.quickActionHistory?.addEventListener('click', () => {
    closeQuickActionsMenu();
    this.openHistoryDrawer();
  });
  this.elements.quickActionNewSession?.addEventListener('click', () => {
    closeQuickActionsMenu();
    this.startNewSession();
  });
  document.getElementById('quickActionResetProfiles')?.addEventListener('click', () => {
    closeQuickActionsMenu();
    this.resetAllProfiles?.();
  });

  // Balance popover on mascot click — status is shown inside mascot wrapper
  const mascotCorner = document.getElementById('mascotCorner');
  const mascotStatus = document.getElementById('mascotStatus');
  const balancePopover = document.getElementById('balancePopover');
  const balancePopoverClose = document.getElementById('balancePopoverClose');

  // Show/hide mascot status on hover
  if (mascotCorner && mascotStatus) {
    mascotCorner.addEventListener('mouseenter', () => {
      mascotStatus.classList.remove('hidden');
    });
    mascotCorner.addEventListener('mouseleave', () => {
      mascotStatus.classList.add('hidden');
    });
    mascotCorner.addEventListener('click', () => {
      this.toggleBalancePopover?.();
    });
  }

  if (balancePopover) {
    balancePopoverClose?.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      balancePopover.classList.add('hidden');
    });
    // Close popover when clicking outside
    document.addEventListener('click', (e: Event) => {
      const target = e.target as Node;
      const clickedMascot = mascotCorner?.contains(target) ?? false;
      if (!balancePopover.classList.contains('hidden') && !balancePopover.contains(target) && !clickedMascot) {
        balancePopover.classList.add('hidden');
      }
    });
  }

  this.elements.contextInspectorBtn?.addEventListener('click', (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    void this.toggleContextInspectorPopover?.();
  });

  this.elements.contextInspectorCloseBtn?.addEventListener('click', (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    this.closeContextInspectorPopover?.();
  });

  this.elements.contextInspectorCompactBtn?.addEventListener('click', (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    this.closeContextInspectorPopover?.();
    void this.requestManualContextCompaction?.();
  });

  document.addEventListener('click', (event: Event) => {
    const popover = this.elements.contextInspectorPopover as HTMLElement | null;
    const button = this.elements.contextInspectorBtn as HTMLElement | null;
    const target = event.target as Node | null;
    if (!popover || popover.classList.contains('hidden') || !target) return;
    if (popover.contains(target)) return;
    if (button?.contains(target)) return;
    this.closeContextInspectorPopover?.();
  });

  document.addEventListener('click', (event: Event) => {
    const target = event.target as Node | null;
    if (!target) return;
    const quickMenu = this.elements.quickActionsMenu as HTMLElement | null;
    const quickButton = this.elements.quickActionsFab as HTMLElement | null;
    if (quickMenu && !quickMenu.classList.contains('hidden')) {
      if (!quickMenu.contains(target) && !quickButton?.contains(target)) closeQuickActionsMenu();
    }
  });

  // Provider change — also refresh model catalog for setup tab
  const debouncedSetupModelRefresh = debounce(() => this.refreshModelCatalog({ force: true }), 800);
  this.elements.provider?.addEventListener('change', () => {
    this.toggleCustomEndpoint();
    this.updateScreenshotToggleState();
    debouncedSetupModelRefresh();
  });

  // Custom endpoint validation + model refresh
  this.elements.customEndpoint?.addEventListener('input', () => {
    this.validateCustomEndpoint();
    debouncedSetupModelRefresh();
  });
  this.elements.apiKey?.addEventListener('input', debouncedSetupModelRefresh);
  this.elements.model?.addEventListener('input', () => {
    if (!this.configs?.[this.currentConfig]) return;
    this.configs[this.currentConfig] = {
      ...this.configs[this.currentConfig],
      model: String(this.elements.model?.value || '').trim(),
    };
    this.populateModelSelect?.();
    this.updateModelDisplay?.();
  });

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

  this.elements.settingsTabProvidersBtn?.addEventListener('click', () => this.switchSettingsTab('providers'));
  this.elements.settingsTabModelBtn?.addEventListener('click', () => this.switchSettingsTab('model'));
  this.elements.settingsTabGenerationBtn?.addEventListener('click', () => this.switchSettingsTab('generation'));
  this.elements.settingsTabAdvancedBtn?.addEventListener('click', () => this.switchSettingsTab('advanced'));
  this.elements.settingsOpenAccountBtn?.addEventListener('click', () => this.openAccountPanel?.());
  this.elements.accountBackToSettingsBtn?.addEventListener('click', () => this.openSettingsPanel?.());
  document.getElementById('usageRefreshBtn')?.addEventListener('click', () => this.refreshUsageTab?.());
  document.getElementById('usageClearBtn')?.addEventListener('click', () => this.clearUsageData?.());
  this.elements.teamProfileList?.addEventListener('change', (event: Event) => {
    const input = event.target as HTMLInputElement | null;
    const profileName = input?.dataset.teamProfile;
    if (!profileName) return;
    this.toggleAuxProfile(profileName);
    void this.persistAllSettings?.({ silent: true });
    this.renderTeamProfileList?.();
  });

  // Screenshot + vision controls
  this.elements.enableScreenshots?.addEventListener('change', () => this.updateScreenshotToggleState());
  this.elements.visionProfile?.addEventListener('change', () => {
    this.updateScreenshotToggleState();
    this.updatePromptSections?.();
  });
  this.elements.sendScreenshotsAsImages?.addEventListener('change', () => this.updateScreenshotToggleState());
  this.elements.orchestratorToggle?.addEventListener('change', () => this.updatePromptSections?.());
  this.elements.orchestratorProfile?.addEventListener('change', () => this.updatePromptSections?.());

  // Visible orchestrator controls sync with hidden ones
  this.elements.orchestratorToggle?.addEventListener('change', () => {
    const enabled = this.elements.orchestratorToggle?.checked === true;
    const profileGroup = this.elements.orchestratorProfileSelectGroup as HTMLElement | null;
    if (profileGroup) profileGroup.style.display = enabled ? '' : 'none';
    this.updatePromptSections?.();
    this.renderTeamProfileList?.();
  });
  this.elements.orchestratorProfile?.addEventListener('change', () => {
    this.updatePromptSections?.();
  });

  // Auto-save sessions toggle
  this.elements.autoSaveSession?.addEventListener('change', () => {
    const enabled = this.elements.autoSaveSession?.value === 'true';
    const folderGroup = document.getElementById('autoSaveFolderGroup');
    if (folderGroup) folderGroup.style.display = enabled ? '' : 'none';
  });
  this.elements.autoSaveFolderBtn?.addEventListener('click', async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      this._autoSaveDirHandle = handle;
      if (this.elements.autoSaveFolderLabel) this.elements.autoSaveFolderLabel.textContent = handle.name;
    } catch {
      // User cancelled or API unavailable
    }
  });

  // Generation tab — live persistence
  const genPersist = () => this.updateActiveConfigFromGenerationTab?.();
  this.elements.genTemperature?.addEventListener('input', () => {
    if (this.elements.genTemperatureValue)
      this.elements.genTemperatureValue.textContent = Number(this.elements.genTemperature.value).toFixed(2);
    genPersist();
  });
  for (const id of ['genMaxTokens', 'genContextLimit', 'genTimeout', 'genScreenshotQuality'] as const) {
    this.elements[id]?.addEventListener('change', genPersist);
  }
  for (const id of [
    'genEnableScreenshots',
    'genSendScreenshots',
    'genStreamResponses',
    'genShowThinking',
    'genAutoScroll',
    'genConfirmActions',
    'genSaveHistory',
  ] as const) {
    this.elements[id]?.addEventListener('change', genPersist);
  }

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

  // Send message, queue, or stop depending on running state
  this.elements.sendBtn?.addEventListener('click', () => {
    const isRunning = this.elements.composer?.classList.contains('running');
    const hasText = this.elements.userInput?.value.trim();

    if (isRunning && hasText) {
      // Queue the message — it will send after the current turn completes
      this.queuedMessage = this.elements.userInput.value.trim();
      this.elements.userInput.value = '';
      this.elements.userInput.style.height = '';
      this.updateStatus('Message queued', 'active');
    } else if (isRunning) {
      // No text — stop the run
      this.requestRunStop('Stopped by user');
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
      this.queuedMessage = null;
      this.updateActivityState();
      this.finishStreamingMessage();
      this.clearErrorBanner?.();
      this.insertStoppedDivider();
      this.updateStatus('Stopped', 'warning');
    } else {
      this.sendMessage();
    }
  });

  // Enter to send (Shift+Enter for newline), workflow menu gets priority
  // When running: Enter queues the message (same as clicking the send button)
  this.elements.userInput?.addEventListener('keydown', (event: KeyboardEvent) => {
    if (this.workflowMenuOpen && this.handleWorkflowKeydown(event)) {
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const isRunning = this.elements.composer?.classList.contains('running');
      const hasText = this.elements.userInput?.value.trim();

      if (isRunning && hasText) {
        // Queue the message — it will send after the current turn completes
        this.queuedMessage = this.elements.userInput.value.trim();
        this.elements.userInput.value = '';
        this.elements.userInput.style.height = '';
        this.updateStatus('Message queued', 'active');
      } else if (isRunning) {
        // No text — stop the run
        this.requestRunStop('Stopped by user');
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
        this.queuedMessage = null;
        this.updateActivityState();
        this.finishStreamingMessage();
        this.clearErrorBanner?.();
        this.insertStoppedDivider();
        this.updateStatus('Stopped', 'warning');
      } else {
        this.sendMessage();
      }
    }
  });
  this.elements.userInput?.addEventListener('paste', (event: ClipboardEvent) => {
    const files = Array.from(event.clipboardData?.files || []) as File[];
    if (!files.length) return;
    event.preventDefault();
    void this.ingestFilesIntoComposer?.(files, 'paste');
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
  this.elements.setupAccessBtn?.addEventListener('click', () => {
    void this.handleSetupAccessClick?.();
  });

  // File upload
  this.elements.fileBtn?.addEventListener('click', () => {
    this.elements.fileInput?.click();
  });
  this.elements.fileInput?.addEventListener('change', (event) => this.handleFileSelection(event));

  // Recording
  this.elements.recordBtn?.addEventListener('click', () => {
    if (this.recordingState.status === 'idle') {
      this.startRecording();
    } else if (this.recordingState.status === 'recording') {
      this.stopRecording();
    }
  });
  this.elements.recordedContextRemove?.addEventListener('click', () => {
    this.removeRecordedContext();
  });

  // Zoom controls
  this.elements.zoomInBtn?.addEventListener('click', () => this.adjustUiZoom(0.05));
  this.elements.zoomOutBtn?.addEventListener('click', () => this.adjustUiZoom(-0.05));
  this.elements.zoomResetBtn?.addEventListener('click', () => this.applyUiZoom(1));
  this.elements.uiZoom?.addEventListener('input', () => {
    const value = Number.parseFloat(this.elements.uiZoom.value || '1');
    this.applyUiZoom(value);
  });
  this.elements.fontPreset?.addEventListener('change', () => {
    this.applyTypography(this.elements.fontPreset?.value || 'default', this.fontStylePreset || 'normal');
  });
  this.elements.fontStylePreset?.addEventListener('change', () => {
    this.applyTypography(this.fontPreset || 'default', this.elements.fontStylePreset?.value || 'normal');
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

  // Delegated click: copy button inside code blocks
  this.elements.chatMessages?.addEventListener('click', (e: Event) => {
    const btn = (e.target as HTMLElement).closest('.code-copy-btn') as HTMLButtonElement | null;
    if (!btn) return;
    const wrap = btn.closest('.code-block-wrap');
    const code = wrap?.querySelector('code');
    if (!code) return;
    navigator.clipboard.writeText(code.textContent || '').then(() => {
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 2000);
    });
  });
  this.elements.scrollToLatestBtn?.addEventListener('click', () => this.scrollToBottom({ force: true }));

  // Stop/reset is now handled by the send button above

  // Profile editor controls
  this.elements.profileEditorProvider?.addEventListener('change', () => {
    // Clear model fields whenever the provider changes so a stale model from a
    // previously-cloned or previously-edited profile never gets saved against
    // the wrong provider (e.g. gpt-4o saved under anthropic).
    const modelInput = this.elements.profileEditorModelInput as HTMLInputElement | null;
    const modelSelect = this.elements.profileEditorModel as HTMLSelectElement | null;
    if (modelInput) modelInput.value = '';
    if (modelSelect) modelSelect.value = '';
    this.toggleProfileEditorEndpoint();
    this.refreshModelCatalogForProfileEditor?.();
  });

  // Sync model text input to hidden select
  this.elements.profileEditorModelInput?.addEventListener('input', () => {
    const val = (this.elements.profileEditorModelInput?.value || '').trim();
    const select = this.elements.profileEditorModel as HTMLSelectElement | null;
    if (select) {
      if (val && !Array.from(select.options).some((o: HTMLOptionElement) => o.value === val)) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        select.insertBefore(opt, select.options[1] || null);
      }
      select.value = val;
    }
  });

  // Also refetch models when endpoint or API key changes (debounced)
  const debouncedModelRefresh = debounce(() => this.refreshModelCatalogForProfileEditor?.(), 800);
  this.elements.profileEditorEndpoint?.addEventListener('input', debouncedModelRefresh);
  this.elements.profileEditorApiKey?.addEventListener('input', debouncedModelRefresh);

  this.elements.profileEditorHeaders?.addEventListener('input', () => this.validateProfileEditorHeaders());
  this.elements.profileEditorTemperature?.addEventListener('input', () => {
    if (this.elements.profileEditorTemperatureValue) {
      this.elements.profileEditorTemperatureValue.textContent = this.elements.profileEditorTemperature.value;
    }
  });
  this.elements.saveProfileBtn?.addEventListener('click', () => this.saveProfileEdits());
  this.elements.profileEditorCancelBtn?.addEventListener('click', () =>
    this.editProfile(this.profileEditorTarget || this.currentConfig, true),
  );
  this.elements.refreshProfileJsonBtn?.addEventListener('click', () => this.refreshProfileJsonEditor());
  this.elements.copyProfileJsonBtn?.addEventListener('click', () => this.copyProfileJsonEditor());
  this.elements.applyProfileJsonBtn?.addEventListener('click', () => this.applyProfileJsonEditor());

  // Provider headers validation
  this.elements.customHeaders?.addEventListener('input', () => this.validateCustomHeaders());

  // Listen for messages from background
  chrome.runtime.onMessage.addListener((message) => {
    if (isRuntimeMessage(message)) {
      this.handleRuntimeMessage(message);
      return;
    }
    // Recording messages (not runtime messages — they have their own schema)
    const recordingTypes = ['recording_tick', 'recording_complete', 'recording_context_ready', 'recording_error'];
    if (message?.type && recordingTypes.includes(message.type)) {
      this.handleRecordingMessage?.(message);
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

sidePanelProto.setupResizeObserver = function setupResizeObserver() {
  if (!this.elements.chatMessages || typeof ResizeObserver === 'undefined') return;
  this.chatResizeObserver = new ResizeObserver(() => {
    if (this.shouldAutoScroll() && this.isNearBottom) {
      this.scrollToBottom();
    }
  });
  this.chatResizeObserver.observe(this.elements.chatMessages);
};

sidePanelProto.flushQueuedMessage = function flushQueuedMessage() {
  if (!this.queuedMessage) return;
  const msg = this.queuedMessage;
  this.queuedMessage = null;
  // Stuff the queued text into the input and send
  this.elements.userInput.value = msg;
  this.sendMessage();
};

sidePanelProto.startWatchdog = function startWatchdog() {
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

sidePanelProto.stopWatchdog = function stopWatchdog() {
  if (this._watchdogTimerId != null) {
    clearInterval(this._watchdogTimerId);
    this._watchdogTimerId = null;
  }
};

sidePanelProto.insertStoppedDivider = function insertStoppedDivider() {
  const el = document.createElement('div');
  el.className = 'stopped-divider';
  el.innerHTML = '<span>Stopped</span>';
  this.elements.chatMessages?.appendChild(el);
  this.scrollToBottom();
};

sidePanelProto.recoverFromStuckState = function recoverFromStuckState() {
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

sidePanelProto.handleRuntimeMessage = function handleRuntimeMessage(message: any) {
  this._lastRuntimeMessageAt = Date.now();
  if (message?.agentId && message.agentId !== 'main' && this.handleSubagentRuntimeMessage?.(message)) {
    return;
  }
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

  if (message.type === 'user_run_start') {
    this.streamingUsageEstimatedTokens = 0;
    this.streamingUsageEstimatedTokensApplied = 0;
    return;
  }

  if (message.type === 'run_status') {
    const phase = typeof message.phase === 'string' ? message.phase : '';
    const isCompactionStage = String((message as any).stage || '') === 'compaction';

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
      // Note: flushQueuedMessage is called from displayAssistantMessage for completed runs
    } else if (phase === 'planning' || phase === 'executing' || phase === 'finalizing') {
      // Surface non-terminal phases with retry counts
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
    return;
  }

  if (message.type === 'token_trace') {
    const action = typeof message.action === 'string' ? message.action : '';
    const reason = typeof message.reason === 'string' ? message.reason : '';
    const note = typeof message.note === 'string' ? message.note : '';
    const before = sanitizeTracePayload((message as any).before || null);
    const after = sanitizeTracePayload((message as any).after || null);
    const details = sanitizeTracePayload((message as any).details || null);

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

    return;
  }

  if (message.type === 'compaction_event') {
    const stage = typeof message.stage === 'string' ? message.stage : '';
    const note = typeof message.note === 'string' ? message.note : '';
    const source = typeof message.source === 'string' ? message.source : 'auto';
    const details =
      message.details && typeof message.details === 'object'
        ? (sanitizeTracePayload(message.details) as Record<string, unknown>)
        : {};

    this.setContextCompactionState?.({
      lastEvent: {
        stage,
        note: note || null,
        source,
        details,
        timestamp: Date.now(),
      },
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

      // Persist plan trace to IndexedDB
      appendTrace({
        sessionId: this.sessionId,
        ts: Date.now(),
        kind: 'plan_update',
        plan: message.plan,
      });
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
        args: sanitizeTracePayload((message as any).args),
        stepIndex: (message as any).stepIndex,
        stepTitle: (message as any).stepTitle,
        timestamp: (message as any).timestamp,
      });
      capTurnToolEvents(entry);
      this.historyTurnMap.set(turnId, entry);
      clampHistoryTurnMap(this);

      // Persist full trace to IndexedDB
      appendTrace({
        sessionId: this.sessionId,
        ts: Date.now(),
        kind: 'tool_start',
        tool: message.tool,
        toolId: (message as any).id,
        args: sanitizeTracePayload((message as any).args),
        stepIndex: (message as any).stepIndex,
        stepTitle: (message as any).stepTitle,
      });
    }

    this.displayToolExecution(message.tool, message.args, null, message.id);
    return;
  }
  if (message.type === 'tool_execution_result') {
    this.pendingToolCount = Math.max(0, this.pendingToolCount - 1);
    this.updateActivityState();
    this.activeToolName = null;
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
        args: sanitizeTracePayload((message as any).args),
        result: sanitizeTracePayload((message as any).result),
        stepIndex: (message as any).stepIndex,
        stepTitle: (message as any).stepTitle,
        timestamp: (message as any).timestamp,
      });
      capTurnToolEvents(entry);
      this.historyTurnMap.set(turnId, entry);
      clampHistoryTurnMap(this);

      // Persist full trace to IndexedDB
      appendTrace({
        sessionId: this.sessionId,
        ts: Date.now(),
        kind: 'tool_result',
        tool: message.tool,
        toolId: (message as any).id,
        args: sanitizeTracePayload((message as any).args),
        result: sanitizeTracePayload((message as any).result),
        stepIndex: (message as any).stepIndex,
        stepTitle: (message as any).stepTitle,
      });
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
      clampHistoryTurnMap(this);

      // Persist full trace to IndexedDB
      appendTrace({
        sessionId: this.sessionId,
        ts: Date.now(),
        kind: 'assistant_final',
        content: message.content,
        thinking: message.thinking || null,
        model: message.model || null,
        usage: (message as any).usage || null,
      });
    }

    this.displayAssistantMessage(message.content, message.thinking, message.usage, message.model);
    this.appendContextMessages(message.responseMessages, message.content, message.thinking);

    // Record usage to persistent local store
    if (message.usage && (message.usage.inputTokens || message.usage.outputTokens)) {
      const activeConfig = this.configs?.[this.currentConfig] || {};
      const usageModel = message.model || activeConfig.model || 'unknown';
      const usageProvider = activeConfig.provider || 'unknown';
      recordUsage(usageModel, usageProvider, {
        inputTokens: message.usage.inputTokens || 0,
        outputTokens: message.usage.outputTokens || 0,
      }).catch((err) => console.warn('[Parchi] recordUsage failed:', err));
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
    this.streamingUsageEstimatedTokens = 0;
    this.streamingUsageEstimatedTokensApplied = 0;
    this.updateActivityState();
    this.nullifyFinalizedToolData?.();
    this.finishStreamingMessage();
    this.showErrorBanner(message.message, {
      category: (message as any).errorCategory,
      action: (message as any).action,
      recoverable: (message as any).recoverable,
    });
    if (String((message as any).stage || '') === 'compaction') {
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
      detail: String((message as any).action || ''),
      category: String((message as any).errorCategory || ''),
    });
    this.updateStatus('Error', 'error');
    this.flushQueuedMessage?.();
    return;
  }
  if (message.type === 'run_warning') {
    const isCompactionWarning = String((message as any).stage || '') === 'compaction';
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
    return;
  }

  if (message.type === 'report_image_captured') {
    this.recordReportImage?.(message.image);
    this.updateReportImageSelection?.(message.selectedImageIds || []);
    return;
  }
  if (message.type === 'report_images_selection') {
    this.updateReportImageSelection?.(message.selectedImageIds || []);
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

sidePanelProto.appendContextMessages = function appendContextMessages(
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
      clampContextHistory(this.contextHistory);
    }
    return;
  }
  const normalized = normalizeConversationHistory(responseMessages as unknown as Message[]);
  this.contextHistory.push(...normalized);
  clampContextHistory(this.contextHistory);
};

sidePanelProto.handleContextCompaction = function handleContextCompaction(message: any) {
  const trimmedCount = Number(message.trimmedCount || 0);
  const preservedCount = Number(message.preservedCount || 0);
  const source = String(message.source || 'auto');
  const percent =
    typeof message.contextUsage?.percent === 'number'
      ? Math.max(0, Math.min(100, Math.round(message.contextUsage.percent)))
      : null;
  const beforePercent =
    typeof message.beforeContextUsage?.percent === 'number'
      ? Math.max(0, Math.min(100, Math.round(message.beforeContextUsage.percent)))
      : null;
  const parts = [
    trimmedCount > 0 ? `${trimmedCount} summarized` : 'Context compacted',
    preservedCount > 0 ? `${preservedCount} preserved` : null,
    beforePercent !== null && percent !== null ? `${beforePercent}% → ${percent}%` : null,
    beforePercent === null && percent !== null ? `${percent}% after compaction` : null,
  ].filter(Boolean);
  if (parts.length > 0) {
    this.updateStatus(`Context compacted: ${parts.join(', ')}`, 'success');
  }

  const normalized = normalizeConversationHistory(message.contextMessages as unknown as Message[]);
  this.contextHistory = normalized;
  clampContextHistory(this.contextHistory);
  this.sessionId = message.newSessionId || this.sessionId;
  if (message.startFreshSession === true) {
    this.displayHistory = [];
    this.elements.chatMessages.innerHTML = '';
    this.lastChatTurn = null;
    this.pendingTurnDraft = null;
    this.historyTurnMap.clear();
    this.currentPlan = null;
    this.hidePlanDrawer?.();
    clearToolCallViews(this.toolCallViews);
    clearReportImages(this.reportImages, this.reportImageOrder, this.selectedReportImageIds);
  }

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

  if (typeof message.contextUsage?.approxTokens === 'number') {
    this.updateContextUsage(message.contextUsage.approxTokens);
  }

  this.setContextCompactionState?.({
    inProgress: false,
    lastResult: 'success',
    lastMessage: parts.join(', '),
    lastTrimmedCount: trimmedCount,
    lastPreservedCount: preservedCount,
    lastSource: source,
    lastCompactedAt: Date.now(),
    lastCompletedAt: Date.now(),
    lastBeforePercent: beforePercent,
    lastAfterPercent: percent,
    lastMetrics:
      message.compactionMetrics && typeof message.compactionMetrics === 'object'
        ? (sanitizeTracePayload(message.compactionMetrics) as Record<string, unknown>)
        : null,
  });

  void appendTrace({
    sessionId: this.sessionId,
    ts: Date.now(),
    kind: 'compaction_event',
    stage: 'applied',
    source,
    note: parts.join(', '),
    details: sanitizeTracePayload({
      trimmedCount,
      preservedCount,
      beforeContextUsage: message.beforeContextUsage,
      contextUsage: message.contextUsage,
      metrics: message.compactionMetrics,
    }),
  }).finally(() => {
    if (this.isContextInspectorPopoverOpen?.()) {
      void this.refreshContextInspectorLog?.();
    }
  });

  // Trigger compaction sweep animation on the context bar
  const bar = document.getElementById('contextBar');
  if (bar) {
    bar.classList.remove('compacting');
    // Force reflow so re-adding the class restarts the animation
    void bar.offsetWidth;
    bar.classList.add('compacting');
    bar.addEventListener('animationend', () => bar.classList.remove('compacting'), { once: true });
  }

  // Auto-continue: if compaction was triggered automatically at end of turn,
  // send a continuation prompt so the model resumes with the compacted context.
  if (source === 'auto' && !this.elements.composer?.classList.contains('running')) {
    setTimeout(() => {
      this.elements.userInput.value =
        'Continue where you left off. The context was compacted — use the summary above as your source of truth.';
      this.sendMessage();
    }, 400);
  }
};
