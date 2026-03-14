import { streamText } from 'ai';
import { extractTextFromResponseMessages } from '../ai/messages/utils.js';
import { buildCodexOAuthProviderOptions, isCodexOAuthProvider, resolveLanguageModel } from '../ai/sdk/index.js';
import { readSettingsSnapshot } from '../state/persistence/settings-repository.js';
import {
  hasOwnApiKey,
  injectOAuthTokens,
  refreshConvexProxyAuthSession,
  resolveRuntimeModelProfile,
} from './model-profiles.js';

const profileUsesCodexOAuth = (profile: Record<string, any> | null | undefined) =>
  isCodexOAuthProvider(String(profile?.provider || ''));

export async function runApiSmokeTest(
  settings: {
    provider?: string;
    apiKey?: string;
    model?: string;
    customEndpoint?: string;
    extraHeaders?: any;
    convexUrl?: string;
    convexAccessToken?: string;
    convexSubscriptionStatus?: string;
    convexSubscriptionPlan?: string;
    accountModeChoice?: string;
  },
  prompt: string,
) {
  try {
    const runtimeSettings = settings as Record<string, any>;
    if (!hasOwnApiKey({ apiKey: settings.apiKey || '' })) {
      await refreshConvexProxyAuthSession(runtimeSettings);
    }

    const runtimeProfile = resolveRuntimeModelProfile(
      {
        provider: settings.provider || 'openai',
        apiKey: settings.apiKey || '',
        model: settings.model || '',
        customEndpoint: settings.customEndpoint,
        extraHeaders: settings.extraHeaders,
      },
      runtimeSettings,
    );
    if (!runtimeProfile.allowed) {
      return {
        rawText: '',
        fallbackText: '',
        resolvedText: '',
        error: runtimeProfile.errorMessage || 'No API key configured',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      };
    }

    const resolvedProfile =
      runtimeProfile.route === 'oauth' ? await injectOAuthTokens(runtimeProfile.profile) : runtimeProfile.profile;
    const model = resolveLanguageModel(resolvedProfile as any);
    const smokeUsesCodexOAuth = profileUsesCodexOAuth(resolvedProfile as any);
    const smokeProvider = String(
      (resolvedProfile as Record<string, any>)?.provider || settings.provider || '',
    ).toLowerCase();
    const maxOutputTokens = smokeUsesCodexOAuth ? undefined : smokeProvider === 'minimax' ? 256 : 64;

    const result = streamText({
      model,
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens,
      temperature: 0,
      providerOptions: smokeUsesCodexOAuth ? buildCodexOAuthProviderOptions('You are a concise assistant.') : undefined,
    });

    const [text, responseMessages, usage] = await Promise.all([
      result.text,
      (result as any).responseMessages,
      result.totalUsage,
    ]);

    const fallbackText = extractTextFromResponseMessages(responseMessages);
    const resolvedText = (text || fallbackText || '').trim();

    return {
      rawText: text || '',
      fallbackText,
      resolvedText,
      usage: {
        inputTokens: Number(usage?.inputTokens || 0),
        outputTokens: Number(usage?.outputTokens || 0),
        totalTokens: Number(usage?.totalTokens || 0),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    console.error('[runApiSmokeTest] Error:', error);
    return {
      rawText: '',
      fallbackText: '',
      resolvedText: '',
      error: errorMessage,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  }
}

export async function generateWorkflowPrompt(
  sessionContext: string,
  maxOutputTokens?: number,
): Promise<{ prompt: string; error?: string }> {
  try {
    const settings = await readSettingsSnapshot();
    const runtimeProfile = resolveRuntimeModelProfile(
      {
        provider: settings.provider,
        apiKey: settings.apiKey,
        model: settings.model,
        customEndpoint: settings.customEndpoint,
        extraHeaders: settings.extraHeaders,
      },
      settings,
    );
    if (!runtimeProfile.allowed) {
      return { prompt: '', error: runtimeProfile.errorMessage || 'No API key configured' };
    }
    const resolvedProfile2 =
      runtimeProfile.route === 'oauth' ? await injectOAuthTokens(runtimeProfile.profile) : runtimeProfile.profile;
    const model = resolveLanguageModel(resolvedProfile2 as any);
    const workflowUsesCodexOAuth = profileUsesCodexOAuth(resolvedProfile2 as any);

    const outputLimit = Math.min(maxOutputTokens || 4096, 4096);
    const workflowSystemPrompt = `You are a workflow prompt engineer. Your job is to distill a chat session transcript into a single, reusable workflow prompt.

Rules:
- Output ONLY the workflow prompt itself — no preamble, no "Here is your workflow:", no markdown fences wrapping the entire output.
- The prompt must be self-contained and reproducible: when a user pastes it into a new chat session, an AI assistant should be able to replicate the same behavior and steps.
- Break the process down into clear numbered steps.
- Preserve important details: specific URLs, selectors, field names, values, edge cases, and error-handling the assistant performed.
- Omit irrelevant chatter, greetings, and status updates.
- If the session involved browser automation, include the exact actions (navigate, click, type, scroll) with their targets.
- Keep the prompt concise but thorough — aim for under 1500 words.
- Use imperative mood ("Navigate to…", "Click…", "Wait for…").`;
    const result = await streamText({
      model,
      system: workflowSystemPrompt,
      messages: [
        {
          role: 'user',
          content: `Here is the full chat session transcript. Please create a workflow prompt out of it that captures the complete process step by step, so it can be reused to reproduce this exact behavior in a new session.\n\n---\n\n${sessionContext}`,
        },
      ],
      maxOutputTokens: workflowUsesCodexOAuth ? undefined : outputLimit,
      temperature: 0.3,
      providerOptions: workflowUsesCodexOAuth ? buildCodexOAuthProviderOptions(workflowSystemPrompt) : undefined,
    });

    const text = typeof (await result.text) === 'string' ? (await result.text).trim() : '';
    return { prompt: text };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    console.error('[generateWorkflowPrompt] Error:', error);
    return { prompt: '', error: msg };
  }
}
