import type { BrowserTools } from '../../../tools/browser-tools.js';
import { postflightDestination, preflightDestination } from '../../destination-guard.js';
import type { ServiceContext } from '../../service-context.js';
import { checkToolPermission } from '../../tool-permissions.js';
import { type ToolExecutionArgs, type ToolExecutionOptions, formatToolExecutorError } from './shared.js';

export type BrowserToolGateResult =
  | {
      shouldReturn: true;
      result: Record<string, unknown>;
    }
  | {
      shouldReturn: false;
      result: unknown;
    };

const blockedResult = (check: { reason?: string; policy?: unknown }): BrowserToolGateResult => ({
  shouldReturn: true,
  result: { success: false, error: check.reason || 'Tool blocked by permissions.', policy: check.policy },
});

export async function validateAndExecuteBrowserTool(
  ctx: ServiceContext,
  browserTools: BrowserTools,
  toolName: string,
  args: ToolExecutionArgs,
  options: ToolExecutionOptions,
): Promise<BrowserToolGateResult> {
  const availableTools = browserTools?.tools ? Object.keys(browserTools.tools) : [];
  if (!availableTools.includes(toolName)) {
    return {
      shouldReturn: true,
      result: { success: false, error: `Unknown tool: ${toolName}` },
    };
  }

  const permissionCheck = await checkToolPermission(
    toolName,
    args,
    options.settings,
    ctx.currentSettings,
    options.runMeta.sessionId,
    ctx.currentSessionId,
    (id) => ctx.getBrowserTools(id),
  );
  if (!permissionCheck.allowed) return blockedResult(permissionCheck);

  if (toolName === 'screenshot' && options.settings.enableScreenshots === false) {
    return {
      shouldReturn: true,
      result: { success: false, error: 'Screenshots are disabled in settings.' },
    };
  }

  // Private-network / destination policy (#42): judge the real target before and after execution, and pin
  // script injection to the exact frame documents that were judged.
  const settings = options.settings || ctx.currentSettings;
  const sessionId = options.runMeta.sessionId;
  try {
    const preflight = await preflightDestination(toolName, args, browserTools, sessionId, settings);
    if (!preflight.allowed) return blockedResult(preflight);

    const result = await browserTools.withExecutionScope(preflight.scope, () =>
      browserTools.executeTool(toolName, args),
    );
    const postflight = await postflightDestination(toolName, args, result, browserTools, sessionId, settings);
    if (!postflight.allowed) return blockedResult(postflight);
    return { shouldReturn: false, result: postflight.result };
  } catch (error) {
    return {
      shouldReturn: true,
      result: {
        success: false,
        error: formatToolExecutorError(error),
      },
    };
  }
}
