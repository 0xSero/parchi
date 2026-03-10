import { normalizeOAuthModelIdForProvider } from '../../../oauth/model-normalization.js';
import {
  ensureProviderModel,
  getProviderInstance,
  materializeProfileWithProvider,
} from '../../../state/provider-registry.js';
import { SidePanelUI } from '../core/panel-ui.js';
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

const formatHeadersJson = (headers: Record<string, any> | undefined) => {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return '';
  const entries = Object.entries(headers).filter(([_, value]) => value != null && String(value).length > 0);
  if (!entries.length) return '';
  const normalized = Object.fromEntries(entries.map(([key, value]) => [key, String(value)]));
  return JSON.stringify(normalized, null, 2);
};

const resizeProfilePromptInput = (textarea: HTMLTextAreaElement | null) => {
  if (!textarea) return;
  textarea.style.height = 'auto';
  const nextHeight = Math.min(textarea.scrollHeight, 500);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > 500 ? 'auto' : 'hidden';
};

type BooleanBinding = {
  elementKey: string;
  configKey: string;
  defaultTrue: boolean;
};

type NumberBinding = {
  elementKey: string;
  configKey: string;
  fallback: number;
  parseMode: 'int' | 'float';
};

const PROFILE_EDITOR_BOOLEAN_BINDINGS: BooleanBinding[] = [
  { elementKey: 'profileEditorEnableScreenshots', configKey: 'enableScreenshots', defaultTrue: false },
  { elementKey: 'profileEditorSendScreenshots', configKey: 'sendScreenshotsAsImages', defaultTrue: false },
  { elementKey: 'profileEditorShowThinking', configKey: 'showThinking', defaultTrue: true },
  { elementKey: 'profileEditorStreamResponses', configKey: 'streamResponses', defaultTrue: true },
  { elementKey: 'profileEditorAutoScroll', configKey: 'autoScroll', defaultTrue: true },
  { elementKey: 'profileEditorConfirmActions', configKey: 'confirmActions', defaultTrue: true },
  { elementKey: 'profileEditorSaveHistory', configKey: 'saveHistory', defaultTrue: true },
];

const PROFILE_EDITOR_NUMBER_BINDINGS: NumberBinding[] = [
  { elementKey: 'profileEditorTemperature', configKey: 'temperature', fallback: 0.7, parseMode: 'float' },
  { elementKey: 'profileEditorMaxTokens', configKey: 'maxTokens', fallback: 2048, parseMode: 'int' },
  { elementKey: 'profileEditorContextLimit', configKey: 'contextLimit', fallback: 200000, parseMode: 'int' },
  { elementKey: 'profileEditorTimeout', configKey: 'timeout', fallback: 30000, parseMode: 'int' },
];

const SETTINGS_FORM_BOOLEAN_BINDINGS: BooleanBinding[] = [
  { elementKey: 'enableScreenshots', configKey: 'enableScreenshots', defaultTrue: false },
  { elementKey: 'sendScreenshotsAsImages', configKey: 'sendScreenshotsAsImages', defaultTrue: false },
  { elementKey: 'streamResponses', configKey: 'streamResponses', defaultTrue: true },
  { elementKey: 'showThinking', configKey: 'showThinking', defaultTrue: true },
  { elementKey: 'autoScroll', configKey: 'autoScroll', defaultTrue: true },
  { elementKey: 'confirmActions', configKey: 'confirmActions', defaultTrue: true },
  { elementKey: 'saveHistory', configKey: 'saveHistory', defaultTrue: true },
];

const SETTINGS_FORM_NUMBER_BINDINGS: NumberBinding[] = [
  { elementKey: 'temperature', configKey: 'temperature', fallback: 0.7, parseMode: 'float' },
  { elementKey: 'maxTokens', configKey: 'maxTokens', fallback: 4096, parseMode: 'int' },
  { elementKey: 'contextLimit', configKey: 'contextLimit', fallback: 200000, parseMode: 'int' },
  { elementKey: 'timeout', configKey: 'timeout', fallback: 30000, parseMode: 'int' },
];

