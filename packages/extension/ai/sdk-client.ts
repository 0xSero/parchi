import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { ToolDefinition } from '@parchi/shared';
import { generateText, jsonSchema, tool } from 'ai';
import { normalizeOAuthModelIdForProvider } from '../oauth/model-normalization.js';
import { CODEX_OAUTH_BASE_URL, buildCodexOAuthProviderOptions, isCodexOAuthProvider } from './codex-oauth.js';

export type { ToolDefinition };
export { CODEX_OAUTH_BASE_URL, buildCodexOAuthProviderOptions, isCodexOAuthProvider } from './codex-oauth.js';

export type SDKModelSettings = {
  provider: string;
  apiKey: string;
  model: string;
  customEndpoint?: string;
  extraHeaders?: Record<string, string>;
  useProxy?: boolean;
  proxyBaseUrl?: string;
  proxyAuthToken?: string;
  proxyProvider?: 'openai' | 'anthropic' | 'kimi' | 'openrouter';
  oauthAccessToken?: string;
  oauthApiBaseUrl?: string;
  oauthApiHeaders?: Record<string, string>;
};

export function normalizeOpenRouterModelId(modelId: string): string {
  let model = modelId.trim();
  if (/^(parchi|openrouter)\//i.test(model)) {
    const parts = model.split('/');
    if (parts.length >= 2) {
      model = parts.slice(1).join('/');
    }
  }
  if (!model || model.includes('/')) return model;
  const lower = model.toLowerCase();
  if (lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('o4'))
    return `openai/${model}`;
  if (lower.startsWith('claude')) return `anthropic/${model}`;
  if (lower.startsWith('gemini')) return `google/${model}`;
  if (lower.startsWith('deepseek')) return `deepseek/${model}`;
  if (lower.startsWith('qwen')) return `qwen/${model}`;
  if (lower.includes('llama')) return `meta-llama/${model}`;
  return model;
}

