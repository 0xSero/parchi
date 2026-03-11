/**
 * Event Handler Module
 * Sets up all event listeners for the sidepanel UI
 */

import { isRuntimeMessage } from '@parchi/shared';
import { autoResizeTextArea, debounce } from './dom-utils.js';
import { bindSidebarNavigation } from './panel-navigation.js';
import { SidePanelUI } from './panel-ui.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Set up all event listeners for the sidepanel
 */
export const setupEventListeners = function setupEventListeners(this: SidePanelUI & Record<string, unknown>) {
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

  // Send button handler
  this.elements.sendBtn?.addEventListener('click', () => handleSendButtonClick.call(this));

  // Enter to send (Shift+Enter for newline), workflow menu gets priority
  this.elements.userInput?.addEventListener('keydown', (event: KeyboardEvent) => {
    if (this.workflowMenuOpen && this.handleWorkflowKeydown(event)) {
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendButtonClick.call(this);
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

sidePanelProto.setupEventListeners = setupEventListeners;

/**
 * Handle send button click - can queue, stop, or send message depending on state
 */
function handleSendButtonClick(this: SidePanelUI & Record<string, unknown>) {
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
