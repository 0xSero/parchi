// Model catalog fetching - targets and fetch operations

import { materializeProfileWithProvider } from '../../../state/provider-registry.js';
import { SidePanelUI } from '../core/panel-ui.js';
import {
  buildModelEndpointCandidates,
  extractModelIds,
  normalizeEndpointBase,
  normalizeHeaders,
  normalizeProvider,
  withTimeout,
} from './model-utils.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

const MODEL_FETCH_TIMEOUT_MS = 9000;
const MAX_MODELS_PER_PROVIDER = 250;

type ModelCatalogTarget = {
  key: string;
  provider: string;
  endpointBase: string;
  headers: Record<string, string>;
};

/**
 * Collect configured model fallbacks from all profiles.
 */
sidePanelProto.collectConfiguredModelFallbacks = function collectConfiguredModelFallbacks() {
  const fallbacks: Array<{ provider: string; model: string }> = [];
  const configs = this.configs && typeof this.configs === 'object' ? this.configs : {};
  for (const [name, rawProfile] of Object.entries(configs)) {
    const profile = materializeProfileWithProvider(
      { providers: this.providers, configs: this.configs },
      name,
      rawProfile,
    );
    if (!profile || typeof profile !== 'object') continue;
    const provider = normalizeProvider((profile as any).provider);
    const model = String((profile as any).modelId || (profile as any).model || '').trim();
    if (!provider || !model) continue;
    fallbacks.push({ provider, model });
  }
  return fallbacks;
};

/**
 * Collect targets for model catalog fetching from configured providers.
 */
sidePanelProto.collectModelCatalogTargets = async function collectModelCatalogTargets() {
  const targets: ModelCatalogTarget[] = [];
  const seen = new Set<string>();
  const configs = this.configs && typeof this.configs === 'object' ? this.configs : {};

  for (const [name, rawProfile] of Object.entries(configs)) {
    const profile = materializeProfileWithProvider(
      { providers: this.providers, configs: this.configs },
      name,
      rawProfile,
    );
    if (!profile || typeof profile !== 'object') continue;
    const provider = normalizeProvider((profile as any).provider);
    if (!provider) continue;

    const apiKey = String((profile as any).apiKey || '').trim();
    const extraHeaders = normalizeHeaders((profile as any).extraHeaders);
    const endpointBase = normalizeEndpointBase(provider, String((profile as any).customEndpoint || ''));
    if (!endpointBase) continue;

    const allowsUnauthedList = provider === 'openrouter' || provider === 'parchi';
    if (!apiKey && !allowsUnauthedList) continue;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...extraHeaders,
    };

    if (provider === 'anthropic' || provider === 'kimi') {
      if (apiKey) {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      }
    } else if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    if (provider === 'openrouter' || provider === 'parchi') {
      headers['HTTP-Referer'] = headers['HTTP-Referer'] || 'https://parchi.ai';
      headers['X-Title'] = headers['X-Title'] || 'Parchi';
    }

    const key = `${provider}|${endpointBase}|${Boolean(apiKey)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({
      key,
      provider,
      endpointBase,
      headers,
    });
  }

  return targets;
};

/**
 * Fetch model IDs for a specific catalog target.
 */
sidePanelProto.fetchModelIdsForTarget = async function fetchModelIdsForTarget(target: ModelCatalogTarget) {
  const urls = buildModelEndpointCandidates(target.endpointBase);
  for (const url of urls) {
    try {
      const response = await withTimeout(
        fetch(url, {
          method: 'GET',
          headers: target.headers,
        }),
        MODEL_FETCH_TIMEOUT_MS,
      );
      if (!response.ok) continue;
      const payload = await response.json().catch(() => null);
      const modelIds = extractModelIds(payload).slice(0, MAX_MODELS_PER_PROVIDER);
      if (modelIds.length > 0) {
        return modelIds;
      }
    } catch {}
  }
  return [];
};
