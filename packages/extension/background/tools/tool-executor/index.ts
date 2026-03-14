import type { ServiceContext } from '../../service-context.js';
import { validateAndExecuteBrowserTool } from './browser-gate.js';
import { executeBuiltinTool } from './builtins.js';
import {
  applyFailureDedup,
  broadcastTabStateIfNeeded,
  postprocessBrowserResult,
  updateVerificationState,
} from './postprocess.js';
import { createToolRuntimeEmitter } from './runtime.js';
import { type ToolExecutionArgs, type ToolExecutionOptions, attachPlanToResult } from './shared.js';

export async function executeToolByName(
  ctx: ServiceContext,
  toolName: string,
  args: ToolExecutionArgs,
  options: ToolExecutionOptions,
  toolCallId?: string,
) {
  const callId = toolCallId || `tool_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  if (ctx.isRunCancelled(options.runMeta.runId)) {
    return { success: false, error: 'Run stopped.' };
  }

  const sessionState = ctx.getSessionState(options.runMeta.sessionId);
  const browserTools = ctx.getBrowserTools(options.runMeta.sessionId);
  const runtime = createToolRuntimeEmitter(ctx, options, sessionState, toolName, args, callId);

  runtime.sendStart();

  const builtin = await executeBuiltinTool(
    ctx,
    toolName,
    args,
    options,
    (nestedToolName, nestedArgs, nestedOptions, nestedToolCallId) =>
      executeToolByName(ctx, nestedToolName, nestedArgs, nestedOptions, nestedToolCallId),
  );
  if (builtin.handled) {
    runtime.sendResult(builtin.result);
    return builtin.result;
  }

  const browserExecution = await validateAndExecuteBrowserTool(ctx, browserTools, toolName, args, options);
  if (browserExecution.shouldReturn) {
    runtime.sendResult(browserExecution.result);
    return browserExecution.result;
  }

  const finalResult = browserExecution.result || { error: 'No result returned' };

  applyFailureDedup(sessionState, toolName, args, finalResult);
  broadcastTabStateIfNeeded(ctx, browserTools, toolName, options);
  updateVerificationState(sessionState, toolName, finalResult);

  const processedResult = await postprocessBrowserResult(
    ctx,
    sessionState,
    toolName,
    finalResult,
    args,
    options,
    callId,
  );
  const enrichedResult = attachPlanToResult(processedResult, toolName, sessionState);
  runtime.sendResult(enrichedResult);
  return enrichedResult;
}
