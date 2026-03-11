import { stepCountIs, streamText } from 'ai';
import type { Message } from '../../ai/message-schema.js';
import { toModelMessages } from '../../ai/model-convert.js';
import {
  buildCodexOAuthProviderOptions,
  buildToolSet,
  isCodexOAuthProvider,
  resolveLanguageModel,
} from '../../ai/sdk-client.js';
import { injectOAuthTokens, isVisionModelProfile } from '../model-profiles.js';
import type { ServiceContext } from '../service-context.js';
import type { RunMeta } from '../service-types.js';
import {
  SUBAGENT_COMPLETE_TOOL,
  attachQueuedInstructions,
  buildPendingInstructionsResult,
  resolveSummary,
  safeAwait,
} from './subagent-loop-utils.js';
import { createStreamContext, handleReasoningChunk, processTextStream } from './subagent-stream-handler.js';
import type { SubagentLoopContext } from './subagent-types.js';
import type { NestedToolExecutor, ToolExecutionArgs, ToolExecutionOptions } from './tool-executor-subagent-runner.js';

// Local type alias to avoid unused import issues
export type ToolExecutionSettings = Record<string, unknown>;

const profileUsesCodexOAuth = (profile: Record<string, unknown> | null | undefined) =>
  isCodexOAuthProvider(String(profile?.provider || ''));

export type ToolSetExecutor = (
  toolName: string,
  toolArgs: Record<string, unknown>,
  toolOptions: { toolCallId: string },
) => Promise<unknown>;

export async function runSubagentAI(
  ctx: ServiceContext,
  parentRunMeta: RunMeta,
  subRunMeta: RunMeta,
  args: ToolExecutionArgs,
  settings: ToolExecutionSettings,
  profileSettings: Record<string, any>,
  executeTool: NestedToolExecutor,
  runtimeMeta: NonNullable<ToolExecutionOptions['runtimeMeta']>,
  loopCtx: SubagentLoopContext,
  subHistory: Message[],
  onCapture: (summary: string | null, data: unknown) => void,
): Promise<{
  summary: string;
  reasoning: string | null;
  usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  responseMessages: unknown[];
}> {
  const { subagentId } = loopCtx;

  const promptText =
    typeof args.prompt === 'string' && args.prompt.trim()
      ? args.prompt.trim()
      : 'You are a focused sub-agent working under an orchestrator. Be concise and tool-driven.';
  const systemPrompt = `${promptText}\nAlways cite evidence from tools. When done, call subagent_complete with a concise summary.`;

  const tools = [
    ...ctx.getToolsForSession(profileSettings, false, [], isVisionModelProfile(profileSettings)),
    SUBAGENT_COMPLETE_TOOL,
  ];

  let capturedSummary: string | null = null;
  let capturedData: unknown = undefined;

  const consumePendingInstructions = () => {
    const entry = ctx.getSessionState(parentRunMeta.sessionId).runningSubagents.get(subagentId);
    if (!entry || entry.pendingInstructions.length === 0) return [] as string[];
    return entry.pendingInstructions.splice(0, entry.pendingInstructions.length);
  };

  const toolSet = buildToolSet(tools, async (toolName, toolArgs, toolOptions) => {
    if (toolName === 'subagent_complete') {
      const queuedInstructions = consumePendingInstructions();
      if (queuedInstructions.length > 0) {
        return buildPendingInstructionsResult(queuedInstructions);
      }
      capturedSummary = typeof toolArgs.summary === 'string' ? toolArgs.summary : JSON.stringify(toolArgs);
      capturedData = toolArgs.data;
    }
    const result = await executeTool(
      toolName,
      toolArgs,
      { runMeta: subRunMeta, settings, visionProfile: null, runtimeMeta },
      toolOptions.toolCallId,
    );
    return attachQueuedInstructions(result, consumePendingInstructions());
  });

  const resolvedProfile = String(profileSettings?.provider || '').endsWith('-oauth')
    ? await injectOAuthTokens(profileSettings)
    : profileSettings;
  const subModel = resolveLanguageModel(resolvedProfile as any);
  const abortSignal = ctx.activeRuns.get(parentRunMeta.runId)?.controller.signal;
  const usesOAuth = profileUsesCodexOAuth(resolvedProfile as Record<string, unknown> | null);

  ctx.sendRuntime(parentRunMeta, { type: 'assistant_stream_start', ...runtimeMeta });

  const result = streamText({
    model: subModel,
    system: systemPrompt,
    messages: toModelMessages(subHistory),
    tools: toolSet,
    abortSignal,
    temperature: profileSettings.temperature ?? 0.4,
    maxOutputTokens: usesOAuth ? undefined : (profileSettings.maxTokens ?? 1024),
    providerOptions: usesOAuth ? buildCodexOAuthProviderOptions(systemPrompt) : undefined,
    stopWhen: stepCountIs(24),
    onChunk: ({ chunk }) => handleReasoningChunk(ctx, parentRunMeta, chunk, runtimeMeta),
  });

  const streamCtx = createStreamContext(runtimeMeta);
  await processTextStream(ctx, parentRunMeta, result.textStream, streamCtx);

  const summary = await resolveSummary(result, capturedSummary, streamCtx.streamedText);

  const [reasoning, usage, responseMessages] = await Promise.all([
    safeAwait(result.reasoningText, null),
    safeAwait(result.totalUsage as PromiseLike<{ inputTokens?: number; outputTokens?: number; totalTokens?: number }>, {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    }),
    safeAwait((result as any).responseMessages, []),
  ]);

  ctx.sendRuntime(parentRunMeta, { type: 'assistant_stream_stop', ...runtimeMeta });

  onCapture(capturedSummary, capturedData);

  return {
    summary,
    reasoning: reasoning ?? null,
    usage: {
      inputTokens: Number(usage?.inputTokens || 0),
      outputTokens: Number(usage?.outputTokens || 0),
      totalTokens: Number(usage?.totalTokens || 0),
    },
    responseMessages,
  };
}
