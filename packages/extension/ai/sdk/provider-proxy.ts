// Proxy provider resolution
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { normalizeOpenRouterModelId } from './model-normalize.js';
import type { SDKModelSettings } from './provider-types.js';

export function resolveProxyProvider(
  settings: SDKModelSettings,
  modelId: string,
  extraHeaders: Record<string, string> | undefined,
) {
  const normalizedBase = settings.proxyBaseUrl!.replace(/\/+$/, '');
  const provider = settings.provider || 'openai';
  const proxyProvider =
    settings.proxyProvider ||
    (provider === 'anthropic' || provider === 'kimi' || provider === 'glm' || provider === 'minimax'
      ? 'anthropic'
      : provider === 'openrouter' || provider === 'parchi'
        ? 'openrouter'
        : 'openai');

  if (proxyProvider === 'anthropic') {
    return createAnthropic({
      apiKey: 'convex-proxy',
      baseURL: `${normalizedBase}/ai-proxy/anthropic/v1`,
      headers: { ...extraHeaders, Authorization: `Bearer ${settings.proxyAuthToken}` },
    })(modelId);
  }

  if (proxyProvider === 'kimi') {
    return createAnthropic({
      apiKey: 'convex-proxy',
      baseURL: `${normalizedBase}/ai-proxy/kimi/v1`,
      headers: { ...extraHeaders, Authorization: `Bearer ${settings.proxyAuthToken}` },
    })(modelId);
  }

  if (proxyProvider === 'openrouter') {
    return createOpenAICompatible({
      name: 'openrouter-proxy',
      apiKey: settings.proxyAuthToken,
      baseURL: `${normalizedBase}/ai-proxy/openrouter/v1`,
      headers: { ...extraHeaders, 'HTTP-Referer': 'https://parchi.app', 'X-Title': 'Parchi' },
    })(normalizeOpenRouterModelId(modelId));
  }

  return createOpenAICompatible({
    name: 'convex-proxy',
    apiKey: settings.proxyAuthToken,
    baseURL: `${normalizedBase}/ai-proxy/openai`,
    headers: extraHeaders,
  })(modelId);
}