const readControlValue = (elements: Record<string, any>, elementKey: string) => {
  const control = elements[elementKey];
  return typeof control?.value === 'string' ? control.value : '';
};

const setControlValue = (elements: Record<string, any>, elementKey: string, value: string | number) => {
  const control = elements[elementKey];
  if (!control || typeof control !== 'object' || !('value' in control)) return;
  control.value = String(value);
};

const setCheckboxValue = (elements: Record<string, any>, elementKey: string, value: boolean) => {
  const control = elements[elementKey] as HTMLInputElement | null;
  if (!control) return;
  control.checked = value;
};

const parseNumeric = (raw: string, fallback: number, parseMode: 'int' | 'float') => {
  const parsed = parseMode === 'float' ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBooleanWithDefault = (value: unknown, defaultTrue: boolean) => (defaultTrue ? value !== false : value === true);

const applyBooleanBindings = (
  elements: Record<string, any>,
  config: Record<string, any>,
  bindings: BooleanBinding[],
) => {
  bindings.forEach(({ elementKey, configKey, defaultTrue }) => {
    setCheckboxValue(elements, elementKey, toBooleanWithDefault(config[configKey], defaultTrue));
  });
};

const readBooleanBindings = (elements: Record<string, any>, bindings: BooleanBinding[]) => {
  const result: Record<string, boolean> = {};
  bindings.forEach(({ elementKey, configKey, defaultTrue }) => {
    const control = elements[elementKey] as HTMLInputElement | null;
    result[configKey] = control ? control.checked : defaultTrue;
  });
  return result;
};

const applyNumberBindings = (elements: Record<string, any>, config: Record<string, any>, bindings: NumberBinding[]) => {
  bindings.forEach(({ elementKey, configKey, fallback, parseMode }) => {
    const rawValue = config[configKey];
    const rawString =
      typeof rawValue === 'number' ? String(rawValue) : typeof rawValue === 'string' && rawValue.trim() ? rawValue : '';
    const numeric = parseNumeric(rawString, fallback, parseMode);
    setControlValue(elements, elementKey, numeric);
  });
};

const readNumberBindings = (elements: Record<string, any>, bindings: NumberBinding[]) => {
  const result: Record<string, number> = {};
  bindings.forEach(({ elementKey, configKey, fallback, parseMode }) => {
    result[configKey] = parseNumeric(readControlValue(elements, elementKey), fallback, parseMode);
  });
  return result;
};

const renameProfileReferences = (ui: SidePanelUI, sourceName: string, targetName: string) => {
  if (ui.currentConfig === sourceName) ui.currentConfig = targetName;
  ui.profileEditorTarget = targetName;
  if (ui.elements.visionProfile?.value === sourceName) ui.elements.visionProfile.value = targetName;
  if (ui.elements.orchestratorProfile?.value === sourceName) ui.elements.orchestratorProfile.value = targetName;
  ui.auxAgentProfiles = Array.from(
    new Set(ui.auxAgentProfiles.map((profileName) => (profileName === sourceName ? targetName : profileName))),
  );
};

sidePanelProto.createNewConfig = async function createNewConfig(name?: string) {
  // Read from whichever input has a value
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

  // Clear both inputs
  if (inputA) inputA.value = '';
  if (inputB) inputB.value = '';

  // Start new profiles with blank connection credentials — never clone provider,
  // apiKey, or model from the active config, since mismatched provider×model
  // combinations are the #1 source of broken profiles (e.g. gpt-4o saved under
  // anthropic). Copy only non-sensitive behavioral defaults.
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

sidePanelProto.refreshConfigDropdown = function refreshConfigDropdown() {
  if (this.elements.activeConfig) {
    this.elements.activeConfig.innerHTML = '';
    Object.keys(this.configs).forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === this.currentConfig) {
        option.selected = true;
      }
      this.elements.activeConfig.appendChild(option);
    });
  }
  this.refreshProfileSelectors();
  this.updateModelDisplay();
  this.renderTeamProfileList?.();
  this.updateContextUsage();
};

