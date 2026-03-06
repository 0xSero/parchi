import { DEFAULT_AGENT_SYSTEM_PROMPT } from '@parchi/shared';
import {
  buildSettingsStoreExport,
  hydrateSettingsStore,
  importSettingsToStore,
  patchSettingsStoreSnapshot,
  replaceSettingsStoreSnapshot,
} from '../../../state/stores/settings-store.js';
import { SidePanelUI } from '../core/panel-ui.js';
import { getPreferredRunnableProfileName, isRunnableProfileConfig, syncOAuthProfiles } from './oauth-profiles.js';
import { DEFAULT_THEME_ID, THEMES, applyTheme } from './themes.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

const parseHeadersJson = (raw: string): Record<string, string> => {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Headers must be a JSON object');
  }
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, value == null ? '' : String(value)]));
};

const FONT_PRESET_STACKS: Record<string, string> = {
  default: 'var(--font-sans-default)',
  geist: 'var(--font-sans-geist)',
  soft: 'var(--font-sans-soft)',
  'dm-sans': 'var(--font-sans-dm)',
  plex: 'var(--font-sans-plex)',
  manrope: 'var(--font-sans-manrope)',
};

const FONT_STYLE_WEIGHTS: Record<string, string> = {
  normal: '400',
  medium: '500',
  semibold: '600',
};

sidePanelProto.applyUiZoom = function applyUiZoom(value: number, { persist = true } = {}) {
  const next = Number.isFinite(value) ? value : 1;
  const clamped = Math.min(1.25, Math.max(0.85, next));
  this.uiZoom = clamped;
  document.documentElement.style.setProperty('--ui-zoom', String(clamped));
  if (this.elements.uiZoom) this.elements.uiZoom.value = clamped.toFixed(2);
  if (this.elements.uiZoomValue) this.elements.uiZoomValue.textContent = `${Math.round(clamped * 100)}%`;
  if (persist) {
    void patchSettingsStoreSnapshot({ uiZoom: clamped }).catch(() => {});
  }
};

sidePanelProto.applyTypography = function applyTypography(preset: string, style: string, { persist = true } = {}) {
  const nextPreset = FONT_PRESET_STACKS[preset] ? preset : 'default';
  const nextStyle = FONT_STYLE_WEIGHTS[style] ? style : 'normal';
  this.fontPreset = nextPreset;
  this.fontStylePreset = nextStyle;
  document.documentElement.style.setProperty('--font-sans', FONT_PRESET_STACKS[nextPreset]);
  document.documentElement.style.setProperty('--font-base-weight', FONT_STYLE_WEIGHTS[nextStyle]);
  if (this.elements.fontPreset) this.elements.fontPreset.value = nextPreset;
  if (this.elements.fontStylePreset) this.elements.fontStylePreset.value = nextStyle;
  if (persist) {
    void patchSettingsStoreSnapshot({ fontPreset: nextPreset, fontStylePreset: nextStyle }).catch(() => {});
  }
};

sidePanelProto.adjustUiZoom = function adjustUiZoom(delta: number) {
  const next = (this.uiZoom || 1) + delta;
  this.applyUiZoom(next);
};

sidePanelProto.cancelSettings = async function cancelSettings() {
  await this.loadSettings();
  this.openChatView?.();
};

