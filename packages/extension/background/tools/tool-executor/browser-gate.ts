import type { BrowserTools } from '../../../tools/browser-tools.js';
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
  if (!permissionCheck.allowed) {
    return {
      shouldReturn: true,
      result: {
        success: false,
        error: permissionCheck.reason || 'Tool blocked by permissions.',
        policy: permissionCheck.policy,
      },
    };
  }

  if (toolName === 'screenshot' && options.settings.enableScreenshots === false) {
    return {
      shouldReturn: true,
      result: { success: false, error: 'Screenshots are disabled in settings.' },
    };
  }

  try {
    return {
      shouldReturn: false,
      result: await browserTools.executeTool(toolName, args),
    };
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
