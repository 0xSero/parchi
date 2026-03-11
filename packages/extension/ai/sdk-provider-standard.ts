// Standard provider resolution (non-OAuth, non-proxy)
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { normalizeOpenRouterModelId } from './sdk-model-normalize.js';
import type { SDKModelSettings } from './sdk-provider-types.js';
import { toAnthropicBaseUrl } from './sdk-provider-utils.js';

export function resolveAnthropicCompatibleProvider(
  provider: string,
  settings: SDKModelSettings,
  apiKey: string,
  extraHeaders: Record<string, string> | undefined,
  modelId: string,
) {
  const fallbackBase =
    provider === 'glm'
      ? 'https://api.z.ai/api/anthropic'
      : provider === 'minimax'
        ? 'https://api.minimax.io/anthropic'
        : 'https://api.kimi.com/coding';
  return createAnthropic({
    apiKey,
    baseURL: toAnthropicBaseUrl(settings.customEndpoint || fallbackBase),
    headers: extraHeaders,
  })(modelId);
}

export function resolveOpenRouterProvider(
  provider: string,
  apiKey: string,
  extraHeaders: Record<string, string> | undefined,
  modelId: string,
) {
  const openRouterProvider = createOpenAICompatible({
    name: provider === 'parchi' ? 'parchi-managed' : 'openrouter',
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    headers: { ...extraHeaders, 'HTTP-Referer': 'https://parchi.app', 'X-Title': 'Parchi' },
  });
  return openRouterProvider(normalizeOpenRouterModelId(modelId));
}

export function resolveCustomProvider(
  settings: SDKModelSettings,
  apiKey: string,
  extraHeaders: Record<string, string> | undefined,
  modelId: string,
) {
  const rawBase = settings.customEndpoint
    ? settings.customEndpoint
        .replace(/\/chat\/completions\/?$/i, '')
        .replace(/\/v1\/messages\/?$/i, '')
        .replace(/\/messages\/?$/i, '')
        .replace(/\/+$/, '')
    : '';

  if (!rawBase) {
    throw new Error('Custom provider requires a customEndpoint to be configured');
  }

  return createOpenAICompatible({
    name: 'custom',
    apiKey,
    baseURL: rawBase,
    headers: extraHeaders,
  })(modelId);
}
