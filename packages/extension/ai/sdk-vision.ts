// Vision/image description with models
import { generateText } from 'ai';
import { buildCodexOAuthProviderOptions, isCodexOAuthProvider } from './codex-oauth.js';
import { resolveLanguageModel } from './sdk-provider-resolve.js';
import type { SDKModelSettings } from './sdk-provider-types.js';

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
