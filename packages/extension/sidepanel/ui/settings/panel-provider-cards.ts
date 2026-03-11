import type { ProviderInstance } from '@parchi/shared';
import { PROVIDER_REGISTRY, fetchModelsForProvider, getApiKeyProviders } from '../../../ai/providers/registry.js';
import { mergeProviderModels } from '../../../state/provider-models.js';
import {
  buildProviderInstanceId,
  ensureProviderModel,
  getProviderInstance,
  listProviderInstances,
} from '../../../state/provider-registry.js';
import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

import { getProviderSvg } from './panel-model-selector.js';

const apiProviderPresets = () => getApiKeyProviders().filter((provider) => provider.key !== 'parchi');

const providerSummary = (provider: ProviderInstance) => {
  if (provider.authType === 'managed') return 'Managed';
  if (provider.authType === 'oauth') return provider.isConnected ? provider.oauthEmail || 'Connected' : 'Disconnected';
  return provider.isConnected ? 'Connected' : 'Missing API key';
};

sidePanelProto.renderApiProviderGrid = function renderApiProviderGrid() {
  const grid = this.elements.apiProviderGrid as HTMLElement | null;
  if (!grid) return;
  grid.innerHTML = '';

  const providers = listProviderInstances({ providers: this.providers }).filter(
    (provider) => provider.authType === 'api-key',
  );
  const configuredTypes = new Set(providers.map((provider) => provider.provider));

  for (const provider of providers) {
    const row = document.createElement('div');
    row.className = `provider-row${provider.isConnected ? ' connected' : ' dim'}`;
    row.dataset.providerId = provider.id;
    const svg = getProviderSvg(provider.provider);
    row.innerHTML = `
      <span class="provider-logo">${svg}</span>
      <div class="provider-info">
        <div class="provider-name">${this.escapeHtml(provider.name)}</div>
        <div class="provider-meta">${provider.models.length} model${provider.models.length === 1 ? '' : 's'} · ${this.escapeHtml(providerSummary(provider))}</div>
      </div>
      <span class="provider-status-dot${provider.isConnected ? '' : ' off'}"></span>
      <div class="row-actions">
        <button class="icon-btn" data-action="configure" title="Edit">&#9998;</button>
        <button class="icon-btn danger" data-action="remove" title="Delete">&times;</button>
      </div>
    `;
    row.addEventListener('click', (event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
      if (!action) return;
      if (action === 'configure') this.openProviderEditor(provider.id);
      if (action === 'remove') this.removeProviderKey(provider.id);
    });
    grid.appendChild(row);
  }

  for (const preset of apiProviderPresets()) {
    if (configuredTypes.has(preset.key)) continue;
    const row = document.createElement('div');
    row.className = 'provider-row dim';
    row.dataset.providerPreset = preset.key;
    const svg = getProviderSvg(preset.key);
    row.innerHTML = `
      <span class="provider-logo">${svg}</span>
      <div class="provider-info">
        <div class="provider-name">${this.escapeHtml(preset.name)}</div>
        <div class="provider-meta">Not configured</div>
      </div>
      <button class="connect-btn" data-action="configure">Add</button>
    `;
    row.addEventListener('click', (event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
      if (action === 'configure') this.openProviderEditor(preset.key);
    });
    grid.appendChild(row);
  }
};

sidePanelProto.openProviderEditor = function openProviderEditor(providerKeyOrId: string) {
  const editor = this.elements.apiProviderEditor as HTMLElement | null;
  if (!editor) return;

  const provider = getProviderInstance({ providers: this.providers }, providerKeyOrId);
  const providerType = provider?.provider || providerKeyOrId;
  const def = PROVIDER_REGISTRY[providerType];
  if (!def) return;

  this._editingProviderId = provider?.id || null;
  this._editingProviderKey = providerType;
  editor.classList.remove('hidden');

  if (this.elements.providerEditorKey) {
    this.elements.providerEditorKey.value = provider?.apiKey || '';
  }
  if (this.elements.providerEditorEndpoint) {
    this.elements.providerEditorEndpoint.value = provider?.customEndpoint || def.defaultBaseUrl || '';
    this.elements.providerEditorEndpoint.placeholder = def.defaultBaseUrl || 'https://...';
  }
  if (this.elements.providerEditorEndpointGroup) {
    this.elements.providerEditorEndpointGroup.style.display =
      providerType === 'custom' ||
      providerType === 'kimi' ||
      providerType === 'openrouter' ||
      providerType === 'glm' ||
      providerType === 'minimax'
        ? ''
        : 'none';
  }
};

