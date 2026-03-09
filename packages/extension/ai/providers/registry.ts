import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { OAUTH_PROVIDERS } from '../../oauth/providers.js';
import { extractModelEntries, fetchWithTimeout } from './model-listing.js';
import type { ModelEntry, ProviderCredentials, ProviderDefinition } from './types.js';

function normalizeAnthropicBaseUrl(url: string): string {
  let base = url
    .replace(/\/v1\/messages\/?$/i, '')
    .replace(/\/messages\/?$/i, '')
    .replace(/\/+$/, '');
  if (!/\/v1$/i.test(base)) base = `${base}/v1`;
  return base;
}

function resolveModelListingBaseUrl(baseUrl: string, mode: 'base' | 'origin' = 'base'): string {
  const trimmed = String(baseUrl || '')
    .trim()
    .replace(/\/+$/, '');
  if (!trimmed) return '';
  if (mode !== 'origin') return trimmed;

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/v1$/i, '').replace(/\/api$/i, '');
  }
}

export const PROVIDER_REGISTRY: Record<string, ProviderDefinition> = {
  anthropic: {
    key: 'anthropic',
    name: 'Anthropic',
    type: 'api-key',
    sdkType: 'anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    authHeaderStyle: 'x-api-key',
    supportsModelListing: true,
    modelsEndpoint: '/v1/models',
    proxyProvider: 'anthropic',
  },
  'claude-oauth': {
    key: 'claude-oauth',
    name: 'Claude',
    type: 'oauth',
    sdkType: 'anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    authHeaderStyle: 'x-api-key',
    supportsModelListing: true,
    modelsEndpoint: '/v1/models',
    oauth: OAUTH_PROVIDERS.claude,
    models: OAUTH_PROVIDERS.claude?.models,
  },
  openai: {
    key: 'openai',
    name: 'OpenAI',
    type: 'api-key',
    sdkType: 'openai',
    defaultBaseUrl: 'https://api.openai.com/v1',
    authHeaderStyle: 'bearer',
    supportsModelListing: true,
    modelsEndpoint: '/v1/models',
    proxyProvider: 'openai',
  },
  'codex-oauth': {
    key: 'codex-oauth',
    name: 'Codex (OpenAI)',
    type: 'oauth',
    sdkType: 'openai',
    defaultBaseUrl: 'https://chatgpt.com/backend-api/codex',
    authHeaderStyle: 'bearer',
    supportsModelListing: true,
    modelsEndpoint: '/models?client_version=1.0.0',
    oauth: OAUTH_PROVIDERS.codex,
    models: OAUTH_PROVIDERS.codex?.models,
  },
  'copilot-oauth': {
    key: 'copilot-oauth',
    name: 'GitHub Copilot',
    type: 'oauth',
    sdkType: 'openai-compatible',
    defaultBaseUrl: 'https://api.githubcopilot.com',
    authHeaderStyle: 'bearer',
    supportsModelListing: true,
    modelsEndpoint: '/models',
    defaultHeaders: OAUTH_PROVIDERS.copilot?.apiHeaders,
    oauth: OAUTH_PROVIDERS.copilot,
    models: OAUTH_PROVIDERS.copilot?.models,
  },
  kimi: {
    key: 'kimi',
    name: 'Kimi',
    type: 'api-key',
    sdkType: 'anthropic',
    defaultBaseUrl: 'https://api.kimi.com/coding/v1',
    authHeaderStyle: 'x-api-key',
    supportsModelListing: false,
    proxyProvider: 'kimi',
    normalizeBaseUrl: normalizeAnthropicBaseUrl,
    models: [
      { id: 'kimi-k2-0520', label: 'Kimi K2' },
      { id: 'kimi-for-coding', label: 'Kimi for Coding' },
    ],
  },
  'ollama-cloud': {
    key: 'ollama-cloud',
    name: 'Ollama Cloud',
    type: 'api-key',
    sdkType: 'openai-compatible',
    defaultBaseUrl: 'https://ollama.com/v1',
    authHeaderStyle: 'bearer',
    supportsModelListing: true,
    modelsEndpoint: '/api/tags',
    modelListingBaseUrlMode: 'origin',
    proxyProvider: 'openai',
  },
  'qwen-oauth': {
    key: 'qwen-oauth',
    name: 'Qwen',
    type: 'oauth',
    sdkType: 'openai-compatible',
    defaultBaseUrl: 'https://chat.qwen.ai/api/v1/openai/compatible-mode/v1',
    authHeaderStyle: 'bearer',
    supportsModelListing: true,
    modelsEndpoint: '/models',
    oauth: OAUTH_PROVIDERS.qwen,
    models: OAUTH_PROVIDERS.qwen?.models,
  },
  openrouter: {
    key: 'openrouter',
    name: 'OpenRouter',
    type: 'api-key',
    sdkType: 'openai-compatible',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    authHeaderStyle: 'bearer',
    supportsModelListing: true,
    modelsEndpoint: '/models',
    defaultHeaders: {
      'HTTP-Referer': 'https://parchi.app',
      'X-Title': 'Parchi',
    },
    proxyProvider: 'openrouter',
  },
  parchi: {
    key: 'parchi',
    name: 'Parchi (Managed)',
    type: 'managed',
    sdkType: 'openai-compatible',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    authHeaderStyle: 'bearer',
    supportsModelListing: false,
    defaultHeaders: {
      'HTTP-Referer': 'https://parchi.app',
      'X-Title': 'Parchi',
    },
    proxyProvider: 'openrouter',
  },
  custom: {
    key: 'custom',
    name: 'Custom',
    type: 'api-key',
    sdkType: 'openai-compatible',
    defaultBaseUrl: '',
    authHeaderStyle: 'bearer',
    supportsModelListing: true,
    modelsEndpoint: '/models',
  },
};

