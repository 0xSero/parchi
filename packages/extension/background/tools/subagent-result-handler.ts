import type { ServiceContext } from '../service-context.js';
import type { RunMeta, SubagentResult } from '../service-types.js';
import type { SubagentLoopContext } from './subagent-types.js';
import type { ToolExecutionOptions } from './tool-executor-shared.js';

export type SubagentCompletionEmitter = (
  ctx: ServiceContext,
  runMeta: RunMeta,
  runtimeMeta: NonNullable<ToolExecutionOptions['runtimeMeta']>,
  loopCtx: SubagentLoopContext,
  success: boolean,
  summary: string,
) => void;

export function emitSubagentCompletion(
  ctx: ServiceContext,
  runMeta: RunMeta,
  runtimeMeta: NonNullable<ToolExecutionOptions['runtimeMeta']>,
  loopCtx: SubagentLoopContext,
  success: boolean,
  summary: string,
): void {
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

export function buildSuccessResult(
  loopCtx: SubagentLoopContext,
  summary: string,
  capturedData: unknown,
): SubagentResult {
  return {
    id: loopCtx.subagentId,
    name: loopCtx.subagentName,
    success: true,
    summary,
    tabId: loopCtx.tabId,
    taskId: loopCtx.taskId,
    data: capturedData,
  };
}

export function buildFailureResult(loopCtx: SubagentLoopContext, errorMessage: string): SubagentResult {
  return {
    id: loopCtx.subagentId,
    name: loopCtx.subagentName,
    success: false,
    summary: errorMessage,
    tabId: loopCtx.tabId,
    taskId: loopCtx.taskId,
  };
}

export function sendFinalAssistantMessage(
  ctx: ServiceContext,
  parentRunMeta: RunMeta,
  runtimeMeta: NonNullable<ToolExecutionOptions['runtimeMeta']>,
  summary: string,
  reasoning: string | null | undefined,
  model: string,
  usage: { inputTokens: number; outputTokens: number; totalTokens: number },
  responseMessages: unknown[],
): void {
  ctx.sendRuntime(parentRunMeta, {
    type: 'assistant_final',
    content: summary,
    thinking: reasoning || null,
    model,
    usage,
    responseMessages,
    ...runtimeMeta,
  });
}
