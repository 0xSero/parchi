import { DEFAULT_AGENT_SYSTEM_PROMPT } from '../../../../shared/src/prompts.js';
import { PARCHI_STORAGE_KEYS } from '../../../../shared/src/settings.js';
import { SidePanelUI } from '../core/panel-ui.js';
import { THEMES, DEFAULT_THEME_ID, applyTheme } from './themes.js';

const parseHeadersJson = (raw: string): Record<string, string> => {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Headers must be a JSON object');
  }
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, value == null ? '' : String(value)]));
};

(SidePanelUI.prototype as any).applyUiZoom = function applyUiZoom(value: number, { persist = true } = {}) {
  const next = Number.isFinite(value) ? value : 1;
  const clamped = Math.min(1.25, Math.max(0.85, next));
  this.uiZoom = clamped;
  document.documentElement.style.setProperty('--ui-zoom', String(clamped));
  if (this.elements.uiZoom) this.elements.uiZoom.value = clamped.toFixed(2);
  if (this.elements.uiZoomValue) this.elements.uiZoomValue.textContent = `${Math.round(clamped * 100)}%`;
  if (persist) {
    chrome.storage.local.set({ uiZoom: clamped }).catch(() => { });
  }
};

(SidePanelUI.prototype as any).adjustUiZoom = function adjustUiZoom(delta: number) {
  const next = (this.uiZoom || 1) + delta;
  this.applyUiZoom(next);
};

(SidePanelUI.prototype as any).cancelSettings = async function cancelSettings() {
  await this.loadSettings();
  this.openChatView?.();
};

(SidePanelUI.prototype as any).toggleCustomEndpoint = function toggleCustomEndpoint() {
  const provider = this.elements.provider?.value;
  const isCustom = provider === 'custom' || provider === 'kimi';

  // Always show the endpoint field, but highlight when required
  if (this.elements.customEndpointGroup) {
    // Add visual emphasis when custom provider selected
    this.elements.customEndpointGroup.classList.toggle('required', isCustom);
  }

  // Update placeholder based on provider
  if (this.elements.customEndpoint) {
    if (provider === 'kimi') {
      if (
        !this.elements.customEndpoint.value ||
        this.elements.customEndpoint.value === 'https://openrouter.ai/api/v1'
      ) {
        this.elements.customEndpoint.value = 'https://api.kimi.com/coding';
      }
      this.elements.customEndpoint.placeholder = 'https://api.kimi.com/coding';
    } else if (isCustom) {
      this.elements.customEndpoint.placeholder = 'https://openrouter.ai/api/v1';
    } else {
      this.elements.customEndpoint.placeholder = 'Leave empty for default API URL';
    }
  }

  // Update model hint based on provider
  const modelHint = document.getElementById('modelHint');
  if (modelHint) {
    switch (provider) {
      case 'anthropic':
        modelHint.textContent = 'Recommended: claude-sonnet-4-20250514';
        break;
      case 'openai':
        modelHint.textContent = 'Recommended: gpt-4o or gpt-4-turbo';
        break;
      case 'google':
        modelHint.textContent = 'Recommended: gemini-3-flash';
        break;
      case 'kimi':
        modelHint.textContent = 'Recommended: kimi-for-coding (or your Kimi model ID)';
        break;
      case 'custom':
        modelHint.textContent = 'Enter the model ID from your provider';
        break;
      default:
        modelHint.textContent = '';
    }
  }
};

(SidePanelUI.prototype as any).validateCustomEndpoint = function validateCustomEndpoint() {
  if (!this.elements.customEndpoint) return true;
  const url = this.elements.customEndpoint.value.trim();
  if (!url) return true;
  try {
    new URL(url);
    this.elements.customEndpoint.style.borderColor = '';
    return true;
  } catch {
    this.elements.customEndpoint.style.borderColor = 'var(--status-error)';
    return false;
  }
};

(SidePanelUI.prototype as any).validateCustomHeaders = function validateCustomHeaders() {
  if (!this.elements.customHeaders) return true;
  const raw = this.elements.customHeaders.value || '';
  if (!raw.trim()) {
    this.elements.customHeaders.style.borderColor = '';
    return true;
  }
  try {
    parseHeadersJson(raw);
    this.elements.customHeaders.style.borderColor = '';
    return true;
  } catch {
    this.elements.customHeaders.style.borderColor = 'var(--status-error)';
    return false;
  }
};

