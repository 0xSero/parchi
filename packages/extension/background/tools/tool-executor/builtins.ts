import { applyReportImageSelection, getReportImageSummary } from '../../report-images.js';
import type { ServiceContext } from '../../service-context.js';
import { buildPlanFromArgs } from '../xml-tool-parser.js';
import { handleOrchestratorBuiltin } from './orchestrator.js';
import type { NestedToolExecutor, ToolExecutionArgs, ToolExecutionOptions } from './shared.js';
import { handleSpawnSubagent } from './subagent.js';

type BuiltinExecutionResult =
  | { handled: false }
  | {
      handled: true;
      result: unknown;
    };

export async function executeBuiltinTool(
  ctx: ServiceContext,
  toolName: string,
  args: ToolExecutionArgs,
  options: ToolExecutionOptions,
  executeNestedTool: NestedToolExecutor,
): Promise<BuiltinExecutionResult> {
  const sessionState = ctx.getSessionState(options.runMeta.sessionId);

  const orchestratorBuiltin = await handleOrchestratorBuiltin(
    ctx,
    sessionState,
    toolName,
    args,
    options,
    executeNestedTool,
  );
  if (orchestratorBuiltin.handled) {
    return {
      handled: true,
      result: orchestratorBuiltin.result,
    };
  }

  if (toolName === 'set_plan') {
    const hadPlan = Boolean(sessionState.currentPlan && sessionState.currentPlan.steps.length > 0);
    const plan = buildPlanFromArgs(args, sessionState.currentPlan);
    if (!plan) {
      return {
        handled: true,
        result: {
          success: false,
          error: 'Plan must include steps array with title for each step.',
          hint: 'Example: set_plan({ steps: [{ title: "Navigate to site" }, { title: "Click login" }] })',
          received: JSON.stringify(args).slice(0, 200),
        },
      };
    }

    sessionState.currentPlan = plan;
    ctx.sendRuntime(options.runMeta, { type: 'plan_update', plan });
    return {
      handled: true,
      result: {
        success: true,
        plan,
        message: hadPlan
          ? `Plan extended with ${plan.steps.length} total steps. Continue with the active step and use update_plan({ step_index: 0, status: "done" }) after completing each step.`
          : `Plan created with ${plan.steps.length} steps. Use update_plan({ step_index: 0, status: "done" }) after completing each step.`,
      },
    };
  }

  if (toolName === 'update_plan') {
    if (!sessionState.currentPlan) {
      return {
        handled: true,
        result: {
          success: false,
          error: 'No active plan to update. Call set_plan first.',
          hint: 'Create a plan with set_plan({ steps: [{ title: "..." }, ...] }) before updating.',
        },
      };
    }

    const rawIndex = args.step_index ?? args.stepIndex ?? args.step ?? args.index;
    const parsedIndex = typeof rawIndex === 'number' ? rawIndex : Number(rawIndex);
    let stepIndex = Number.isFinite(parsedIndex) ? parsedIndex : -1;
    const rawStatus = typeof args.status === 'string' ? args.status : 'done';
    const normalizedStatus = rawStatus === 'completed' || rawStatus === 'complete' ? 'done' : rawStatus;
    const status: 'pending' | 'done' | 'blocked' =
      normalizedStatus === 'pending' || normalizedStatus === 'done' || normalizedStatus === 'blocked'
        ? normalizedStatus
        : 'done';
    const maxIndex = sessionState.currentPlan.steps.length - 1;

    if (stepIndex < 0 || stepIndex > maxIndex) {
      const oneBasedIndex = stepIndex - 1;
      if (oneBasedIndex >= 0 && oneBasedIndex <= maxIndex) {
        stepIndex = oneBasedIndex;
      }
    }

    if (stepIndex < 0 || stepIndex > maxIndex) {
      return {
        handled: true,
        result: {
          success: false,
          error: `Invalid step_index: ${stepIndex}. Valid range is 0-${maxIndex}.`,
          hint: `Plan has ${sessionState.currentPlan.steps.length} steps (indices 0 to ${maxIndex}).`,
          currentPlan: sessionState.currentPlan.steps.map((step, index) => `${index}: ${step.title} [${step.status}]`),
        },
      };
    }

    sessionState.currentPlan.steps[stepIndex].status = status;
    sessionState.currentPlan.updatedAt = Date.now();
    ctx.sendRuntime(options.runMeta, { type: 'plan_update', plan: sessionState.currentPlan });
    return {
      handled: true,
      result: { success: true, step: stepIndex, status, plan: sessionState.currentPlan },
    };
  }

  if (toolName === 'create_file') {
    const filename = typeof args.filename === 'string' ? args.filename.trim() : '';
    const content = typeof args.content === 'string' ? args.content : '';
    const mimeType = typeof args.mimeType === 'string' ? args.mimeType.trim() : 'text/plain';
    if (!filename) {
      return { handled: true, result: { success: false, error: 'filename is required.' } };
    }
    if (!content) {
      return { handled: true, result: { success: false, error: 'content is required.' } };
    }
    ctx.sendRuntime(options.runMeta, {
      type: 'create_file',
      filename,
      content,
      mimeType,
    });
    const sizeKb = Math.max(1, Math.round(new TextEncoder().encode(content).byteLength / 1024));
    return {
      handled: true,
      result: { success: true, filename, mimeType, sizeKb, message: `File "${filename}" (${sizeKb} KB) created and offered for download.` },
    };
  }

  if (toolName === 'spawn_subagent') {
    return {
      handled: true,
      result: await handleSpawnSubagent(ctx, options.runMeta, args, options.settings, executeNestedTool),
    };
  }

  if (toolName === 'subagent_complete') {
    return {
      handled: true,
      result: { success: true, ack: true, details: args || {} },
    };
  }

  if (toolName === 'list_report_images') {
    const images = getReportImageSummary(sessionState);
    return {
      handled: true,
      result: {
        success: true,
        images,
        selectedImageIds: Array.from(sessionState.selectedReportImageIds),
        selectedCount: sessionState.selectedReportImageIds.size,
      },
    };
  }

  if (toolName === 'select_report_images') {
    const rawIds = Array.isArray(args.imageIds) ? args.imageIds : Array.isArray(args.ids) ? args.ids : [];
    const imageIds = rawIds.map((value) => String(value || '').trim()).filter(Boolean);
    const requestedMode = typeof args.mode === 'string' ? args.mode.toLowerCase() : '';
    const mode: 'replace' | 'add' | 'remove' | 'clear' =
      requestedMode === 'add' || requestedMode === 'remove' || requestedMode === 'clear' ? requestedMode : 'replace';

    const images = applyReportImageSelection(sessionState, imageIds, mode);
    const selectedImageIds = Array.from(sessionState.selectedReportImageIds);
    ctx.sendRuntime(options.runMeta, {
      type: 'report_images_selection',
      images,
      selectedImageIds,
    });
    return {
      handled: true,
      result: {
        success: true,
        mode,
        selectedImageIds,
        selectedCount: selectedImageIds.length,
        images,
      },
    };
  }

  return { handled: false };
}
