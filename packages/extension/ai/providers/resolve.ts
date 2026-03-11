// Provider SDK resolution
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { ProviderCredentials, ProviderDefinition } from './types.js';

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