(SidePanelUI.prototype as any).validateProfileEditorHeaders = function validateProfileEditorHeaders() {
  if (!this.elements.profileEditorHeaders) return true;
  const raw = this.elements.profileEditorHeaders.value || '';
  if (!raw.trim()) {
    this.elements.profileEditorHeaders.style.borderColor = '';
    return true;
  }
  try {
    parseHeadersJson(raw);
    this.elements.profileEditorHeaders.style.borderColor = '';
    return true;
  } catch {
    this.elements.profileEditorHeaders.style.borderColor = 'var(--status-error)';
    return false;
  }
};

(SidePanelUI.prototype as any).toggleProfileEditorEndpoint = function toggleProfileEditorEndpoint() {
  if (!this.elements.profileEditorEndpointGroup) return;
  const provider = this.elements.profileEditorProvider?.value;
  this.elements.profileEditorEndpointGroup.style.display =
    provider === 'custom' || provider === 'kimi' ? 'block' : 'none';
};

(SidePanelUI.prototype as any).switchSettingsTab = function switchSettingsTab(
  tabName: 'setup' | 'oauth' | 'model' | 'browser' | 'network' | 'prompt' | 'profiles' = 'setup',
) {
  // Persist current form state when leaving setup tab
  if (this.currentSettingsTab === 'setup' && tabName !== 'setup') {
    this.configs[this.currentConfig] = this.collectCurrentFormProfile();
    void this.persistAllSettings({ silent: true });
  }
  this.currentSettingsTab = tabName;

  const tabs = ['setup', 'oauth', 'model', 'browser', 'network', 'prompt', 'profiles'] as const;
  const tabElements: Record<string, HTMLElement | null> = {
    setup: this.elements.settingsTabSetup,
    oauth: this.elements.settingsTabOauth,
    model: this.elements.settingsTabModel,
    browser: this.elements.settingsTabBrowser,
    network: this.elements.settingsTabNetwork,
    prompt: this.elements.settingsTabPrompt,
    profiles: this.elements.settingsTabProfiles,
  };
  const btnElements: Record<string, HTMLElement | null> = {
    setup: this.elements.settingsTabSetupBtn,
    oauth: this.elements.settingsTabOauthBtn,
    model: this.elements.settingsTabModelBtn,
    browser: this.elements.settingsTabBrowserBtn,
    network: this.elements.settingsTabNetworkBtn,
    prompt: this.elements.settingsTabPromptBtn,
    profiles: this.elements.settingsTabProfilesBtn,
  };

  for (const tab of tabs) {
    const isActive = tab === tabName;
    tabElements[tab]?.classList.toggle('hidden', !isActive);
    btnElements[tab]?.classList.toggle('active', isActive);
    // Activate the pane inside the tab container
    const pane = tabElements[tab]?.querySelector('.settings-tab-pane') as HTMLElement | null;
    pane?.classList.toggle('active', isActive);
  }
};

(SidePanelUI.prototype as any).createProfileFromInput = function createProfileFromInput() {
  const name = (this.elements.newProfileNameInput?.value || '').trim();
  if (!name) {
    this.updateStatus('Enter a profile name first', 'warning');
    return;
  }
  if (this.configs[name]) {
    this.updateStatus('Profile already exists', 'warning');
    return;
  }
  if (this.elements.newProfileNameInput) this.elements.newProfileNameInput.value = '';
  this.createNewConfig(name);
  this.editProfile(name, true);
};