sidePanelProto.toggleCustomEndpoint = function toggleCustomEndpoint() {
  const provider = this.elements.provider?.value;
  const isCustom = provider === 'custom' || provider === 'kimi' || provider === 'openrouter';

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
    } else if (provider === 'openrouter') {
      this.elements.customEndpoint.placeholder = 'https://openrouter.ai/api/v1';
      if (!this.elements.customEndpoint.value || this.elements.customEndpoint.value === 'https://api.kimi.com/coding') {
        this.elements.customEndpoint.value = 'https://openrouter.ai/api/v1';
      }
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
      case 'parchi':
        modelHint.textContent = 'Managed routing via your credits. Default: moonshotai/kimi-k2.5.';
        break;
      case 'anthropic':
        modelHint.textContent = 'Recommended: claude-sonnet-4-20250514';
        break;
      case 'openai':
        modelHint.textContent = 'Recommended: gpt-4o or gpt-4-turbo';
        break;
      case 'kimi':
        modelHint.textContent = 'Recommended: kimi-for-coding (or your Kimi model ID)';
        break;
      case 'openrouter':
        modelHint.textContent = 'e.g. anthropic/claude-sonnet-4, openai/gpt-4o, google/gemini-2.0-flash';
        break;
      case 'custom':
        modelHint.textContent = 'Enter the model ID from your provider';
        break;
      default:
        modelHint.textContent = '';
    }
  }
};

