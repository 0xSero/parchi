import { APICallError } from '@ai-sdk/provider';
import { stepCountIs, streamText } from 'ai';
import { classifyApiError } from '../../../ai/errors/classifier.js';
import { extractTextFromResponseMessages, extractThinkingFromResponseMessages } from '../../../ai/messages/utils.js';
import { toModelMessages } from '../../../ai/models/convert.js';
import { buildCodexOAuthProviderOptions } from '../../../ai/sdk/index.js';
import { isVisionModelProfile } from '../../model-profiles.js';
import { enhanceSystemPrompt } from '../../system-prompt.js';
import type { AgentLoopDiagnostics, AgentModelPassResult, PreparedAgentLoopRun } from './shared.js';

type MessagePart = { type: 'text'; text: string } | { type: 'image'; image: string };
type StreamChunkRecord = { type?: unknown; text?: unknown; delta?: unknown };
type ModelUsage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };
type StepResult = { toolResults?: Array<Record<string, unknown>> };

export async function runAgentModelPass(
  prepared: PreparedAgentLoopRun,
  diagnostics: AgentLoopDiagnostics,
): Promise<AgentModelPassResult> {
  const {
    abortSignal,
    context,
    ctx,
    enableAnthropicThinking,
    matchedSkillsResult,
    orchestratorProfile,
    recordedImages,
  } = prepared;
  const modelMessages = toModelMessages(prepared.currentHistory);

  if (recordedImages.length > 0 && isVisionModelProfile(orchestratorProfile)) {
    for (let index = modelMessages.length - 1; index >= 0; index -= 1) {
      const message = modelMessages[index];
      if (message.role !== 'user') continue;
      const existingContent = typeof message.content === 'string' ? message.content : '';
      const parts: MessagePart[] = existingContent ? [{ type: 'text', text: existingContent }] : [];
      for (const image of recordedImages) {
        if (image.dataUrl && typeof image.dataUrl === 'string') {
          parts.push({ type: 'image', image: image.dataUrl });
        }
      }
      if (parts.length > 0) {
        const mutableMessage = message as { content: unknown };
        mutableMessage.content = parts;
      }
      break;
    }
  }

  let streamStopSent = false;
  let textDeltaCount = 0;
  let reasoningDeltaCount = 0;
  let textStreamError: string | null = null;
  const markFirstChunk = () => {
    if (diagnostics.firstChunkAt == null) diagnostics.firstChunkAt = Date.now();
  };
  const markFirstTextToken = () => {
    if (diagnostics.firstTextTokenAt == null) diagnostics.firstTextTokenAt = Date.now();
  };
  const safeAwait = async <T>(promise: PromiseLike<T>, fallback: T): Promise<T> => {
    try {
      return await Promise.resolve(promise);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      if (!message.includes('No output generated')) console.warn('[safeAwait] Error (using fallback):', error);
      return fallback;
    }
  };
  const sendStreamStop = () => {
    if (!prepared.streamEnabled || streamStopSent) return;
    ctx.sendRuntime(prepared.runMeta, { type: 'assistant_stream_stop' });
    streamStopSent = true;
  };
  const sendTextDelta = (textPart: string) => {
    if (!textPart) return;
    markFirstTextToken();
    textDeltaCount += 1;
    ctx.sendRuntime(prepared.runMeta, { type: 'assistant_stream_delta', content: textPart, channel: 'text' });
  };
  const sendReasoningDelta = (delta: string) => {
    if (!delta) return;
    reasoningDeltaCount += 1;
    ctx.sendRuntime(prepared.runMeta, { type: 'assistant_stream_delta', content: delta, channel: 'reasoning' });
  };
  const emitSyntheticStream = async (fullText: string) => {
    const text = String(fullText || '');
    if (!text) return;
    const chunkSize = Math.max(24, Math.ceil(text.length / 120));
    for (let index = 0; index < text.length; index += chunkSize) {
      if (abortSignal.aborted) return;
      sendTextDelta(text.slice(index, index + chunkSize));
      await new Promise((resolve) => setTimeout(resolve, 8));
    }
  };

  if (prepared.streamEnabled) ctx.sendRuntime(prepared.runMeta, { type: 'assistant_stream_start' });

  const systemPrompt = enhanceSystemPrompt(
    orchestratorProfile.systemPrompt || '',
    context,
    prepared.sessionState,
    matchedSkillsResult,
  );
  const usesCodexOAuth = String(orchestratorProfile?.provider || '').toLowerCase() === 'codex-oauth';
  const providerOptions: {
    anthropic?: { thinking: { type: 'enabled'; budgetTokens: number } };
    openai?: ReturnType<typeof buildCodexOAuthProviderOptions>['openai'];
  } = {};
  if (enableAnthropicThinking) {
    providerOptions.anthropic = {
      thinking: {
        type: 'enabled',
        budgetTokens: Math.min(Math.max(1024, Math.floor((orchestratorProfile.maxTokens ?? 4096) * 0.5)), 16384),
      },
    };
  }
  if (usesCodexOAuth) {
    providerOptions.openai = buildCodexOAuthProviderOptions(systemPrompt).openai;
  }

  const result = streamText({
    model: prepared.model,
    system: systemPrompt,
    messages: modelMessages,
    tools: prepared.toolSet,
    abortSignal,
    temperature: orchestratorProfile.temperature ?? 0.7,
    maxOutputTokens: usesCodexOAuth ? undefined : (orchestratorProfile.maxTokens ?? 4096),
    stopWhen: stepCountIs(48),
    providerOptions: Object.keys(providerOptions).length > 0 ? providerOptions : undefined,
    onChunk: ({ chunk }) => {
      markFirstChunk();
      const chunkRecord = chunk as StreamChunkRecord;
      const chunkType = typeof chunkRecord.type === 'string' ? String(chunkRecord.type) : '';
      if (chunkType.includes('reasoning') || chunkType.includes('thinking')) {
        sendReasoningDelta(
          typeof chunkRecord.text === 'string'
            ? chunkRecord.text
            : typeof chunkRecord.delta === 'string'
              ? chunkRecord.delta
              : '',
        );
      }
    },
  });

  const resolveText = async () => {
    try {
      return await result.text;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      if (message.includes('No output generated')) return '';
      throw error;
    }
  };

  try {
    if (prepared.streamEnabled) {
      try {
        for await (const textPart of result.textStream) {
          markFirstChunk();
          sendTextDelta(textPart || '');
        }
      } catch (error) {
        textStreamError = error instanceof Error ? error.message : String(error ?? '');
        console.warn('Streaming text error:', error);
      }
    }

    const text = await resolveText();
    const responseMessagePromise =
      (result as { responseMessages?: PromiseLike<unknown[]> }).responseMessages ?? Promise.resolve([]);
    const [reasoning, usage, steps, responseMessages] = await Promise.all([
      safeAwait(result.reasoningText, null),
      safeAwait(result.totalUsage as PromiseLike<ModelUsage>, { inputTokens: 0, outputTokens: 0, totalTokens: 0 }),
      safeAwait(result.steps as PromiseLike<StepResult[]>, []),
      safeAwait(responseMessagePromise, []),
    ]);
    const resolvedText = text || extractTextFromResponseMessages(responseMessages);
    const resolvedReasoning = prepared.showThinking
      ? reasoning || extractThinkingFromResponseMessages(responseMessages)
      : reasoning || null;

    if (prepared.streamEnabled && prepared.showThinking && resolvedReasoning && reasoningDeltaCount === 0) {
      sendReasoningDelta(resolvedReasoning);
    }
    if (prepared.streamEnabled && resolvedText && textDeltaCount === 0) {
      await emitSyntheticStream(resolvedText);
    }
    if (!resolvedText && textStreamError) {
      const classified = classifyApiError(new Error(textStreamError), prepared.captureErrorClassificationContext());
      const detail = classified.action ? ` ${classified.action}` : '';
      ctx.sendRuntime(prepared.runMeta, {
        type: 'run_warning',
        message: `Model produced no output. ${classified.message}${detail}`,
      });
    }

    sendStreamStop();
    return {
      text: resolvedText || '',
      reasoningText: resolvedReasoning || null,
      totalUsage: {
        inputTokens: Number(usage?.inputTokens || 0),
        outputTokens: Number(usage?.outputTokens || 0),
        totalTokens: Number(usage?.totalTokens || 0),
      },
      toolResults: steps.flatMap((step) => step.toolResults || []),
    };
  } catch (error) {
    sendStreamStop();
    if (abortSignal.aborted) throw error;
    const classified = classifyApiError(error, prepared.captureErrorClassificationContext());
    const errorRecord = error && typeof error === 'object' ? (error as Record<string, unknown>) : null;
    const statusCode = Number(errorRecord?.statusCode ?? errorRecord?.status ?? 0);
    if (classified.category === 'model' || APICallError.isInstance(error) || statusCode >= 400) throw error;
    console.error('[runModelPass] Error:', error);
    return {
      text: '',
      reasoningText: null,
      totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      toolResults: [],
    };
  }
}
