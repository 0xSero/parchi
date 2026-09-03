import { DEFAULT_AGENT_SYSTEM_PROMPT } from '@parchi/shared';
import { materializeProfileWithProvider } from '../../../state/provider-registry.js';
import { patchSettingsStoreSnapshot, replaceSettingsStoreSnapshot } from '../../../state/stores/settings-store.js';
import { SidePanelUI } from '../core/panel-ui.js';
import { DEFAULT_THEME_ID } from './themes.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.getDefaultSystemPrompt = function getDefaultSystemPrompt() {
  return DEFAULT_AGENT_SYSTEM_PROMPT;
};

sidePanelProto.collectCurrentFormProfile = function collectCurrentFormProfile() {
  return this.configs[this.currentConfig] || {};
};

sidePanelProto.saveSettings = async function saveSettings() {
  this.savePromptSections?.();
  await this.persistAllSettings();
  this.populateModelSelect?.();
  this.updateModelDisplay?.();
  this.updateStatus('Settings saved successfully', 'success');
  this.openChatView?.();
};

sidePanelProto.persistAllSettings = async function persistAllSettings({ silent = false } = {}) {
  try {
    const activeProfile = materializeProfileWithProvider(
      { providers: this.providers, configs: this.configs },
      this.currentConfig,
      this.configs[this.currentConfig] || {},
    );
    const payload: Record<string, any> = {
      providers: this.providers || {},
      providerId: activeProfile.providerId ?? '',
      provider: activeProfile.provider ?? '',
      apiKey: activeProfile.apiKey ?? '',
      modelId: activeProfile.modelId ?? activeProfile.model ?? '',
      model: activeProfile.model ?? '',
      customEndpoint: activeProfile.customEndpoint ?? '',
      extraHeaders: activeProfile.extraHeaders || {},
      systemPrompt: activeProfile.systemPrompt || this.getDefaultSystemPrompt(),
      temperature: activeProfile.temperature ?? 0.7,
      maxTokens: activeProfile.maxTokens ?? 4096,
      contextLimit: activeProfile.contextLimit ?? 200000,
      timeout: activeProfile.timeout ?? 30000,
      enableScreenshots: activeProfile.enableScreenshots ?? true,
      sendScreenshotsAsImages: activeProfile.sendScreenshotsAsImages ?? false,
      screenshotQuality: activeProfile.screenshotQuality || 'high',
      showThinking: activeProfile.showThinking !== false,
      streamResponses: activeProfile.streamResponses !== false,
      autoScroll: activeProfile.autoScroll !== false,
      confirmActions: activeProfile.confirmActions !== false,
      saveHistory: activeProfile.saveHistory !== false,
      autoSaveSession: this.elements.autoSaveSession?.value === 'true',
      visionBridge: this.elements.visionBridge?.checked !== false,
      visionProfile: this.elements.visionProfile?.value || '',
      useOrchestrator: this.elements.orchestratorToggle?.checked === true,
      orchestratorProfile: this.elements.orchestratorProfile?.value || '',
      toolPermissions: this.collectToolPermissions(),
      allowedDomains: this.elements.allowedDomains?.value || '',
      auxAgentProfiles: this.auxAgentProfiles,
      uiZoom: this.uiZoom ?? 1,
      fontPreset: this.fontPreset || 'default',
      fontStylePreset: this.fontStylePreset || 'normal',
      colorMode: this.currentColorMode,
      theme: this.currentTheme || DEFAULT_THEME_ID,
      activeConfig: this.currentConfig,
      configs: this.configs,
      enabledComposerModels: this._enabledComposerModels || {},
      controllers: [],
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

sidePanelProto.patchSettings = async function patchSettings(patch: Record<string, any>) {
  try {
    await patchSettingsStoreSnapshot(patch);
  } catch (error) {
    console.error('[Parchi] patchSettings error:', error);
  }
};