sidePanelProto.refreshProfileSelectors = function refreshProfileSelectors() {
  const names = Object.keys(this.configs);
  const selects = [
    this.elements.orchestratorProfile,
    this.elements.visionProfile,
    this.elements.orchestratorProfileVisible,
  ];
  selects.forEach((select) => {
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">Use active config</option>';
    names.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });

    if (!currentValue) return;
    if (!names.includes(currentValue)) {
      select.value = '';
      return;
    }
    select.value = currentValue;
  });
};

sidePanelProto.renderProfileGrid = function renderProfileGrid() {
  if (!this.elements.agentGrid) return;
  this.elements.agentGrid.innerHTML = '';
  const currentVision = this.elements.visionProfile?.value;
  const currentOrchestrator = this.elements.orchestratorProfile?.value;
  const configs = Object.keys(this.configs);
  if (!configs.length) {
    this.elements.agentGrid.innerHTML = '<div class="history-empty">No profiles yet.</div>';
    return;
  }
  configs.forEach((name) => {
    const card = document.createElement('div');
    card.className = 'agent-card';
    const isEditing = name === this.profileEditorTarget;
    if (isEditing) {
      card.classList.add('editing');
    }
    card.dataset.profile = name;
    const config = materializeProfileWithProvider(
      { providers: this.providers, configs: this.configs },
      name,
      this.configs[name] || {},
    );
    const isOAuth = String(config.provider || '').endsWith('-oauth');
    if (isOAuth) card.classList.add('oauth-profile');
    const rolePills = ['main', 'vision', 'orchestrator', 'aux']
      .map((role) => {
        const isActive = this.isProfileActiveForRole(name, role, currentVision, currentOrchestrator);
        const label = this.getRoleLabel(role);
        return `<span class="role-pill ${isActive ? 'active' : ''} ${role}-pill" data-role="${role}" data-profile="${name}" title="Assign ${this.escapeHtml(
          name,
        )} as ${label.toLowerCase()} profile">${label}</span>`;
      })
      .join('');
    const deleteBtn =
      name !== 'default' && !isOAuth
        ? `<button class="agent-card-delete" data-delete-profile="${this.escapeHtml(name)}" title="Delete profile">&times;</button>`
        : '';
    const providerLabel =
      config.providerLabel || (isOAuth ? config.provider.replace(/-oauth$/, '') : config.provider || 'Provider');
    const oauthTag = isOAuth ? '<span class="oauth-badge">OAuth</span>' : '';
    card.innerHTML = `
        <div class="agent-card-header">
          <div>
            <h4>${this.escapeHtml(name)}${oauthTag}</h4>
            <span>${this.escapeHtml(providerLabel)} · ${this.escapeHtml(config.model || 'Model')}</span>
          </div>
          ${deleteBtn}
        </div>
        <div class="role-pills">${rolePills}</div>
        ${isEditing ? '<div class="agent-card-editor-slot"></div>' : ''}
      `;
    this.elements.agentGrid.appendChild(card);
  });

  // Delegated click handler for delete buttons, role pills, and card selection.
  // Only bind once — use a flag to avoid stacking listeners on re-renders.
  if (!(this.elements.agentGrid as any)._profileGridBound) {
    (this.elements.agentGrid as any)._profileGridBound = true;
    this.elements.agentGrid.addEventListener('click', (event: Event) => {
      const target = event.target as HTMLElement;

      // Delete button
      const deleteBtn = target.closest<HTMLElement>('[data-delete-profile]');
      if (deleteBtn) {
        event.stopPropagation();
        const profileName = deleteBtn.dataset.deleteProfile;
        if (profileName) this.deleteProfileByName(profileName);
        return;
      }

      // Role pill
      const pill = target.closest<HTMLElement>('.role-pill');
      if (pill) {
        event.stopPropagation();
        const profileName = pill.dataset.profile;
        const role = pill.dataset.role;
        if (profileName && role) this.assignProfileRole(profileName, role);
        return;
      }

      // Card click — open editor for that profile
      const card = target.closest<HTMLElement>('.agent-card');
      if (card?.dataset.profile) {
        this.editProfile(card.dataset.profile, true);
      }
    });
  }

  this.mountProfileEditorInGrid?.();
};

