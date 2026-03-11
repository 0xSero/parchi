// Model catalog - refresh and suggestion management

import { fetchProviderModels, getAllProviderStates } from '../../../oauth/manager.js';
import type { OAuthProviderKey } from '../../../oauth/types.js';
import { materializeProfileWithProvider } from '../../../state/provider-registry.js';
import { SidePanelUI } from '../core/panel-ui.js';
import { normalizeProvider, populateModelSuggestionList } from './model-utils.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

const MODEL_CATALOG_TTL_MS = 3 * 60 * 1000;
const MAX_MODELS_TOTAL = 600;

/**
 * Fetch available models from all configured providers.
 */
sidePanelProto.fetchAvailableModels = async function fetchAvailableModels() {
  this.populateModelSelect();
  this.updateModelDisplay();
  await this.refreshModelCatalog();
};

/**
 * Apply model suggestions to the UI based on catalog entries.
 */
sidePanelProto.applyModelSuggestions = function applyModelSuggestions() {
  const entries = Array.isArray(this.modelCatalogEntries) ? this.modelCatalogEntries : [];
  const deduped = new Map<string, string>();
  for (const entry of entries) {
    const model = String(entry?.model || '').trim();
    const provider = normalizeProvider(entry?.provider);
    if (!model || !provider) continue;
    if (!deduped.has(model)) {
      deduped.set(model, provider);
    }
  }

  const ordered = Array.from(deduped.entries())
    .map(([model, provider]) => ({ model, provider }))
    .sort((a, b) => a.model.localeCompare(b.model));

  // Populate Setup tab model suggestions for the active provider only.
  const modelInput = this.elements.model as HTMLInputElement | null;
  const modelSuggestions =
    this.elements.modelSuggestions || (document.getElementById('modelSuggestions') as HTMLDataListElement | null);
  const activeProfile = materializeProfileWithProvider(
    { providers: this.providers, configs: this.configs },
    this.currentConfig,
    this.configs?.[this.currentConfig] || {},
  );
  const activeProvider = normalizeProvider(activeProfile.provider);
  const providerScoped = activeProvider ? ordered.filter((item) => item.provider === activeProvider) : ordered;
  const providerModels = providerScoped.slice(0, MAX_MODELS_TOTAL).map((item) => item.model);

  if (modelSuggestions) {
    populateModelSuggestionList(modelSuggestions, providerModels);
  }

  if (modelInput) {
    const currentModel = String(modelInput.value || activeProfile.model || '').trim();
    modelInput.value = currentModel;
  }

  if (!this.elements.modelHint) return;
  if (activeProvider === 'custom') {
    this.elements.modelHint.textContent =
      providerModels.length > 0
        ? `Discovered ${providerModels.length} custom model${providerModels.length === 1 ? '' : 's'} from your endpoint.`
        : 'Type a model ID. Suggestions appear when your endpoint responds to /models or /v1/models.';
    return;
  }
  if (providerModels.length > 0) {
    this.elements.modelHint.textContent = `Discovered ${providerModels.length} models for ${activeProvider}.`;
  }
};

/**
 * Refresh the model catalog from all configured providers.
 */
sidePanelProto.refreshModelCatalog = async function refreshModelCatalog({ force = false } = {}) {
  const now = Date.now();
  const hasFreshCatalog =
    !force &&
    Array.isArray(this.modelCatalogEntries) &&
    this.modelCatalogEntries.length > 0 &&
    now - Number(this.modelCatalogUpdatedAt || 0) < MODEL_CATALOG_TTL_MS;

  if (hasFreshCatalog) {
    this.applyModelSuggestions();
    return;
  }

  if (this.modelCatalogRefreshPromise) {
    await this.modelCatalogRefreshPromise;
    return;
  }

  this.modelCatalogRefreshPromise = (async () => {
    const discovered: Array<{ provider: string; model: string }> = this.collectConfiguredModelFallbacks();

    // Fetch models from connected OAuth providers via their APIs
    try {
      const oauthStates = await getAllProviderStates();
      const oauthFetches = Object.entries(oauthStates)
        .filter(([, state]) => state?.connected && state?.tokens?.accessToken)
        .map(async ([key]) => {
          const providerKey = `${key}-oauth`;
          const models = await fetchProviderModels(key as OAuthProviderKey);
          return { providerKey, models };
        });
      const oauthResults = await Promise.all(oauthFetches);
      for (const { providerKey, models } of oauthResults) {
        for (const modelId of models) {
          discovered.push({ provider: providerKey, model: modelId });
        }
      }
    } catch {}

    const targets = await this.collectModelCatalogTargets();
    const results = await Promise.all(
      targets.map(async (target) => {
        const modelIds = await this.fetchModelIdsForTarget(target);
        return {
          provider: target.provider,
          modelIds,
        };
      }),
    );

    for (const result of results) {
      for (const model of result.modelIds) {
        discovered.push({ provider: result.provider, model });
      }
    }

    const seen = new Set<string>();
    const normalized: Array<{ provider: string; model: string }> = [];
    for (const entry of discovered) {
      const provider = normalizeProvider(entry.provider);
      const model = String(entry.model || '').trim();
      if (!provider || !model) continue;
      const key = `${provider}|${model}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push({ provider, model });
    }

    this.modelCatalogEntries = normalized.slice(0, MAX_MODELS_TOTAL);
    this.modelCatalogUpdatedAt = Date.now();
    this.applyModelSuggestions();
  })();

  try {
    await this.modelCatalogRefreshPromise;
  } finally {
    this.modelCatalogRefreshPromise = null;
  }
};
