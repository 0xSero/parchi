import { generateText } from 'ai';
import { SUMMARIZATION_SYSTEM_PROMPT } from '../../../ai/compaction/index.js';
import { extractThinking } from '../../../ai/messages/utils.js';
import { buildCodexOAuthProviderOptions } from '../../../ai/sdk/index.js';
import type { ServiceContext } from '../../service-context.js';
import type { SessionState } from '../../service-types.js';
import type { CompactionSummaryResult, RunContextCompactionOptions } from './shared.js';
import { profileUsesCodexOAuth } from './shared.js';

export async function generateCompactionSummary(
  ctx: ServiceContext,
  sessionState: SessionState,
  options: RunContextCompactionOptions,
  promptText: string,
  details: {
    messagesToSummarizeCount: number;
    preservedCandidateCount: number;
    hasPreviousSummary: boolean;
    reserveTokens: number;
  },
): Promise<CompactionSummaryResult> {
  const summaryUsesCodexOAuth = profileUsesCodexOAuth(options.orchestratorProfile);

  ctx.sendRuntime(options.runMeta, {
    type: 'compaction_event',
    stage: 'summary_request',
    source: options.source || 'auto',
    note: 'Requesting compaction summary from model.',
    details: {
      ...details,
      promptLength: promptText.length,
      maxOutputTokens: summaryUsesCodexOAuth ? undefined : Math.floor(0.8 * details.reserveTokens),
    },
  });

  const summaryStartedAt = Date.now();
  const summaryResult = await generateText({
    model: options.model as Parameters<typeof generateText>[0]['model'],
    system: SUMMARIZATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: promptText }],
    abortSignal: options.abortSignal,
    temperature: 0.2,
    maxOutputTokens: summaryUsesCodexOAuth ? undefined : Math.floor(0.8 * details.reserveTokens),
    providerOptions: summaryUsesCodexOAuth ? buildCodexOAuthProviderOptions(SUMMARIZATION_SYSTEM_PROMPT) : undefined,
  });
  const summaryGenerationMs = Date.now() - summaryStartedAt;

  const parsedSummary = extractThinking(summaryResult.text || '', null);
  const summaryText = parsedSummary.content || String(summaryResult.text || '').trim();
  const summaryUsageRaw = (summaryResult as { usage?: Record<string, unknown> }).usage || {};
  const summaryUsage = {
    inputTokens: Number(summaryUsageRaw.inputTokens || 0),
    outputTokens: Number(summaryUsageRaw.outputTokens || 0),
    totalTokens: Number(summaryUsageRaw.totalTokens || 0),
  };

  ctx.sendRuntime(options.runMeta, {
    type: 'compaction_event',
    stage: 'summary_result',
    source: options.source || 'auto',
    note: 'Summary generated.',
    details: {
      usage: summaryUsage,
      textLength: summaryText.length,
      generationMs: summaryGenerationMs,
      hasThinking: Boolean(parsedSummary.thinking),
    },
  });
  ctx.emitTokenTrace(options.runMeta, sessionState, {
    action: 'compaction_summary_result',
    reason: 'summary_generated',
    note: 'Summary generated for compaction.',
    afterPatch: {
      sessionInputTokens:
        (sessionState.tokenVisibility?.sessionInputTokens || 0) + Number(summaryUsage.inputTokens || 0),
      sessionOutputTokens:
        (sessionState.tokenVisibility?.sessionOutputTokens || 0) + Number(summaryUsage.outputTokens || 0),
      sessionTotalTokens:
        (sessionState.tokenVisibility?.sessionTotalTokens || 0) +
        Number(summaryUsage.totalTokens || summaryUsage.inputTokens + summaryUsage.outputTokens || 0),
    },
    details: {
      summaryInputTokens: Number(summaryUsage.inputTokens || 0),
      summaryOutputTokens: Number(summaryUsage.outputTokens || 0),
      summaryTotalTokens: Number(summaryUsage.totalTokens || summaryUsage.inputTokens + summaryUsage.outputTokens || 0),
      generationMs: summaryGenerationMs,
    },
  });

  return {
    summaryText,
    summaryUsage,
    summaryGenerationMs,
    hasThinking: Boolean(parsedSummary.thinking),
  };
}
