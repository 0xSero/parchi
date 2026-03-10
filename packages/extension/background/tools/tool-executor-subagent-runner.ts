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
import type { RunMeta, SubagentResult } from '../service-types.js';
import {
  type NestedToolExecutor,
  type ToolExecutionArgs,
  type ToolExecutionOptions,
  type ToolExecutionSettings,
  formatToolExecutorError,
  isObjectRecord,
} from './tool-executor-shared.js';

const profileUsesCodexOAuth = (profile: Record<string, unknown> | null | undefined) =>
  isCodexOAuthProvider(String(profile?.provider || ''));

const safeAwait = async <T>(promise: PromiseLike<T> | undefined, fallback: T): Promise<T> => {
  if (!promise) return fallback;
  try {
    return await Promise.resolve(promise);
  } catch {
    return fallback;
  }
};

/** Tool definition injected into the subagent's toolset so it can signal completion. */
const SUBAGENT_COMPLETE_TOOL = {
  name: 'subagent_complete',
  description: 'Call this when you have finished all assigned tasks. Provide a concise summary of findings.',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: { type: 'string', description: 'Concise summary of what you found / accomplished.' },
      data: { type: 'object', description: 'Optional structured data payload.' },
    },
    required: ['summary'],
  },
};

export type SubagentLoopContext = {
  subagentId: string;
  subagentName: string;
  subagentSessionId: string;
  taskList: string[];
  tabId: number;
  taskId?: string;
};