export function getProviderDefinition(key: string): ProviderDefinition | null {
  return PROVIDER_REGISTRY[key] || null;
}

export function getAllProviders(): ProviderDefinition[] {
  return Object.values(PROVIDER_REGISTRY);
}

export function getApiKeyProviders(): ProviderDefinition[] {
  return getAllProviders().filter((p) => p.type === 'api-key');
}

export function getOAuthProviders(): ProviderDefinition[] {
  return getAllProviders().filter((p) => p.type === 'oauth');
}

export function resolveProviderSdk(def: ProviderDefinition, credentials: ProviderCredentials) {
  const apiKey = credentials.oauthAccessToken || credentials.apiKey || '';
  const baseURL = credentials.customEndpoint || def.defaultBaseUrl;
  const headers = { ...def.defaultHeaders, ...credentials.extraHeaders };

  switch (def.sdkType) {
    case 'anthropic': {
      const resolvedBase = def.normalizeBaseUrl ? def.normalizeBaseUrl(baseURL) : baseURL;
      const provider = createAnthropic({ apiKey, baseURL: resolvedBase, headers });
      return provider;
    }
    case 'openai': {
      const provider = createOpenAI({ apiKey, baseURL, headers });
      return provider;
    }
    case 'openai-compatible': {
      if (!baseURL) throw new Error(`Provider ${def.name} requires a base URL`);
      const normalizedBase = baseURL
        .replace(/\/chat\/completions\/?$/i, '')
        .replace(/\/v1\/messages\/?$/i, '')
        .replace(/\/messages\/?$/i, '')
        .replace(/\/+$/, '');
      const provider = createOpenAICompatible({
        name: def.key,
        apiKey,
        baseURL: normalizedBase,
        headers,
      });
      return provider;
    }
    default:
      throw new Error(`Unknown SDK type: ${def.sdkType}`);
  }
}

export async function fetchModelsForProvider(
  def: ProviderDefinition,
  credentials: ProviderCredentials,
): Promise<ModelEntry[]> {
  if (!def.supportsModelListing) {
    return def.models || [];
  }

  const apiKey = credentials.oauthAccessToken || credentials.apiKey || '';
  if (!apiKey) return def.models || [];

  const baseURL = (credentials.customEndpoint || def.defaultBaseUrl).replace(/\/+$/, '');
  if (!baseURL) return def.models || [];

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...def.defaultHeaders,
    ...credentials.extraHeaders,
  };

  if (def.authHeaderStyle === 'x-api-key') {
    headers['X-Api-Key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const endpoint = def.modelsEndpoint || '/models';
  let base = resolveModelListingBaseUrl(baseURL, def.modelListingBaseUrlMode);
  if (base.endsWith('/v1') && endpoint.startsWith('/v1/')) {
    base = base.slice(0, -3);
  }

  try {
    const response = await fetchWithTimeout(`${base}${endpoint}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      console.warn(`[provider-registry] ${def.key} model fetch returned ${response.status}`);
      return def.models || [];
    }
    const data = await response.json();
    const models = extractModelEntries(data);
    return models.length > 0 ? models : def.models || [];
  } catch (err) {
    console.warn(`[provider-registry] Failed to fetch models for ${def.key}:`, err);
    return def.models || [];
  }
}
