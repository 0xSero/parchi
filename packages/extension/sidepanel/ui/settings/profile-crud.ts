import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.createNewConfig = async function createNewConfig(name?: string) {
  const inputA = this.elements.newProfileInput;
  const inputB = this.elements.newProfileNameInput;
  const trimmedName = (name || inputA?.value || inputB?.value || '').trim();
  if (!trimmedName) {
    this.updateStatus('Enter a profile name', 'warning');
    return;
  }
  if (this.configs[trimmedName]) {
    this.updateStatus('Profile already exists', 'warning');
    return;
  }

  if (inputA) inputA.value = '';
  if (inputB) inputB.value = '';

  const current = this.configs[this.currentConfig] || {};
  this.configs[trimmedName] = {
    provider: '',
    apiKey: '',
    model: '',
    customEndpoint: '',
    extraHeaders: {},
    systemPrompt: '',
    temperature: current.temperature ?? 0.7,
    maxTokens: current.maxTokens || 4096,
    contextLimit: current.contextLimit || 200000,
    timeout: current.timeout || 30000,
    sendScreenshotsAsImages: current.sendScreenshotsAsImages || false,
    screenshotQuality: current.screenshotQuality || 'high',
    streamResponses: current.streamResponses !== false,
    enableScreenshots: current.enableScreenshots || false,
    saveHistory: current.saveHistory !== false,
    showThinking: current.showThinking !== false,
    autoScroll: current.autoScroll !== false,
    confirmActions: current.confirmActions !== false,
  };

  this.refreshConfigDropdown();
  this.setActiveConfig(trimmedName, true);
  await this.persistAllSettings({ silent: true });
  this.updateStatus(`Profile "${trimmedName}" created`, 'success');
};

sidePanelProto.resetAllProfiles = async function resetAllProfiles() {
  try {
    await chrome.runtime.sendMessage({ type: 'reset_all_profiles' });
    this.configs = {
      default: {
        provider: '',
        apiKey: '',
        model: '',
        systemPrompt: this.getDefaultSystemPrompt(),
        temperature: 0.7,
        maxTokens: 4096,
        contextLimit: 200000,
        timeout: 30000,
        showThinking: true,
        streamResponses: true,
      },
    };
    this.providers = {};
    this.currentConfig = 'default';
    this.refreshConfigDropdown();
    this.populateModelSelect?.();
    this.updateModelDisplay?.();
    this.renderProfileGrid?.();
    this.updateStatus('All profiles and providers reset', 'success');
  } catch (error) {
    this.updateStatus('Failed to reset profiles', 'error');
  }
};

sidePanelProto.deleteConfig = async function deleteConfig() {
  if (this.currentConfig === 'default') {
    this.updateStatus('Cannot delete default profile', 'warning');
    return;
  }
  await this.deleteProfileByName(this.currentConfig);
};

sidePanelProto.deleteProfileByName = async function deleteProfileByName(name: string) {
  if (!name || name === 'default') {
    this.updateStatus('Cannot delete default profile', 'warning');
    return;
  }
  if (!this.configs[name]) return;

  delete this.configs[name];
  if (this.currentConfig === name) {
    this.currentConfig = 'default';
  }
  if (this.profileEditorTarget === name) {
    this.profileEditorTarget = this.currentConfig;
    this.editProfile(this.currentConfig, true);
  }
  this.refreshConfigDropdown();
  this.updateModelDisplay();
  this.setActiveConfig(this.currentConfig, true);
  await this.persistAllSettings({ silent: true });
  this.updateStatus(`Profile "${name}" deleted`, 'success');
};

sidePanelProto.switchConfig = async function switchConfig() {
  const newConfig = this.elements.activeConfig.value;
  if (!this.configs[newConfig]) {
    this.updateStatus('Profile not found', 'warning');
    return;
  }
  this.configs[this.currentConfig] = this.collectCurrentFormProfile();
  this.setActiveConfig(newConfig);
  await this.persistAllSettings({ silent: true });
};

sidePanelProto.setActiveConfig = function setActiveConfig(name: string, quiet = false) {
  if (!this.configs[name]) return;
  this.currentConfig = name;
  if (this.elements.activeConfig) this.elements.activeConfig.value = name;
  this.populateFormFromConfig(this.configs[name]);
  this.toggleCustomEndpoint();
  this.renderProfileGrid?.();
  this.updateScreenshotToggleState?.();
  this.editProfile?.(name, true);
  this.fetchAvailableModels();
  if (!quiet) {
    this.updateStatus(`Switched to "${name}"`, 'success');
  }
};