sidePanelProto.validateCustomEndpoint = function validateCustomEndpoint() {
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

sidePanelProto.validateCustomHeaders = function validateCustomHeaders() {
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

sidePanelProto.validateProfileEditorHeaders = function validateProfileEditorHeaders() {
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

sidePanelProto.toggleProfileEditorEndpoint = function toggleProfileEditorEndpoint() {
  if (!this.elements.profileEditorEndpointGroup) return;
  const provider = this.elements.profileEditorProvider?.value;
  this.elements.profileEditorEndpointGroup.style.display =
    provider === 'custom' || provider === 'kimi' || provider === 'openrouter' ? 'block' : 'none';
};

sidePanelProto.switchSettingsTab = function switchSettingsTab(
  tabName: 'providers' | 'profiles' | 'design' | 'advanced' = 'providers',
) {
  const tabMap: Record<string, string> = {
    setup: 'providers',
    oauth: 'providers',
    model: 'profiles',
    usage: 'advanced',
  };
  const resolvedTab = (tabMap[tabName] || tabName) as 'providers' | 'profiles' | 'design' | 'advanced';
  this.currentSettingsTab = resolvedTab;

  const tabs = ['providers', 'profiles', 'design', 'advanced'] as const;
  const tabElements: Record<string, HTMLElement | null> = {
    providers: this.elements.settingsTabProviders || document.getElementById('settingsTabProviders'),
    profiles: this.elements.settingsTabProfiles || document.getElementById('settingsTabProfiles'),
    design: this.elements.settingsTabDesign || document.getElementById('settingsTabDesign'),
    advanced: this.elements.settingsTabAdvanced || document.getElementById('settingsTabAdvanced'),
  };
  const btnElements: Record<string, HTMLElement | null> = {
    providers: this.elements.settingsTabProvidersBtn || document.getElementById('settingsTabProvidersBtn'),
    profiles: this.elements.settingsTabProfilesBtn || document.getElementById('settingsTabProfilesBtn'),
    design: this.elements.settingsTabDesignBtn || document.getElementById('settingsTabDesignBtn'),
    advanced: this.elements.settingsTabAdvancedBtn || document.getElementById('settingsTabAdvancedBtn'),
  };

  for (const tab of tabs) {
    const isActive = tab === resolvedTab;
    tabElements[tab]?.classList.toggle('hidden', !isActive);
    btnElements[tab]?.classList.toggle('active', isActive);
    const pane = tabElements[tab]?.querySelector('.settings-tab-pane') as HTMLElement | null;
    pane?.classList.toggle('active', isActive);
  }

  if (resolvedTab === 'providers') {
    this.renderOAuthProviderGrid?.();
    this.renderApiProviderGrid?.();
    void this.refreshAccountPanel?.({ silent: true });
  }
};

sidePanelProto.createProfileFromInput = function createProfileFromInput() {
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

sidePanelProto.loadSettings = async function loadSettings() {
  let settings: Record<string, any> = {};
  try {
    settings = await hydrateSettingsStore();
  } catch (error) {
    console.error('[Parchi] Failed to load settings from storage:', error);
    this.updateStatus('Failed to load settings', 'error');
  }

  const storedConfigs = settings.configs || {};
  const baseConfig = {
    provider: '',
    apiKey: '',
    model: '',
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
  const didSyncOAuthProfiles = await syncOAuthProfiles(this, {
    fetchModels: false,
    persist: false,
    refreshUi: false,
  });
  const storedActiveConfig = typeof settings.activeConfig === 'string' ? settings.activeConfig : '';
  const storedActiveProvider = String(settings.provider || '')
    .trim()
    .toLowerCase();
  const storedActiveModel = String(settings.model || '').trim();
  const legacyActiveConfig = (() => {
    if (!storedActiveModel) return '';
    const profileNames = Object.keys(this.configs);
    const exactProviderModelMatch = profileNames.find((name) => {
      const config = this.configs[name] || {};
      const provider = String(config.provider || '')
        .trim()
        .toLowerCase();
      const model = String(config.model || '').trim();
      return provider === storedActiveProvider && model === storedActiveModel;
    });
    if (exactProviderModelMatch) return exactProviderModelMatch;

    return profileNames.find((name) => {
      const config = this.configs[name] || {};
      const model = String(config.model || '').trim();
      return model === storedActiveModel;
    });
  })();
  this.currentConfig = this.configs[storedActiveConfig] ? storedActiveConfig : legacyActiveConfig || 'default';
  if (!isRunnableProfileConfig(this.configs[this.currentConfig])) {
    const preferredRunnableProfileName = getPreferredRunnableProfileName(this.configs);
    if (preferredRunnableProfileName && this.configs[preferredRunnableProfileName]) {
      this.currentConfig = preferredRunnableProfileName;
    }
  }
  this.auxAgentProfiles = settings.auxAgentProfiles || [];
  this.applyUiZoom(settings.uiZoom ?? 1, { persist: false });
  this.applyTypography(settings.fontPreset ?? 'default', settings.fontStylePreset ?? 'normal', { persist: false });
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
  if (this.elements.autoSaveSession)
    this.elements.autoSaveSession.value =
      settings.autoSaveSession !== undefined ? String(settings.autoSaveSession) : 'false';
  const autoSaveFolderGroup = document.getElementById('autoSaveFolderGroup');
  if (autoSaveFolderGroup) {
    autoSaveFolderGroup.style.display = this.elements.autoSaveSession?.value === 'true' ? '' : 'none';
  }
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
  const persistedActiveConfig = String(settings.activeConfig || '').trim();
  if (didSyncOAuthProfiles || persistedActiveConfig !== this.currentConfig) {
    await this.persistAllSettings({ silent: true });
  }
  this.updateScreenshotToggleState();
  this.editProfile(this.currentConfig, true);
  this.updatePromptSections?.();
  await this.refreshAccountPanel?.({ silent: true });
};

sidePanelProto.updateRelayStatusFromSettings = function updateRelayStatusFromSettings(
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

sidePanelProto.saveSettings = async function saveSettings() {
  this.savePromptSections?.();
  await this.persistAllSettings();
  this.populateModelSelect?.();
  this.updateModelDisplay?.();
  this.updateStatus('Settings saved successfully', 'success');
  this.openChatView?.();
};

sidePanelProto.exportSettings = async function exportSettings() {
  try {
    const settings = await hydrateSettingsStore();
    const payload = buildSettingsStoreExport(settings);
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

sidePanelProto.importSettings = async function importSettings(event: Event) {
  const input = event?.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await importSettingsToStore(data);
    await this.loadSettings();
    this.renderProfileGrid();
    this.updateStatus('Settings imported successfully', 'success');
  } catch (error) {
    this.updateStatus('Unable to import settings', 'error');
  } finally {
    if (input) input.value = '';
  }
};

sidePanelProto.collectCurrentFormProfile = function collectCurrentFormProfile() {
  return this.configs[this.currentConfig] || {};
};

sidePanelProto.collectToolPermissions = function collectToolPermissions() {
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

sidePanelProto.persistAllSettings = async function persistAllSettings({ silent = false } = {}) {
  try {
    const activeProfile = this.configs[this.currentConfig] || {};
    const rawRelayUrl = (this.elements.relayUrl?.value || '').trim();
    const normalizedRelayUrl = rawRelayUrl && !rawRelayUrl.includes('://') ? `http://${rawRelayUrl}` : rawRelayUrl;
    // Write flat top-level keys for backward compatibility with BackgroundService.resolveProfile
    const payload: Record<string, any> = {
      provider: activeProfile.provider ?? '',
      apiKey: activeProfile.apiKey ?? '',
      model: activeProfile.model ?? '',
      customEndpoint: activeProfile.customEndpoint ?? '',
      extraHeaders: activeProfile.extraHeaders || {},
      systemPrompt: activeProfile.systemPrompt || this.getDefaultSystemPrompt(),
      temperature: activeProfile.temperature ?? 0.7,
      maxTokens: activeProfile.maxTokens || 4096,
      contextLimit: activeProfile.contextLimit || 200000,
      timeout: activeProfile.timeout || 30000,
      enableScreenshots: activeProfile.enableScreenshots ?? true,
      sendScreenshotsAsImages: activeProfile.sendScreenshotsAsImages ?? false,
      screenshotQuality: activeProfile.screenshotQuality || 'high',
      showThinking: activeProfile.showThinking !== false,
      streamResponses: activeProfile.streamResponses !== false,
      autoScroll: activeProfile.autoScroll !== false,
      confirmActions: activeProfile.confirmActions !== false,
      saveHistory: activeProfile.saveHistory !== false,
      autoSaveSession: this.elements.autoSaveSession?.value === 'true',
      visionBridge: this.elements.visionBridge?.value === 'true',
      visionProfile: this.elements.visionProfile?.value || '',
      useOrchestrator: this.elements.orchestratorToggle?.value === 'true',
      orchestratorProfile: this.elements.orchestratorProfile?.value || '',
      toolPermissions: this.collectToolPermissions(),
      allowedDomains: this.elements.allowedDomains?.value || '',
      auxAgentProfiles: this.auxAgentProfiles,
      uiZoom: this.uiZoom ?? 1,
      fontPreset: this.fontPreset || 'default',
      fontStylePreset: this.fontStylePreset || 'normal',
      theme: this.currentTheme || DEFAULT_THEME_ID,
      relayEnabled: this.elements.relayEnabled?.value === 'true',
      relayUrl: normalizedRelayUrl,
      relayToken: this.elements.relayToken?.value || '',
      activeConfig: this.currentConfig,
      configs: this.configs,
    };
    await replaceSettingsStoreSnapshot(payload);
    this.updateContextUsage?.();
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

sidePanelProto.getDefaultSystemPrompt = function getDefaultSystemPrompt() {
  return DEFAULT_AGENT_SYSTEM_PROMPT;
};

sidePanelProto.renderThemeGrid = function renderThemeGrid() {
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

sidePanelProto.setTheme = function setTheme(id: string) {
  this.currentTheme = id;
  applyTheme(id);
  this.renderThemeGrid();
  void patchSettingsStoreSnapshot({ theme: id }).catch(() => {});
};

sidePanelProto.updateScreenshotToggleState = function updateScreenshotToggleState() {
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

sidePanelProto.updatePromptSections = function updatePromptSections() {
  // Re-query elements in case they weren't available at constructor time (loaded via template)
  const orchSection = this.elements.orchestratorPromptSection || document.getElementById('orchestratorPromptSection');
  const orchTextarea =
    this.elements.orchestratorPromptTextarea ||
    (document.getElementById('orchestratorPromptTextarea') as HTMLTextAreaElement | null);
  const visSection = this.elements.visionPromptSection || document.getElementById('visionPromptSection');
  const visTextarea =
    this.elements.visionPromptTextarea ||
    (document.getElementById('visionPromptTextarea') as HTMLTextAreaElement | null);

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

sidePanelProto.savePromptSections = function savePromptSections() {
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