const toAnthropicBaseUrl = (value: string) => {
  const base = value
    .replace(/\/v1\/messages\/?$/i, '')
    .replace(/\/messages\/?$/i, '')
    .replace(/\/+$/, '');
  return /\/v1$/i.test(base) ? base : `${base}/v1`;
};

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
    const normalizedBase = settings.proxyBaseUrl.replace(/\/+$/, '');
    const proxyProvider =
      settings.proxyProvider ||
      (provider === 'anthropic' || provider === 'kimi' || provider === 'glm' || provider === 'minimax'
        ? 'anthropic'
        : provider === 'openrouter' || provider === 'parchi'
          ? 'openrouter'
          : 'openai');

    if (proxyProvider === 'anthropic') {
      const anthropicProxy = createAnthropic({
        apiKey: 'convex-proxy',
        baseURL: `${normalizedBase}/ai-proxy/anthropic/v1`,
        headers: {
          ...extraHeaders,
          Authorization: `Bearer ${settings.proxyAuthToken}`,
        },
      });
      return anthropicProxy(modelId);
    }

    if (proxyProvider === 'kimi') {
      const kimiProxy = createAnthropic({
        apiKey: 'convex-proxy',
        baseURL: `${normalizedBase}/ai-proxy/kimi/v1`,
        headers: {
          ...extraHeaders,
          Authorization: `Bearer ${settings.proxyAuthToken}`,
        },
      });
      return kimiProxy(modelId);
    }

    if (proxyProvider === 'openrouter') {
      const openRouterProxy = createOpenAICompatible({
        name: 'openrouter-proxy',
        apiKey: settings.proxyAuthToken,
        // Convex deployments in the wild commonly route OpenRouter via /v1.
        // Keeping /v1 in the client path avoids HTML fallthrough on older routes.
        baseURL: `${normalizedBase}/ai-proxy/openrouter/v1`,
        headers: {
          ...extraHeaders,
          'HTTP-Referer': 'https://parchi.app',
          'X-Title': 'Parchi',
        },
      });
      return openRouterProxy(normalizeOpenRouterModelId(modelId));
    }

    const openAiProxy = createOpenAICompatible({
      name: 'convex-proxy',
      apiKey: settings.proxyAuthToken,
      baseURL: `${normalizedBase}/ai-proxy/openai`,
      headers: extraHeaders,
    });
    return openAiProxy(modelId);
  }

  if (provider === 'anthropic') {
    const providerInstance = createAnthropic({ apiKey, headers: extraHeaders });
    return providerInstance(modelId);
  }

  if (provider === 'glm' || provider === 'minimax' || provider === 'kimi') {
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

  if (provider === 'openrouter' || provider === 'parchi') {
    const openRouterProvider = createOpenAICompatible({
      name: provider === 'parchi' ? 'parchi-managed' : 'openrouter',
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      headers: {
        ...extraHeaders,
        'HTTP-Referer': 'https://parchi.app',
        'X-Title': 'Parchi',
      },
    });
    return openRouterProvider(normalizeOpenRouterModelId(modelId));
  }

  if (provider.endsWith('-oauth') && !settings.oauthAccessToken) {
    const baseProvider = provider.replace(/-oauth$/, '');
    throw new Error(`OAuth session expired for ${baseProvider}. Please reconnect in Settings > OAuth.`);
  }

  if (provider.endsWith('-oauth') && settings.oauthAccessToken) {
    const baseProvider = provider.replace(/-oauth$/, '');
    const oauthModelId = normalizeOAuthModelIdForProvider(baseProvider, modelId);
    if (!oauthModelId) {
      throw new Error('No model configured. Open Settings and choose a model before running.');
    }

    if (baseProvider === 'claude') {
      const anthropicOAuth = createAnthropic({
        apiKey: settings.oauthAccessToken,
        baseURL: settings.oauthApiBaseUrl || 'https://api.anthropic.com/v1',
        headers: { ...extraHeaders, ...settings.oauthApiHeaders },
      });
      return anthropicOAuth(oauthModelId);
    }

    if (baseProvider === 'copilot') {
      const copilotProvider = createOpenAICompatible({
        name: 'github-copilot',
        apiKey: settings.oauthAccessToken,
        baseURL: settings.oauthApiBaseUrl || 'https://api.githubcopilot.com',
        headers: {
          ...extraHeaders,
          ...(settings.oauthApiHeaders || {}),
        },
      });
      return copilotProvider(oauthModelId);
    }

    if (baseProvider === 'codex') {
      const codexOAuth = createOpenAI({
        apiKey: settings.oauthAccessToken,
        baseURL: settings.oauthApiBaseUrl || CODEX_OAUTH_BASE_URL,
        headers: { ...extraHeaders, ...settings.oauthApiHeaders },
      });
      return codexOAuth(oauthModelId);
    }

    const oauthProvider = createOpenAICompatible({
      name: `${baseProvider}-oauth`,
      apiKey: settings.oauthAccessToken,
      baseURL: settings.oauthApiBaseUrl || 'https://api.openai.com/v1',
      headers: { ...extraHeaders, ...settings.oauthApiHeaders },
    });
    return oauthProvider(oauthModelId);
  }

  if (provider === 'custom') {
    // Normalize the base URL
    // - Remove /chat/completions suffix if present (SDK will add it)
    // - Remove /messages suffix if present
    // - Remove trailing slashes
    const rawBase = settings.customEndpoint
      ? settings.customEndpoint
          .replace(/\/chat\/completions\/?$/i, '')
          .replace(/\/v1\/messages\/?$/i, '')
          .replace(/\/messages\/?$/i, '')
          .replace(/\/+$/, '')
      : '';

    const baseURL = rawBase;

    if (!baseURL) {
      throw new Error('Custom provider requires a customEndpoint to be configured');
    }

    const customProvider = createOpenAICompatible({
      name: provider,
      apiKey,
      baseURL,
      headers: extraHeaders,
    });
    return customProvider(modelId);
  }

  const providerInstance = createOpenAI({ apiKey, headers: extraHeaders });
  return providerInstance(modelId);
}

export function buildToolSet(
  tools: ToolDefinition[],
  execute: (toolName: string, args: Record<string, unknown>, options: { toolCallId: string }) => Promise<unknown>,
) {
  const entries = tools.map((definition) => {
    const schema = definition.input_schema || {
      type: 'object',
      properties: {},
    };
    return [
      definition.name,
      tool({
        description: definition.description,
        inputSchema: jsonSchema(schema),
        execute: async (args, options) =>
          execute(definition.name, args as Record<string, unknown>, {
            toolCallId: options.toolCallId,
          }),
      }),
    ] as const;
  });
  return Object.fromEntries(entries);
}

export async function describeImageWithModel({
  settings,
  dataUrl,
  prompt,
  maxTokens = 512,
}: {
  settings: SDKModelSettings;
  dataUrl: string;
  prompt: string;
  maxTokens?: number;
}) {
  const model = resolveLanguageModel(settings);
  const codexOAuth = isCodexOAuthProvider(settings.provider);
  const request: Parameters<typeof generateText>[0] = {
    model,
    providerOptions: codexOAuth ? buildCodexOAuthProviderOptions('You are a concise vision assistant.') : undefined,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', image: dataUrl },
        ],
      },
    ],
  };
  if (!codexOAuth) {
    request.maxOutputTokens = maxTokens;
  }
  const result = await generateText(request);
  return result.text;
}