sidePanelProto.saveProviderEditorConfig = function saveProviderEditorConfig() {
  const providerType = this._editingProviderKey;
  if (!providerType) return;
  const def = PROVIDER_REGISTRY[providerType];
  if (!def) return;

  const apiKey = this.elements.providerEditorKey?.value?.trim() || '';
  const endpoint = this.elements.providerEditorEndpoint?.value?.trim() || def.defaultBaseUrl || '';
  if (!apiKey && def.type === 'api-key') {
    this.updateStatus('API key is required', 'warning');
    return;
  }

  const existing = this._editingProviderId
    ? getProviderInstance({ providers: this.providers }, this._editingProviderId)
    : null;
  const providerId =
    existing?.id ||
    buildProviderInstanceId({
      provider: providerType,
      authType: 'api-key',
      customEndpoint: endpoint,
      apiKey,
      name: def.name,
    });
  // Always merge definition models with any existing models so the model grid
  // shows every available model, even if the provider was previously saved with
  // only a subset.
  const defModels = (def.models || []).map((m) => ({
    id: m.id,
    label: m.label,
    contextWindow: m.contextWindow,
    supportsVision: m.supportsVision,
  }));
  const existingModels = existing?.models || [];
  const seen = new Set(defModels.map((m) => m.id));
  const seedModels = [...defModels, ...existingModels.filter((m: any) => !seen.has(m.id))];
  const provider: ProviderInstance = ensureProviderModel(
    {
      id: providerId,
      name: existing?.name || def.name,
      provider: providerType,
      authType: 'api-key',
      apiKey,
      customEndpoint: endpoint,
      extraHeaders: existing?.extraHeaders || {},
      isConnected: Boolean(apiKey),
      models: seedModels,
      createdAt: Number(existing?.createdAt || Date.now()),
      updatedAt: Date.now(),
      source: existing?.source || 'manual',
    },
    def.models?.[0]?.id || '',
  );

  this.providers = {
    ...(this.providers || {}),
    [provider.id]: provider,
  };

  this.closeProviderEditor();
  this.populateProviderDropdown?.();
  this.renderApiProviderGrid();
  this.renderModelSelectorGrid?.();
  void this.persistAllSettings();
  this.updateStatus(`${def.name} configured`, 'success');

  // Async: fetch full model list from API for providers that support it
  if (def.supportsModelListing && apiKey) {
    void (async () => {
      try {
        const fetched = await fetchModelsForProvider(def, { type: def.type, apiKey, customEndpoint: endpoint });
        if (fetched.length > 0) {
          const updated = {
            ...this.providers[provider.id],
            models: mergeProviderModels(provider.provider, this.providers[provider.id]?.models || [], fetched),
            updatedAt: Date.now(),
          };
          this.providers = { ...(this.providers || {}), [provider.id]: updated };
          this.renderModelSelectorGrid?.();
          this.renderApiProviderGrid();
          void this.persistAllSettings({ silent: true });
        }
      } catch {}
    })();
  }
};

sidePanelProto.removeProviderKey = function removeProviderKey(providerId: string) {
  if (!providerId || !this.providers?.[providerId]) return;
  const nextProviders = { ...(this.providers || {}) };
  const removed = nextProviders[providerId];
  delete nextProviders[providerId];
  this.providers = nextProviders;

  for (const [name, config] of Object.entries(this.configs || {})) {
    if ((config as Record<string, any>)?.providerId === providerId) {
      this.configs[name] = {
        ...(config as Record<string, any>),
        providerId: '',
        provider: '',
        providerLabel: '',
        apiKey: '',
        customEndpoint: '',
        modelId: '',
        model: '',
      };
    }
  }

  this.populateProviderDropdown?.();
  this.renderApiProviderGrid();
  void this.persistAllSettings();
  this.updateStatus(`${removed?.name || 'Provider'} deleted`, 'success');
};

sidePanelProto.closeProviderEditor = function closeProviderEditor() {
  this._editingProviderId = null;
  this._editingProviderKey = null;
  this.elements.apiProviderEditor?.classList.add('hidden');
};

sidePanelProto.populateProviderDropdown = function populateProviderDropdown() {
  const select = this.elements.profileEditorProvider as HTMLSelectElement | null;
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = '<option value="">Select provider...</option>';

  const providers = listProviderInstances({ providers: this.providers });
  for (const provider of providers) {
    const option = document.createElement('option');
    option.value = provider.id;
    option.textContent = `${provider.name} · ${provider.provider}`;
    select.appendChild(option);
  }

  if (currentValue && Array.from(select.options).some((option) => option.value === currentValue)) {
    select.value = currentValue;
  }
};

sidePanelProto.initProviderCardListeners = function initProviderCardListeners() {
  this.elements.providerEditorSaveBtn?.addEventListener('click', () => this.saveProviderEditorConfig());
  this.elements.providerEditorCancelBtn?.addEventListener('click', () => this.closeProviderEditor());
};