sidePanelProto.mountProfileEditorInGrid = function mountProfileEditorInGrid() {
  const editor = this.elements.profileEditor as HTMLElement | null;
  const grid = this.elements.agentGrid as HTMLElement | null;
  if (!editor || !grid) return;

  const targetName = this.profileEditorTarget || this.currentConfig;
  const cards = Array.from(grid.querySelectorAll<HTMLElement>('.agent-card'));
  const targetCard = cards.find((card) => card.dataset.profile === targetName);
  const targetSlot = targetCard?.querySelector<HTMLElement>('.agent-card-editor-slot');

  if (!targetSlot) {
    if (grid.nextElementSibling !== editor) {
      grid.insertAdjacentElement('afterend', editor);
    }
    editor.classList.remove('profile-editor-inline');
    return;
  }

  targetSlot.appendChild(editor);
  editor.classList.add('profile-editor-inline');
};

sidePanelProto.getRoleLabel = function getRoleLabel(role: string) {
  switch (role) {
    case 'main':
      return 'Main';
    case 'vision':
      return 'Vision';
    case 'orchestrator':
      return 'Orchestrator';
    default:
      return 'Team';
  }
};

sidePanelProto.isProfileActiveForRole = function isProfileActiveForRole(
  name: string,
  role: string,
  visionName?: string,
  orchestratorName?: string,
) {
  if (role === 'main') return name === this.currentConfig;
  if (role === 'vision') return name && visionName === name;
  if (role === 'orchestrator') return name && orchestratorName === name;
  if (role === 'aux') return this.auxAgentProfiles.includes(name);
  return false;
};

sidePanelProto.assignProfileRole = function assignProfileRole(profileName: string, role: string) {
  if (!profileName) return;
  if (role === 'main') {
    this.setActiveConfig(profileName);
    return;
  }
  if (role === 'vision') {
    this.toggleProfileRole('visionProfile', profileName);
  } else if (role === 'orchestrator') {
    this.toggleProfileRole('orchestratorProfile', profileName);
  } else if (role === 'aux') {
    this.toggleAuxProfile(profileName);
  }
};

sidePanelProto.toggleProfileRole = function toggleProfileRole(elementId: string, profileName: string) {
  const element = this.elements[elementId];
  if (!element) return;
  const isSelecting = element.value !== profileName;
  element.value = isSelecting ? profileName : '';
  if (elementId === 'orchestratorProfile') {
    if (this.elements.orchestratorToggle) {
      this.elements.orchestratorToggle.checked = isSelecting;
    }
    if (this.elements.orchestratorProfileSelectGroup) {
      this.elements.orchestratorProfileSelectGroup.style.display = isSelecting ? '' : 'none';
    }
  }
  this.renderProfileGrid();
  this.renderTeamProfileList?.();
};