(SidePanelUI.prototype as any).loadSettings = async function loadSettings() {
  let settings: Record<string, any> = {};
  try {
    settings = await chrome.storage.local.get(PARCHI_STORAGE_KEYS as unknown as string[]);
  } catch (error) {
    console.error('[Parchi] Failed to load settings from storage:', error);
    this.updateStatus('Failed to load settings', 'error');
  }

  const storedConfigs = settings.configs || {};
  const baseConfig = {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o',
    customEndpoint: '',
    extraHeaders: {},
    systemPrompt: this.getDefaultSystemPrompt(),
    temperature: 0.7,
    maxTokens: 4096,
    contextLimit: 200000,
    timeout: 30000,
    sendScreenshotsAsImages: false,
    screenshotQuality: 'high',
    showThinking: true,
    streamResponses: true,
    autoScroll: true,
    confirmActions: true,
    saveHistory: true,
    enableScreenshots: true,
  };

  this.configs = {
    default: { ...baseConfig, ...(storedConfigs.default || {}) },
    ...storedConfigs,
  };
  this.currentConfig = this.configs[settings.activeConfig] ? settings.activeConfig : 'default';
  this.auxAgentProfiles = settings.auxAgentProfiles || [];
  this.applyUiZoom(settings.uiZoom ?? 1, { persist: false });
  this.currentTheme = settings.theme || DEFAULT_THEME_ID;
  applyTheme(this.currentTheme);
  this.renderThemeGrid?.();

  if (this.elements.visionBridge)
    this.elements.visionBridge.value = settings.visionBridge !== undefined ? String(settings.visionBridge) : 'true';
  if (this.elements.visionProfile) this.elements.visionProfile.value = settings.visionProfile || '';
  if (this.elements.orchestratorToggle)
    this.elements.orchestratorToggle.value =
      settings.useOrchestrator !== undefined ? String(settings.useOrchestrator) : 'false';
  if (this.elements.orchestratorProfile) this.elements.orchestratorProfile.value = settings.orchestratorProfile || '';
  if (this.elements.showThinking)
    this.elements.showThinking.value = settings.showThinking !== undefined ? String(settings.showThinking) : 'true';
  if (this.elements.streamResponses)
    this.elements.streamResponses.value =
      settings.streamResponses !== undefined ? String(settings.streamResponses) : 'true';
  if (this.elements.autoScroll)
    this.elements.autoScroll.value = settings.autoScroll !== undefined ? String(settings.autoScroll) : 'true';
  if (this.elements.confirmActions)
    this.elements.confirmActions.value =
      settings.confirmActions !== undefined ? String(settings.confirmActions) : 'true';
  if (this.elements.saveHistory)
    this.elements.saveHistory.value = settings.saveHistory !== undefined ? String(settings.saveHistory) : 'true';
  this.timelineCollapsed = settings.timelineCollapsed !== undefined ? settings.timelineCollapsed !== false : true;

  if (this.elements.relayEnabled)
    this.elements.relayEnabled.value = settings.relayEnabled !== undefined ? String(settings.relayEnabled) : 'false';
  if (this.elements.relayUrl) this.elements.relayUrl.value = settings.relayUrl || 'http://127.0.0.1:17373';
  if (this.elements.relayToken) this.elements.relayToken.value = settings.relayToken || '';
  this.updateRelayStatusFromSettings?.(settings);

  const defaultPermissions = {
    read: true,
    interact: true,
    navigate: true,
    tabs: true,
    screenshots: true,
  };
  const toolPermissions = {
    ...defaultPermissions,
    ...(settings.toolPermissions || {}),
  };
  this.toolPermissions = toolPermissions;
  if (this.elements.permissionRead) this.elements.permissionRead.value = String(toolPermissions.read);
  if (this.elements.permissionInteract) this.elements.permissionInteract.value = String(toolPermissions.interact);
  if (this.elements.permissionNavigate) this.elements.permissionNavigate.value = String(toolPermissions.navigate);
  if (this.elements.permissionTabs) this.elements.permissionTabs.value = String(toolPermissions.tabs);
  if (this.elements.permissionScreenshots)
    this.elements.permissionScreenshots.value = String(toolPermissions.screenshots);
  if (this.elements.allowedDomains) this.elements.allowedDomains.value = settings.allowedDomains || '';

  this.refreshConfigDropdown();
  this.setActiveConfig(this.currentConfig, true);
  this.toggleCustomEndpoint();
  this.updateScreenshotToggleState();
  this.editProfile(this.currentConfig, true);
  this.updatePromptSections?.();
  await this.refreshAccountPanel?.({ silent: true });
};

(SidePanelUI.prototype as any).updateRelayStatusFromSettings = function updateRelayStatusFromSettings(
  settings: Record<string, any> = {},
) {
  const connected = settings.relayConnected === true;
  if (this.elements.relayConnectedBadge) {
    this.elements.relayConnectedBadge.textContent = connected ? 'Connected' : 'Disconnected';
    this.elements.relayConnectedBadge.classList.toggle('connected', connected);
  }
  if (this.elements.relayLastErrorText) {
    const raw = settings.relayLastError;
    this.elements.relayLastErrorText.textContent = raw ? String(raw) : '';
  }
};

