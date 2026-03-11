import { normalizeOAuthModelIdForProvider } from '../../../oauth/model-normalization.js';
import {
  ensureProviderModel,
  getProviderInstance,
  materializeProfileWithProvider,
} from '../../../state/provider-registry.js';
import { SidePanelUI } from '../core/panel-ui.js';
import { PROFILE_EDITOR_BOOLEAN_BINDINGS, PROFILE_EDITOR_NUMBER_BINDINGS } from './profile-bindings.js';
import {
  applyBooleanBindings,
  applyNumberBindings,
  readBooleanBindings,
  readControlValue,
  readNumberBindings,
} from './profile-form-helpers.js';
import { resizeProfilePromptInput } from './profile-json-editor.js';
import { parseHeadersJson } from './settings-validation.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

const renameProfileReferences = (ui: SidePanelUI, sourceName: string, targetName: string) => {
  if (ui.currentConfig === sourceName) ui.currentConfig = targetName;
  ui.profileEditorTarget = targetName;
  if (ui.elements.visionProfile?.value === sourceName) ui.elements.visionProfile.value = targetName;
  if (ui.elements.orchestratorProfile?.value === sourceName) ui.elements.orchestratorProfile.value = targetName;
  ui.auxAgentProfiles = Array.from(
    new Set(ui.auxAgentProfiles.map((profileName) => (profileName === sourceName ? targetName : profileName))),
  );
};

sidePanelProto.editProfile = function editProfile(name: string, silent = false) {
  if (!name || !this.configs[name]) return;
  this.profileEditorTarget = name;
  const config = materializeProfileWithProvider(
    { providers: this.providers, configs: this.configs },
    name,
    this.configs[name],
  );
  const isOAuth = String(config.provider || '').endsWith('-oauth');

  if (this.elements.profileEditorTitle) {
    const oauthBadge = isOAuth ? ' <span class="oauth-badge">OAuth</span>' : '';
    this.elements.profileEditorTitle.innerHTML = `Editing: ${this.escapeHtml(name)}${oauthBadge}`;
  }
  if (this.elements.profileEditorName) {
    this.elements.profileEditorName.value = name;
    this.elements.profileEditorName.readOnly = isOAuth;
    this.elements.profileEditorName.classList.toggle('oauth-readonly', isOAuth);
  }
  if (this.elements.profileEditorProvider) {
    this.elements.profileEditorProvider.value = config.providerId || '';
    (this.elements.profileEditorProvider as HTMLSelectElement).disabled = false;
  }
  if (this.elements.profileEditorModelInput) {
    this.elements.profileEditorModelInput.value = config.modelId || config.model || '';
  }
  if (this.elements.profileEditorModel) {
    const modelVal = config.modelId || config.model || '';
    const modelSelect = this.elements.profileEditorModel as HTMLSelectElement;
    if (modelVal && !Array.from(modelSelect.options).some((o: HTMLOptionElement) => o.value === modelVal)) {
      const opt = document.createElement('option');
      opt.value = modelVal;
      opt.textContent = modelVal;
      modelSelect.insertBefore(opt, modelSelect.options[1] || null);
    }
    modelSelect.value = modelVal;
  }
  applyNumberBindings(this.elements, config, PROFILE_EDITOR_NUMBER_BINDINGS);
  if (this.elements.profileEditorTemperatureValue) {
    this.elements.profileEditorTemperatureValue.textContent = readControlValue(
      this.elements,
      'profileEditorTemperature',
    );
  }
  applyBooleanBindings(this.elements, config, PROFILE_EDITOR_BOOLEAN_BINDINGS);
  if (this.elements.profileEditorScreenshotQuality)
    this.elements.profileEditorScreenshotQuality.value = config.screenshotQuality || 'high';
  if (this.elements.profileEditorPrompt)
    this.elements.profileEditorPrompt.value = config.systemPrompt || this.getDefaultSystemPrompt();
  resizeProfilePromptInput(this.elements.profileEditorPrompt);

  this.refreshProviderMetaForProfileEditor?.();
  this.refreshProfileJsonEditor?.();
  this.refreshModelCatalogForProfileEditor?.();
  this.renderProfileGrid();
  if (!silent) {
    this.switchSettingsTab('profiles');
  }
};