export async function runSubagentLoop(
  ctx: ServiceContext,
  parentRunMeta: RunMeta,
  subRunMeta: RunMeta,
  args: ToolExecutionArgs,
  settings: ToolExecutionSettings,
  profileSettings: Record<string, any>,
  executeTool: NestedToolExecutor,
  runtimeMeta: NonNullable<ToolExecutionOptions['runtimeMeta']>,
  loopCtx: SubagentLoopContext,
): Promise<SubagentResult> {
  const { subagentId, subagentName, taskList, tabId } = loopCtx;
  const taskLines = taskList.map((task, i) => `${i + 1}. ${task}`).join('\n');
  const fail = (msg: string): SubagentResult => ({
    id: subagentId,
    name: subagentName,
    success: false,
    summary: msg,
    tabId,
    taskId: loopCtx.taskId,
  });
  const consumePendingInstructions = () => {
    const entry = ctx.getSessionState(parentRunMeta.sessionId).runningSubagents.get(subagentId);
    if (!entry || entry.pendingInstructions.length === 0) return [] as string[];
    return entry.pendingInstructions.splice(0, entry.pendingInstructions.length);
  };
  const attachQueuedInstructions = (result: unknown, instructions: string[]) => {
    if (instructions.length === 0) return result;
    const payload = isObjectRecord(result) ? { ...result } : { result };
    return {
      ...payload,
      orchestratorInstructions: instructions,
      orchestratorNote:
        instructions.length === 1
          ? 'The orchestrator sent a new instruction. Incorporate it before continuing.'
          : `The orchestrator sent ${instructions.length} new instructions. Incorporate them before continuing.`,
    };
  };

  ctx.sendRuntime(parentRunMeta, {
    type: 'run_status',
    phase: 'executing',
    attempts: { api: 0, tool: 0, finalize: 0 },
    maxRetries: { api: 0, tool: 0, finalize: 0 },
    note: `${subagentName} is running`,
    ...runtimeMeta,
  });

  try {
    const promptText =
      typeof args.prompt === 'string' && args.prompt.trim()
        ? args.prompt.trim()
        : 'You are a focused sub-agent working under an orchestrator. Be concise and tool-driven.';
    const systemPrompt = `${promptText}\nAlways cite evidence from tools. When done, call subagent_complete with a concise summary.`;

    const tools = [
      ...ctx.getToolsForSession(profileSettings, false, [], isVisionModelProfile(profileSettings)),
      SUBAGENT_COMPLETE_TOOL,
    ];

    // Capture the summary when the subagent calls subagent_complete
    let capturedSummary: string | null = null;
    let capturedData: unknown = undefined;
    const toolSet = buildToolSet(tools, async (toolName, toolArgs, toolOptions) => {
      if (toolName === 'subagent_complete') {
        const queuedInstructions = consumePendingInstructions();
        if (queuedInstructions.length > 0) {
          return {
            success: false,
            accepted: false,
            orchestratorInstructions: queuedInstructions,
            orchestratorNote:
              'New orchestrator instructions arrived. Continue working and call subagent_complete again when everything is done.',
          };
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

    const subHistory: Message[] = [
      { role: 'user', content: `Task group:\n${taskLines || 'Follow the provided prompt and complete the goal.'}` },
    ];

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
      onChunk: ({ chunk }) => {
        const rec = chunk as { type?: unknown; text?: unknown; delta?: unknown };
        const t = typeof rec.type === 'string' ? rec.type : '';
        if (!t.includes('reasoning') && !t.includes('thinking')) return;
        const content = typeof rec.text === 'string' ? rec.text : typeof rec.delta === 'string' ? rec.delta : '';
        if (content)
          ctx.sendRuntime(parentRunMeta, {
            type: 'assistant_stream_delta',
            content,
            channel: 'reasoning',
            ...runtimeMeta,
          });
      },
    });

    let streamedText = '';
    try {
      for await (const textPart of result.textStream) {
        const p = String(textPart || '');
        if (!p) continue;
        streamedText += p;
        ctx.sendRuntime(parentRunMeta, { type: 'assistant_stream_delta', content: p, channel: 'text', ...runtimeMeta });
      }
    } catch {}

    let summary: string;
    try {
      const rawText = await result.text;
      summary = capturedSummary || rawText || streamedText || 'Sub-agent completed its task.';
    } catch (error) {
      const msg = formatToolExecutorError(error);
      if (msg.includes('No output generated'))
        summary = capturedSummary || streamedText || 'Sub-agent finished without generating output.';
      else throw error;
    }

    const [reasoning, usage, responseMessages] = await Promise.all([
      safeAwait(result.reasoningText, null),
      safeAwait(
        result.totalUsage as PromiseLike<{ inputTokens?: number; outputTokens?: number; totalTokens?: number }>,
        { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      ),
      safeAwait((result as any).responseMessages, []),
    ]);

    ctx.sendRuntime(parentRunMeta, { type: 'assistant_stream_stop', ...runtimeMeta });
    ctx.sendRuntime(parentRunMeta, {
      type: 'assistant_final',
      content: summary,
      thinking: reasoning || null,
      model: String(profileSettings.model || ''),
      usage: {
        inputTokens: Number(usage?.inputTokens || 0),
        outputTokens: Number(usage?.outputTokens || 0),
        totalTokens: Number(usage?.totalTokens || 0),
      },
      responseMessages,
      ...runtimeMeta,
    });

    emitCompletion(ctx, parentRunMeta, runtimeMeta, loopCtx, true, summary);
    return {
      id: subagentId,
      name: subagentName,
      success: true,
      summary,
      tabId,
      taskId: loopCtx.taskId,
      data: capturedData,
    };
  } catch (error) {
    const errorMessage = formatToolExecutorError(error, 'Unknown error');
    console.error('[subagent] Error:', error);
    ctx.sendRuntime(parentRunMeta, { type: 'assistant_stream_stop', ...runtimeMeta });
    emitCompletion(ctx, parentRunMeta, runtimeMeta, loopCtx, false, `Sub-agent failed: ${errorMessage}`);
    return fail(`Sub-agent failed: ${errorMessage}`);
  }
}

function emitCompletion(
  ctx: ServiceContext,
  runMeta: RunMeta,
  runtimeMeta: NonNullable<ToolExecutionOptions['runtimeMeta']>,
  loopCtx: SubagentLoopContext,
  success: boolean,
  summary: string,
) {
  const phase = success ? 'completed' : 'failed';
  ctx.sendRuntime(runMeta, {
    type: 'run_status',
    phase,
    attempts: { api: 0, tool: 0, finalize: 0 },
    maxRetries: { api: 0, tool: 0, finalize: 0 },
    note: `${loopCtx.subagentName} ${phase}`,
    ...(!success ? { lastError: summary } : {}),
    ...runtimeMeta,
  });
  ctx.sendRuntime(runMeta, {
    type: 'subagent_complete',
    id: loopCtx.subagentId,
    success,
    summary,
    agentSessionId: loopCtx.subagentSessionId,
    ...runtimeMeta,
  });
}
