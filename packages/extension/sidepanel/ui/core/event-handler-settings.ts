/**
 * Event Handler - Settings Module
 * Settings panel event handlers
 */

import { debounce } from './dom-utils.js';
import { SidePanelUI } from './panel-ui.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Set up settings-related event listeners
 */
export const setupSettingsListeners = function setupSettingsListeners(this: SidePanelUI & Record<string, unknown>) {
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

  // Settings tabs
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

  // Provider headers validation
  this.elements.customHeaders?.addEventListener('input', () => this.validateCustomHeaders());
};

sidePanelProto.setupSettingsListeners = setupSettingsListeners;
