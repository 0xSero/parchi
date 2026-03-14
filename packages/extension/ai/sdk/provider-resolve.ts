// Language model provider resolution
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { resolveOAuthProvider } from './provider-oauth.js';
import { resolveProxyProvider } from './provider-proxy.js';
import {
  resolveAnthropicCompatibleProvider,
  resolveCustomProvider,
  resolveOpenRouterProvider,
} from './provider-standard.js';
import type { SDKModelSettings } from './provider-types.js';

export function resolveLanguageModel(settings: SDKModelSettings) {
  const provider = settings.provider || 'openai';
  const modelId = String(settings.model || '').trim();
  const apiKey = settings.apiKey || '';
  const extraHeaders =
    settings.extraHeaders && typeof settings.extraHeaders === 'object' ? settings.extraHeaders : undefined;

  if (!modelId) {
    throw new Error('No model configured. Open Settings and choose a model before running.');
  }

  if (settings.useProxy && settings.proxyBaseUrl && settings.proxyAuthToken) {
    return resolveProxyProvider(settings, modelId, extraHeaders);
  }

  if (provider === 'anthropic') {
    return createAnthropic({ apiKey, headers: extraHeaders })(modelId);
  }

  if (provider === 'glm' || provider === 'minimax' || provider === 'kimi') {
    return resolveAnthropicCompatibleProvider(provider, settings, apiKey, extraHeaders, modelId);
  }

  if (provider === 'openrouter' || provider === 'parchi') {
    return resolveOpenRouterProvider(provider, apiKey, extraHeaders, modelId);
  }

  if (provider.endsWith('-oauth')) {
    return resolveOAuthProvider(provider, settings, extraHeaders, modelId);
  }

  if (provider === 'custom') {
    return resolveCustomProvider(settings, apiKey, extraHeaders, modelId);
  }

  return createOpenAI({ apiKey, headers: extraHeaders })(modelId);
}
