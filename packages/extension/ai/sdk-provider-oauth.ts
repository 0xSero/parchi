// OAuth provider resolution
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { normalizeOAuthModelIdForProvider } from '../oauth/model-normalization.js';
import { CODEX_OAUTH_BASE_URL } from './codex-oauth.js';
import type { SDKModelSettings } from './sdk-provider-types.js';

export function resolveOAuthProvider(
  provider: string,
  settings: SDKModelSettings,
  extraHeaders: Record<string, string> | undefined,
  modelId: string,
) {
  const baseProvider = provider.replace(/-oauth$/, '');

  if (!settings.oauthAccessToken) {
    throw new Error(`OAuth session expired for ${baseProvider}. Please reconnect in Settings > OAuth.`);
  }

  const oauthModelId = normalizeOAuthModelIdForProvider(baseProvider, modelId);
  if (!oauthModelId) {
    throw new Error('No model configured. Open Settings and choose a model before running.');
  }

  if (baseProvider === 'claude') {
    return createAnthropic({
      apiKey: settings.oauthAccessToken,
      baseURL: settings.oauthApiBaseUrl || 'https://api.anthropic.com/v1',
      headers: { ...extraHeaders, ...settings.oauthApiHeaders },
    })(oauthModelId);
  }

  if (baseProvider === 'copilot') {
    return createOpenAICompatible({
      name: 'github-copilot',
      apiKey: settings.oauthAccessToken,
      baseURL: settings.oauthApiBaseUrl || 'https://api.githubcopilot.com',
      headers: { ...extraHeaders, ...(settings.oauthApiHeaders || {}) },
    })(oauthModelId);
  }

  if (baseProvider === 'codex') {
    return createOpenAI({
      apiKey: settings.oauthAccessToken,
      baseURL: settings.oauthApiBaseUrl || CODEX_OAUTH_BASE_URL,
      headers: { ...extraHeaders, ...settings.oauthApiHeaders },
    })(oauthModelId);
  }

  return createOpenAICompatible({
    name: `${baseProvider}-oauth`,
    apiKey: settings.oauthAccessToken,
    baseURL: settings.oauthApiBaseUrl || 'https://api.openai.com/v1',
    headers: { ...extraHeaders, ...settings.oauthApiHeaders },
  })(oauthModelId);
}