(SidePanelUI.prototype as any).saveSettings = async function saveSettings() {
  if (
    (this.elements.provider?.value === 'custom' || this.elements.provider?.value === 'kimi') &&
    !this.validateCustomEndpoint()
  ) {
    this.updateStatus('Invalid custom endpoint URL', 'error');
    return;
  }
  if (!this.validateCustomHeaders()) {
    this.updateStatus('Invalid headers JSON', 'error');
    return;
  }
  const profile = this.collectCurrentFormProfile();
  this.configs[this.currentConfig] = profile;
  this.savePromptSections?.();
  await this.persistAllSettings();

  // Refresh models after saving settings
  this.fetchAvailableModels();

  this.updateStatus('Settings saved successfully', 'success');
};

(SidePanelUI.prototype as any).exportSettings = async function exportSettings() {
  try {
    const settings = await chrome.storage.local.get(PARCHI_STORAGE_KEYS as unknown as string[]);
    const payload = {
      ...settings,
      exportedAt: new Date().toISOString(),
      exportVersion: 1,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `parchi-settings-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.updateStatus('Settings export downloaded', 'success');
  } catch (error) {
    this.updateStatus('Unable to export settings', 'error');
  }
};

(SidePanelUI.prototype as any).importSettings = async function importSettings(event: Event) {
  const input = event?.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const payload: Record<string, any> = {};
    (PARCHI_STORAGE_KEYS as unknown as string[]).forEach((key) => {
      if (data[key] !== undefined) {
        payload[key] = data[key];
      }
    });
    if (payload.configs && typeof payload.configs !== 'object') {
      throw new Error('Invalid configs payload');
    }
    await chrome.storage.local.set(payload);
    await this.loadSettings();
    this.renderProfileGrid();
    this.updateStatus('Settings imported successfully', 'success');
  } catch (error) {
    this.updateStatus('Unable to import settings', 'error');
  } finally {
    if (input) input.value = '';
  }
};

(SidePanelUI.prototype as any).collectCurrentFormProfile = function collectCurrentFormProfile() {
  const current = this.configs[this.currentConfig] || {};
  let extraHeaders = current.extraHeaders || {};
  if (this.elements.customHeaders) {
    const raw = this.elements.customHeaders.value || '';
    if (raw.trim().length > 0) {
      try {
        extraHeaders = parseHeadersJson(raw);
      } catch {
        extraHeaders = current.extraHeaders || {};
      }
    } else {
      extraHeaders = {};
    }
  }
  return {
    provider: this.elements.provider?.value || current.provider || 'openai',
    apiKey: this.elements.apiKey?.value || current.apiKey || '',
    model: this.elements.model?.value || current.model || 'gpt-4o',
    customEndpoint: this.elements.customEndpoint?.value || current.customEndpoint || '',
    extraHeaders,
    systemPrompt: this.elements.systemPrompt?.value || current.systemPrompt || '',
    temperature: Number.parseFloat(this.elements.temperature?.value) || current.temperature || 0.7,
    maxTokens: Number.parseInt(this.elements.maxTokens?.value) || current.maxTokens || 4096,
    contextLimit: Number.parseInt(this.elements.contextLimit?.value) || current.contextLimit || 200000,
    timeout: Number.parseInt(this.elements.timeout?.value) || current.timeout || 30000,
    enableScreenshots: this.elements.enableScreenshots?.value === 'true' || current.enableScreenshots || false,
    sendScreenshotsAsImages:
      this.elements.sendScreenshotsAsImages?.value === 'true' || current.sendScreenshotsAsImages || false,
    screenshotQuality: this.elements.screenshotQuality?.value || current.screenshotQuality || 'high',
    showThinking: this.elements.showThinking?.value === 'true',
    streamResponses: this.elements.streamResponses?.value === 'true',
    autoScroll: this.elements.autoScroll?.value === 'true',
    confirmActions: this.elements.confirmActions?.value === 'true',
    saveHistory: this.elements.saveHistory?.value === 'true',
  };
};

(SidePanelUI.prototype as any).collectToolPermissions = function collectToolPermissions() {
  const fallback = this.toolPermissions || {
    read: true,
    interact: true,
    navigate: true,
    tabs: true,
    screenshots: true,
  };
  return {
    read: this.elements.permissionRead ? this.elements.permissionRead.value !== 'false' : fallback.read !== false,
    interact: this.elements.permissionInteract
      ? this.elements.permissionInteract.value !== 'false'
      : fallback.interact !== false,
    navigate: this.elements.permissionNavigate
      ? this.elements.permissionNavigate.value !== 'false'
      : fallback.navigate !== false,
    tabs: this.elements.permissionTabs ? this.elements.permissionTabs.value !== 'false' : fallback.tabs !== false,
    screenshots: this.elements.permissionScreenshots
      ? this.elements.permissionScreenshots.value === 'true'
      : fallback.screenshots !== false,
  };
};

(SidePanelUI.prototype as any).persistAllSettings = async function persistAllSettings({ silent = false } = {}) {
  try {
    const activeProfile = this.configs[this.currentConfig] || {};
    const rawRelayUrl = (this.elements.relayUrl?.value || '').trim();
    const normalizedRelayUrl = rawRelayUrl && !rawRelayUrl.includes('://') ? `http://${rawRelayUrl}` : rawRelayUrl;
    const payload = {
      provider: activeProfile.provider || 'openai',
      apiKey: activeProfile.apiKey || '',
      model: activeProfile.model || 'gpt-4o',
      customEndpoint: activeProfile.customEndpoint || '',
      extraHeaders: activeProfile.extraHeaders || {},
      systemPrompt: activeProfile.systemPrompt || this.getDefaultSystemPrompt(),
      temperature: activeProfile.temperature ?? 0.7,
      maxTokens: activeProfile.maxTokens || 4096,
      contextLimit: activeProfile.contextLimit || 200000,
      timeout: activeProfile.timeout || 30000,
      enableScreenshots: activeProfile.enableScreenshots ?? false,
      sendScreenshotsAsImages: activeProfile.sendScreenshotsAsImages ?? false,
      screenshotQuality: activeProfile.screenshotQuality || 'high',
      showThinking: activeProfile.showThinking !== false,
      streamResponses: activeProfile.streamResponses !== false,
      autoScroll: activeProfile.autoScroll !== false,
      confirmActions: activeProfile.confirmActions !== false,
      saveHistory: activeProfile.saveHistory !== false,
      visionBridge: this.elements.visionBridge?.value === 'true',
      visionProfile: this.elements.visionProfile?.value || '',
      useOrchestrator: this.elements.orchestratorToggle?.value === 'true',
      orchestratorProfile: this.elements.orchestratorProfile?.value || '',
      toolPermissions: this.collectToolPermissions(),
      allowedDomains: this.elements.allowedDomains?.value || '',
      auxAgentProfiles: this.auxAgentProfiles,
      uiZoom: this.uiZoom ?? 1,
      theme: this.currentTheme || DEFAULT_THEME_ID,
      relayEnabled: this.elements.relayEnabled?.value === 'true',
      relayUrl: normalizedRelayUrl,
      relayToken: this.elements.relayToken?.value || '',
      activeConfig: this.currentConfig,
      configs: this.configs,
    };
    await chrome.storage.local.set(payload);
    this.updateContextUsage();
    if (!silent) {
      this.updateStatus('Settings saved successfully', 'success');
    }
  } catch (error) {
    console.error('[Parchi] persistAllSettings error:', error);
    if (!silent) {
      this.updateStatus('Failed to save settings', 'error');
    }
    throw error;
  }
};

(SidePanelUI.prototype as any).getDefaultSystemPrompt = function getDefaultSystemPrompt() {
  return DEFAULT_AGENT_SYSTEM_PROMPT;
};

(SidePanelUI.prototype as any).renderThemeGrid = function renderThemeGrid() {
  const grid = this.elements.themeGrid;
  if (!grid) return;
  grid.innerHTML = '';
  for (const theme of THEMES) {
    const swatch = document.createElement('button');
    swatch.className = 'theme-swatch';
    if (theme.id === this.currentTheme) swatch.classList.add('active');
    swatch.title = theme.name;
    swatch.dataset.themeId = theme.id;
    swatch.innerHTML = `
      <span class="theme-swatch-color" style="background:${theme.preview.bg}; border-color:${theme.preview.accent}">
        <span class="theme-swatch-accent" style="background:${theme.preview.accent}"></span>
      </span>
      <span class="theme-swatch-label">${theme.name}</span>
    `;
    swatch.addEventListener('click', () => this.setTheme(theme.id));
    grid.appendChild(swatch);
  }
};

(SidePanelUI.prototype as any).setTheme = function setTheme(id: string) {
  this.currentTheme = id;
  applyTheme(id);
  this.renderThemeGrid();
  chrome.storage.local.set({ theme: id }).catch(() => { });
};

(SidePanelUI.prototype as any).updateScreenshotToggleState = function updateScreenshotToggleState() {
  if (!this.elements.enableScreenshots) return;
  const wantsScreens = this.elements.enableScreenshots.value === 'true';
  const visionProfile = this.elements.visionProfile?.value;
  const provider = this.elements.provider?.value;
  const hasVision = (provider && provider !== 'custom') || visionProfile;
  const controls = [this.elements.sendScreenshotsAsImages, this.elements.screenshotQuality];
  controls.forEach((ctrl) => {
    if (!ctrl) return;
    ctrl.disabled = !wantsScreens;
    ctrl.parentElement?.classList.toggle('disabled', !wantsScreens);
  });
  if (wantsScreens && !hasVision) {
    this.updateStatus('Enable a vision-capable profile before sending screenshots.', 'warning');
  }
};

/* ============================================================================
   Orchestrator / Vision prompt sections in Prompt tab
   ============================================================================ */

(SidePanelUI.prototype as any).updatePromptSections = function updatePromptSections() {
  // Re-query elements in case they weren't available at constructor time (loaded via template)
  const orchSection = this.elements.orchestratorPromptSection || document.getElementById('orchestratorPromptSection');
  const orchTextarea = this.elements.orchestratorPromptTextarea || document.getElementById('orchestratorPromptTextarea') as HTMLTextAreaElement | null;
  const visSection = this.elements.visionPromptSection || document.getElementById('visionPromptSection');
  const visTextarea = this.elements.visionPromptTextarea || document.getElementById('visionPromptTextarea') as HTMLTextAreaElement | null;

  // Cache
  if (orchSection) this.elements.orchestratorPromptSection = orchSection;
  if (orchTextarea) this.elements.orchestratorPromptTextarea = orchTextarea;
  if (visSection) this.elements.visionPromptSection = visSection;
  if (visTextarea) this.elements.visionPromptTextarea = visTextarea;

  // Orchestrator
  const orchEnabled = this.elements.orchestratorToggle?.value === 'true';
  const orchProfileName = this.elements.orchestratorProfile?.value || this.currentConfig;
  if (orchSection) {
    orchSection.classList.toggle('hidden', !orchEnabled);
  }
  if (orchEnabled && orchTextarea) {
    const orchProfile = this.configs[orchProfileName] || {};
    orchTextarea.value = orchProfile.systemPrompt || '';
  }

  // Vision
  const visProfileName = this.elements.visionProfile?.value;
  const visEnabled = !!visProfileName && visProfileName !== '' && visProfileName !== this.currentConfig;
  if (visSection) {
    visSection.classList.toggle('hidden', !visEnabled);
  }
  if (visEnabled && visTextarea) {
    const visProfile = this.configs[visProfileName] || {};
    visTextarea.value = visProfile.systemPrompt || '';
  }
};

(SidePanelUI.prototype as any).savePromptSections = function savePromptSections() {
  // Save orchestrator prompt back to its profile
  const orchEnabled = this.elements.orchestratorToggle?.value === 'true';
  if (orchEnabled && this.elements.orchestratorPromptTextarea) {
    const orchProfileName = this.elements.orchestratorProfile?.value || this.currentConfig;
    if (this.configs[orchProfileName]) {
      this.configs[orchProfileName].systemPrompt = this.elements.orchestratorPromptTextarea.value || '';
    }
  }

  // Save vision prompt back to its profile
  const visProfileName = this.elements.visionProfile?.value;
  if (visProfileName && visProfileName !== this.currentConfig && this.elements.visionPromptTextarea) {
    if (this.configs[visProfileName]) {
      this.configs[visProfileName].systemPrompt = this.elements.visionPromptTextarea.value || '';
    }
  }
};
