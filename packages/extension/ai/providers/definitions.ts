// Provider definitions and registry
import { OAUTH_PROVIDERS } from '../../oauth/providers.js';
import type { ProviderDefinition } from './types.js';

function normalizeAnthropicBaseUrl(url: string): string {
  let base = url
    .replace(/\/v1\/messages\/?$/i, '')
    .replace(/\/messages\/?$/i, '')
    .replace(/\/+$/, '');
  if (!/\/v1$/i.test(base)) base = `${base}/v1`;
  return base;
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
  glm: {
    key: 'glm',
    name: 'GLM',
    type: 'api-key',
    sdkType: 'anthropic',
    defaultBaseUrl: 'https://api.z.ai/api/anthropic',
    authHeaderStyle: 'x-api-key',
    supportsModelListing: false,
    normalizeBaseUrl: normalizeAnthropicBaseUrl,
    models: [
      { id: 'glm-5', label: 'GLM-5', contextWindow: 128000 },
      { id: 'glm-4.7', label: 'GLM-4.7', contextWindow: 128000 },
      { id: 'glm-4.7-flash', label: 'GLM-4.7 Flash', contextWindow: 128000 },
      { id: 'glm-4.6v', label: 'GLM-4.6V', contextWindow: 128000, supportsVision: true },
    ],
  },
  minimax: {
    key: 'minimax',
    name: 'MiniMax',
    type: 'api-key',
    sdkType: 'anthropic',
    defaultBaseUrl: 'https://api.minimax.io/anthropic',
    authHeaderStyle: 'x-api-key',
    supportsModelListing: false,
    normalizeBaseUrl: normalizeAnthropicBaseUrl,
    models: [{ id: 'MiniMax-M2.5', label: 'MiniMax M2.5', contextWindow: 1000000 }],
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
