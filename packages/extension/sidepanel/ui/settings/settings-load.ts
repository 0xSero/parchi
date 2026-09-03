import { hydrateSettingsStore } from '../../../state/stores/settings-store.js';
import { SidePanelUI } from '../core/panel-ui.js';
import { syncOAuthProfiles } from './oauth-profiles.js';
import { DEFAULT_THEME_ID } from './themes.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

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
  this.providers = settings.providers || {};
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
  this.auxAgentProfiles = settings.auxAgentProfiles || [];
  if (settings.enabledComposerModels && typeof settings.enabledComposerModels === 'object') {
    this._enabledComposerModels = settings.enabledComposerModels;
  }
  this.applyUiZoom(settings.uiZoom ?? 1, { persist: false });
  this.applyTypography(settings.fontPreset ?? 'default', settings.fontStylePreset ?? 'normal', { persist: false });
  this.currentTheme = settings.theme || DEFAULT_THEME_ID;
  this.currentColorMode =
    settings.colorMode === 'light' || settings.colorMode === 'system' ? settings.colorMode : 'dark';

  this.applyColorMode(this.currentColorMode, { persist: false });
  this.renderThemeGrid?.({ icons: true });

  if (this.elements.visionBridge) this.elements.visionBridge.checked = settings.visionBridge !== false;
  if (this.elements.visionProfile) this.elements.visionProfile.value = settings.visionProfile || '';
  if (this.elements.orchestratorToggle) this.elements.orchestratorToggle.checked = settings.useOrchestrator === true;
  if (this.elements.orchestratorProfile) this.elements.orchestratorProfile.value = settings.orchestratorProfile || '';
  const orchEnabled = this.elements.orchestratorToggle?.checked === true;
  if (this.elements.orchestratorProfileSelectGroup)
    this.elements.orchestratorProfileSelectGroup.style.display = orchEnabled ? '' : 'none';
  if (this.elements.showThinking) this.elements.showThinking.checked = settings.showThinking !== false;
  if (this.elements.streamResponses) this.elements.streamResponses.checked = settings.streamResponses !== false;
  if (this.elements.autoScroll) this.elements.autoScroll.checked = settings.autoScroll !== false;
  if (this.elements.confirmActions) this.elements.confirmActions.checked = settings.confirmActions !== false;
  if (this.elements.saveHistory) this.elements.saveHistory.checked = settings.saveHistory !== false;
  if (this.elements.autoSaveSession)
    this.elements.autoSaveSession.value =
      settings.autoSaveSession !== undefined ? String(settings.autoSaveSession) : 'false';
  const autoSaveFolderGroup = document.getElementById('autoSaveFolderGroup');
  if (autoSaveFolderGroup) {
    autoSaveFolderGroup.style.display = this.elements.autoSaveSession?.value === 'true' ? '' : 'none';
  }
  this.timelineCollapsed = settings.timelineCollapsed !== undefined ? settings.timelineCollapsed !== false : true;

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
  if (this.elements.permissionRead) this.elements.permissionRead.checked = toolPermissions.read !== false;
  if (this.elements.permissionInteract) this.elements.permissionInteract.checked = toolPermissions.interact !== false;
  if (this.elements.permissionNavigate) this.elements.permissionNavigate.checked = toolPermissions.navigate !== false;
  if (this.elements.permissionTabs) this.elements.permissionTabs.checked = toolPermissions.tabs !== false;
  if (this.elements.permissionScreenshots)
    this.elements.permissionScreenshots.checked = toolPermissions.screenshots !== false;
  if (this.elements.allowedDomains) this.elements.allowedDomains.value = settings.allowedDomains || '';

  await syncOAuthProfiles(this).catch(() => {});

  this.refreshConfigDropdown();
  this.setActiveConfig(this.currentConfig, true);
  this.updateScreenshotToggleState();
  this.populateGenerationTab?.();
  this.updatePromptSections?.();
  this.renderTeamProfileList?.();
  await this.refreshAccountPanel?.({ silent: true });
  this.syncAccountAvatar?.();
};