sidePanelProto.toggleAuxProfile = function toggleAuxProfile(profileName: string) {
  const idx = this.auxAgentProfiles.indexOf(profileName);
  if (idx === -1) {
    this.auxAgentProfiles.push(profileName);
  } else {
    this.auxAgentProfiles.splice(idx, 1);
  }
  this.auxAgentProfiles = Array.from(new Set(this.auxAgentProfiles));
  this.renderProfileGrid();
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
  // Only update profile editor elements if they exist
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
  const provider = String(providerInstance?.providerType || '').trim();
  const rawModel = (
    this.elements.profileEditorModelInput?.value ||
    this.elements.profileEditorModel.value ||
    ''
  ).trim();
  const model = provider.endsWith('-oauth') ? normalizeOAuthModelIdForProvider(provider, rawModel) : rawModel;
  const numericValues = readNumberBindings(this.elements, PROFILE_EDITOR_NUMBER_BINDINGS);
  const booleanValues = readBooleanBindings(this.elements, PROFILE_EDITOR_BOOLEAN_BINDINGS);
  return {
    providerId,
    providerLabel: providerInstance?.name || '',
    provider,
    apiKey: providerInstance?.authType === 'api-key' ? providerInstance.apiKey || '' : '',
    modelId: model,
    model,
    customEndpoint: providerInstance?.customEndpoint || '',
    extraHeaders: (() => {
      return providerInstance?.extraHeaders || {};
    })(),
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
    // Move config to new key
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

sidePanelProto.populateFormFromConfig = function populateFormFromConfig(config: Record<string, any> = {}) {
  // Use optional chaining for all element accesses since settings UI may be simplified
  if (this.elements.provider) this.elements.provider.value = config.provider || '';
  if (this.elements.apiKey) this.elements.apiKey.value = config.apiKey || '';
  // Setup model field is freeform input + suggestions list.
  if (this.elements.model) {
    const modelVal = config.model || '';
    this.elements.model.value = modelVal;
  }
  if (this.elements.customEndpoint) this.elements.customEndpoint.value = config.customEndpoint || '';
  if (this.elements.customHeaders) this.elements.customHeaders.value = formatHeadersJson(config.extraHeaders) || '';
  if (this.elements.systemPrompt)
    this.elements.systemPrompt.value = config.systemPrompt || this.getDefaultSystemPrompt();
  applyNumberBindings(this.elements, config, SETTINGS_FORM_NUMBER_BINDINGS);
  if (this.elements.temperatureValue) {
    this.elements.temperatureValue.textContent = readControlValue(this.elements, 'temperature');
  }
  applyBooleanBindings(this.elements, config, SETTINGS_FORM_BOOLEAN_BINDINGS);
  if (this.elements.screenshotQuality) this.elements.screenshotQuality.value = config.screenshotQuality || 'high';
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
  this.fetchAvailableModels(); // This now repopulates the composer dropdown with all profiles
  if (!quiet) {
    this.updateStatus(`Switched to "${name}"`, 'success');
  }
};

sidePanelProto.refreshProfileJsonEditor = function refreshProfileJsonEditor() {
  if (!this.elements.profileJsonEditor) return;
  const target = this.profileEditorTarget || this.currentConfig;
  const config = this.configs[target] || {};
  this.elements.profileJsonEditor.value = JSON.stringify(config, null, 2);
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

sidePanelProto.copyProfileJsonEditor = async function copyProfileJsonEditor() {
  if (!this.elements.profileJsonEditor) return;
  const text = this.elements.profileJsonEditor.value || '';
  if (!text.trim()) {
    this.updateStatus('Profile JSON is empty', 'warning');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    this.updateStatus('Profile JSON copied', 'success');
  } catch {
    this.updateStatus('Unable to copy profile JSON', 'error');
  }
};

sidePanelProto.applyProfileJsonEditor = async function applyProfileJsonEditor() {
  if (!this.elements.profileJsonEditor) return;
  const target = this.profileEditorTarget || this.currentConfig;
  if (!target || !this.configs[target]) {
    this.updateStatus('Select a profile to edit', 'warning');
    return;
  }
  const raw = this.elements.profileJsonEditor.value || '';
  if (!raw.trim()) {
    this.updateStatus('Paste profile JSON first', 'warning');
    return;
  }
  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    this.updateStatus('Invalid JSON format', 'error');
    return;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    this.updateStatus('Profile JSON must be an object', 'error');
    return;
  }
  const existing = this.configs[target] || {};
  if (parsed.extraHeaders && typeof parsed.extraHeaders === 'string') {
    try {
      parsed.extraHeaders = parseHeadersJson(parsed.extraHeaders);
    } catch {
      parsed.extraHeaders = existing.extraHeaders || {};
    }
  }
  this.configs[target] = { ...existing, ...parsed };
  await this.persistAllSettings({ silent: true });
  this.editProfile(target, true);
  if (target === this.currentConfig) {
    this.populateFormFromConfig(this.configs[target]);
  }
  this.updateStatus(`Profile "${target}" updated`, 'success');
};
