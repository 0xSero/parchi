import type { ServiceContext } from '../service-context.js';
import type { RunMeta, SubagentResult } from '../service-types.js';
import {
  type NestedToolExecutor,
  type ToolExecutionArgs,
  type ToolExecutionOptions,
  type ToolExecutionSettings,
  formatToolExecutorError,
} from './tool-executor-shared.js';

export type { NestedToolExecutor, ToolExecutionArgs, ToolExecutionOptions };
import type { SubagentLoopContext } from './subagent-types.js';
export type { SubagentLoopContext };
import { runSubagentAI } from './subagent-ai-client.js';
import {
  buildFailureResult,
  buildSuccessResult,
  emitSubagentCompletion,
  sendFinalAssistantMessage,
} from './subagent-result-handler.js';

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
  const { subagentName, taskList } = loopCtx;
  const taskLines = taskList.map((task, i) => `${i + 1}. ${task}`).join('\n');

  ctx.sendRuntime(parentRunMeta, {
    type: 'run_status',
    phase: 'executing',
    attempts: { api: 0, tool: 0, finalize: 0 },
    maxRetries: { api: 0, tool: 0, finalize: 0 },
    note: `${subagentName} is running`,
    ...runtimeMeta,
  });

  try {
    const result = await executeSubagentLoop(
      ctx,
      parentRunMeta,
      subRunMeta,
      args,
      settings,
      profileSettings,
      executeTool,
      runtimeMeta,
      loopCtx,
      taskLines,
    );
    return result;
  } catch (error) {
    const errorMessage = formatToolExecutorError(error, 'Unknown error');
    console.error('[subagent] Error:', error);
    ctx.sendRuntime(parentRunMeta, { type: 'assistant_stream_stop', ...runtimeMeta });
    emitSubagentCompletion(ctx, parentRunMeta, runtimeMeta, loopCtx, false, `Sub-agent failed: ${errorMessage}`);
    return buildFailureResult(loopCtx, `Sub-agent failed: ${errorMessage}`);
  }
}

async function executeSubagentLoop(
  ctx: ServiceContext,
  parentRunMeta: RunMeta,
  subRunMeta: RunMeta,
  args: ToolExecutionArgs,
  settings: ToolExecutionSettings,
  profileSettings: Record<string, any>,
  executeTool: NestedToolExecutor,
  runtimeMeta: NonNullable<ToolExecutionOptions['runtimeMeta']>,
  loopCtx: SubagentLoopContext,
  taskLines: string,
): Promise<SubagentResult> {
  const subHistory = [
    {
      role: 'user' as const,
      content: `Task group:\n${taskLines || 'Follow the provided prompt and complete the goal.'}`,
    },
  ];

  let capturedData: unknown = undefined;

  const { summary, reasoning, usage, responseMessages } = await runSubagentAI(
    ctx,
    parentRunMeta,
    subRunMeta,
    args,
    settings,
    profileSettings,
    executeTool,
    runtimeMeta,
    loopCtx,
    subHistory,
    (_summary, data) => {
      capturedData = data;
    },
  );

  sendFinalAssistantMessage(
    ctx,
    parentRunMeta,
    runtimeMeta,
    summary,
    reasoning,
    String(profileSettings.model || ''),
    usage,
    responseMessages,
  );

  emitSubagentCompletion(ctx, parentRunMeta, runtimeMeta, loopCtx, true, summary);
  return buildSuccessResult(loopCtx, summary, capturedData);
}