sidePanelProto.collectProfileEditorData = function collectProfileEditorData() {
  const providerId = String(this.elements.profileEditorProvider.value || '').trim();
  const providerInstance = getProviderInstance({ providers: this.providers }, providerId);
  const provider = String(providerInstance?.provider || '').trim();
  const rawModel = (
    this.elements.profileEditorModelInput?.value ||
    this.elements.profileEditorModel.value ||
    ''
  ).trim();
  const model = provider.endsWith('-oauth') ? normalizeOAuthModelIdForProvider(provider, rawModel) : rawModel;
  const numericValues = readNumberBindings(this.elements, PROFILE_EDITOR_NUMBER_BINDINGS);
  const booleanValues = readBooleanBindings(this.elements, PROFILE_EDITOR_BOOLEAN_BINDINGS);
  const rawHeaders = this.elements.profileEditorHeaders?.value || '';
  const extraHeaders = rawHeaders.trim() ? parseHeadersJson(rawHeaders) : {};
  return {
    providerId,
    providerLabel: providerInstance?.name || '',
    provider,
    apiKey: this.elements.profileEditorApiKey?.value || '',
    modelId: model,
    model,
    customEndpoint: this.elements.profileEditorEndpoint?.value || '',
    extraHeaders,
    ...numericValues,
    ...booleanValues,
    screenshotQuality: this.elements.profileEditorScreenshotQuality.value || 'high',
    systemPrompt: this.elements.profileEditorPrompt.value || this.getDefaultSystemPrompt(),
  };
};

sidePanelProto.saveProfileEdits = async function saveProfileEdits() {
  const target = this.profileEditorTarget;
  if (!target || !this.configs[target]) {
    this.updateStatus('Select a profile to edit', 'warning');
    return;
  }
  if (!this.validateProfileEditorHeaders?.()) {
    this.updateStatus('Invalid headers JSON', 'error');
    return;
  }

  const newName = (this.elements.profileEditorName?.value || '').trim();
  const isRename = newName && newName !== target;

  if (isRename) {
    if (!newName) {
      this.updateStatus('Profile name cannot be empty', 'warning');
      return;
    }
    if (this.configs[newName]) {
      this.updateStatus(`Profile "${newName}" already exists`, 'warning');
      return;
    }
    if (target === 'default') {
      this.updateStatus('Cannot rename the default profile', 'warning');
      return;
    }
  }

  const existing = this.configs[target] || {};
  const updated = { ...existing, ...this.collectProfileEditorData() };
  const providerInstance = getProviderInstance({ providers: this.providers }, String(updated.providerId || ''));
  if (providerInstance && updated.modelId) {
    const nextProvider = ensureProviderModel(providerInstance, updated.modelId);
    this.providers = { ...(this.providers || {}), [nextProvider.id]: nextProvider };
    if (!updated.contextLimit) {
      const matchedModel = nextProvider.models.find((model) => model.id === updated.modelId);
      if (matchedModel?.contextWindow) updated.contextLimit = matchedModel.contextWindow;
    }
  }

  if (isRename) {
    this.configs[newName] = updated;
    delete this.configs[target];

    renameProfileReferences(this, target, newName);

    if (this.elements.profileEditorTitle) this.elements.profileEditorTitle.textContent = `Editing: ${newName}`;
    this.refreshConfigDropdown();
    await this.persistAllSettings({ silent: true });
    this.updateStatus(`Profile renamed to "${newName}"`, 'success');
  } else {
    this.configs[target] = updated;
    await this.persistAllSettings({ silent: true });
    if (target === this.currentConfig) {
      this.populateFormFromConfig(this.configs[target]);
      this.toggleCustomEndpoint();
    }
    this.renderProfileGrid();
    this.populateModelSelect();
    this.updateStatus(`Profile "${target}" saved`, 'success');
  }
};

sidePanelProto.refreshProviderMetaForProfileEditor = function refreshProviderMetaForProfileEditor() {
  const providerId = String(this.elements.profileEditorProvider?.value || '').trim();
  const provider = getProviderInstance({ providers: this.providers }, providerId);
  const title = this.elements.profileEditorTitle as HTMLElement | null;
  const target = this.profileEditorTarget || this.currentConfig;
  if (title && provider) {
    title.innerHTML = `Editing: ${this.escapeHtml(target)} <span class="oauth-badge">${this.escapeHtml(provider.name)}</span>`;
  }
};
