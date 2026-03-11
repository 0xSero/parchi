// Model profile editor - catalog fetching for profile editor UI

import { fetchProviderModels } from '../../../oauth/manager.js';
import type { OAuthProviderKey } from '../../../oauth/types.js';
import {
  ensureProviderModel,
  getProviderInstance,
  materializeProfileWithProvider,
} from '../../../state/provider-registry.js';
import { SidePanelUI } from '../core/panel-ui.js';
import {
  buildModelEndpointCandidates,
  normalizeEndpointBase,
  populateModelSelectElement,
  withTimeout,
} from './model-utils.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

const MODEL_FETCH_TIMEOUT_MS = 9000;

/**
 * Refresh model catalog specifically for the profile editor.
 */
sidePanelProto.refreshModelCatalogForProfileEditor = async function refreshModelCatalogForProfileEditor() {
  const providerEl = this.elements.profileEditorProvider;
  const modelSelect = this.elements.profileEditorModel as HTMLSelectElement | null;
  const modelDatalist = this.elements.profileEditorModelList as HTMLDataListElement | null;
  const modelInput = this.elements.profileEditorModelInput as HTMLInputElement | null;
  if (!providerEl) return;

  const providerId = String(providerEl.value || '').trim();
  const providerInstance = getProviderInstance({ providers: this.providers }, providerId);
  const provider = String(providerInstance?.provider || '')
    .trim()
    .toLowerCase();
  const currentModel = String(modelInput?.value || modelSelect?.value || '').trim();

  if (!provider) {
    this._profileEditorModels = [];
    if (modelSelect) populateModelSelectElement(modelSelect, [], currentModel, 'Select model...', modelDatalist);
    return;
  }

  // OAuth providers - fetch models from their APIs
  if (provider.endsWith('-oauth')) {
    const baseKey = provider.replace(/-oauth$/, '') as OAuthProviderKey;
    if (modelSelect) {
      const loadingOpt = document.createElement('option');
      loadingOpt.value = currentModel;
      loadingOpt.textContent = 'Fetching models...';
      modelSelect.innerHTML = '';
      modelSelect.appendChild(loadingOpt);
    }
    try {
      const modelIds = await fetchProviderModels(baseKey);
      this._profileEditorModels = modelIds.sort((a: string, b: string) => a.localeCompare(b));
      if (providerInstance && modelIds.length > 0) {
        let nextProvider = providerInstance;
        for (const modelId of modelIds) nextProvider = ensureProviderModel(nextProvider, modelId);
        this.providers = { ...(this.providers || {}), [nextProvider.id]: nextProvider };
      }
    } catch {
      this._profileEditorModels = [];
    }
    if (modelSelect) {
      populateModelSelectElement(
        modelSelect,
        this._profileEditorModels,
        currentModel,
        'Select model...',
        modelDatalist,
      );
    }
    return;
  }

  const apiKey = String(providerInstance?.apiKey || '').trim();
  const customEndpoint = String(providerInstance?.customEndpoint || '').trim();

  const endpointBase = normalizeEndpointBase(provider, customEndpoint);
  if (!endpointBase) {
    this._profileEditorModels = [];
    if (modelSelect) populateModelSelectElement(modelSelect, [], currentModel, 'Select model...', modelDatalist);
    return;
  }

  const allowsUnauthedList = provider === 'openrouter' || provider === 'parchi';
  if (!apiKey && !allowsUnauthedList) {
    this._profileEditorModels = [];
    if (modelSelect) populateModelSelectElement(modelSelect, [], currentModel, 'Select model...', modelDatalist);
    return;
  }

  // Show loading state
  if (modelSelect) {
    const loadingOpt = document.createElement('option');
    loadingOpt.value = currentModel;
    loadingOpt.textContent = 'Fetching models...';
    modelSelect.innerHTML = '';
    modelSelect.appendChild(loadingOpt);
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (provider === 'anthropic' || provider === 'kimi') {
    if (apiKey) {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    }
  } else if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (provider === 'openrouter' || provider === 'parchi') {
    headers['HTTP-Referer'] = 'https://parchi.ai';
    headers['X-Title'] = 'Parchi';
  }

  const target = { key: `editor|${provider}`, provider, endpointBase, headers };
  try {
    const urls = buildModelEndpointCandidates(target.endpointBase);
    let modelIds: string[] = [];
    for (const url of urls) {
      try {
        const response = await withTimeout(
          fetch(url, { method: 'GET', headers: target.headers }),
          MODEL_FETCH_TIMEOUT_MS,
        );
        if (!response.ok) continue;
        const payload = await response.json().catch(() => null);
        const { extractModelIds } = await import('./model-utils.js');
        modelIds = extractModelIds(payload).slice(0, 250);
        if (modelIds.length > 0) break;
      } catch {}
    }
    this._profileEditorModels = modelIds.sort((a: string, b: string) => a.localeCompare(b));
    if (providerInstance && modelIds.length > 0) {
      let nextProvider = providerInstance;
      for (const modelId of modelIds) nextProvider = ensureProviderModel(nextProvider, modelId);
      this.providers = { ...(this.providers || {}), [nextProvider.id]: nextProvider };
    }
  } catch {
    this._profileEditorModels = [];
  }
  if (modelSelect) {
    populateModelSelectElement(modelSelect, this._profileEditorModels, currentModel, 'Select model...', modelDatalist);
  }
};

/**
 * Update the model display to show current selection.
 */
sidePanelProto.updateModelDisplay = function updateModelDisplay() {
  const select = this.elements.modelSelect;
  if (!select) return;

  const activeConfig = materializeProfileWithProvider(
    { providers: this.providers, configs: this.configs },
    this.currentConfig,
    this.configs?.[this.currentConfig] || {},
  );
  const providerId = String(activeConfig?.providerId || '').trim();
  const modelId = String(activeConfig?.modelId || activeConfig?.model || '').trim();
  if (!providerId || !modelId) return;

  import('./model-utils.js').then(({ encodeModelSelectValue }) => {
    select.value = encodeModelSelectValue(providerId, modelId);
  });
};
