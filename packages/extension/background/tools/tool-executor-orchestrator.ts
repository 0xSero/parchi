import type { ServiceContext } from '../service-context.js';
import type { SessionState } from '../service-types.js';
import { dispatchOrchestratorTasks, setOrchestratorPlan } from './orchestrator-dispatch.js';
import {
  awaitSubagents,
  buildPlanSummary,
  findTask,
  listHistoricalSubagents,
  listRunningSubagents,
  normalizeTaskStatus,
  snapshotWhiteboard,
  syncReadyStatuses,
  validateTaskAgainstWhiteboard,
  writeTaskOutputsToWhiteboard,
} from './orchestrator-runtime-state.js';
import type { NestedToolExecutor, ToolExecutionArgs, ToolExecutionOptions } from './tool-executor-shared.js';

export { recordSubagentCompletion, recordSubagentStart } from './orchestrator-runtime-state.js';

export async function handleOrchestratorBuiltin(
  ctx: ServiceContext,
  sessionState: SessionState,
  toolName: string,
  args: ToolExecutionArgs,
  options: ToolExecutionOptions,
  executeNestedTool: NestedToolExecutor,
): Promise<{ handled: boolean; result?: unknown }> {
  if (toolName === 'list_subagents') {
    return {
      handled: true,
      result: {
        success: true,
        running: listRunningSubagents(sessionState),
        history: listHistoricalSubagents(sessionState),
      },
    };
  }

  if (toolName === 'await_subagent' || toolName === 'await_agents') {
    const awaited = await awaitSubagents(sessionState, args);
    if (!awaited.success || !sessionState.orchestratorPlan) {
      return { handled: true, result: awaited };
    }

    const plan = sessionState.orchestratorPlan;
    const taskValidationFailures: string[] = [];
    for (const result of awaited.agents) {
      const task = result.taskId ? findTask(plan, result.taskId) : null;
      if (!task) continue;
      if (result.success) {
        writeTaskOutputsToWhiteboard(sessionState, task, result, Date.now());
        const failures = validateTaskAgainstWhiteboard(sessionState, task);
        if (failures.length > 0) {
          task.status = 'blocked';
          taskValidationFailures.push(...failures);
        } else {
          task.status = 'completed';
        }
      } else {
        task.status = 'failed';
      }
    }
    plan.updatedAt = Date.now();
    syncReadyStatuses(plan);
    return {
      handled: true,
      result: {
        ...awaited,
        planSummary: buildPlanSummary(plan),
        whiteboard: snapshotWhiteboard(sessionState),
        taskValidationFailures,
      },
    };
  }

  if (toolName === 'set_orchestrator_plan') {
    return setOrchestratorPlan(ctx, sessionState, args, options);
  }

  if (toolName === 'get_orchestrator_plan') {
    if (!sessionState.orchestratorPlan) {
      return { handled: true, result: { success: false, error: 'No orchestrator plan exists for this session.' } };
    }
    return {
      handled: true,
      result: {
        success: true,
        ...buildPlanSummary(sessionState.orchestratorPlan),
        whiteboard: snapshotWhiteboard(sessionState),
        subagents: {
          running: listRunningSubagents(sessionState),
          history: listHistoricalSubagents(sessionState),
        },
      },
    };
  }

  if (toolName === 'update_orchestrator_task') {
    if (!sessionState.orchestratorPlan) {
      return { handled: true, result: { success: false, error: 'No orchestrator plan exists for this session.' } };
    }
    const taskId = String(args.taskId ?? args.id ?? '').trim();
    if (!taskId) {
      return { handled: true, result: { success: false, error: 'taskId is required.' } };
    }
    const task = findTask(sessionState.orchestratorPlan, taskId);
    if (!task) {
      return { handled: true, result: { success: false, error: `Unknown taskId "${taskId}".` } };
    }
    const nextStatus = normalizeTaskStatus(args.status);
    if (nextStatus) task.status = nextStatus;
    if (typeof args.notes === 'string') task.notes = args.notes.trim() || undefined;
    if (typeof args.prompt === 'string') task.prompt = args.prompt.trim() || undefined;
    if (typeof args.assignedProfile === 'string') task.assignedProfile = args.assignedProfile.trim() || undefined;
    if (typeof args.assignedTabId === 'number' && Number.isFinite(args.assignedTabId)) {
      task.assignedTabId = Math.floor(args.assignedTabId);
    }
    sessionState.orchestratorPlan.updatedAt = Date.now();
    syncReadyStatuses(sessionState.orchestratorPlan);
    return { handled: true, result: { success: true, task, ...buildPlanSummary(sessionState.orchestratorPlan) } };
  }

  if (toolName === 'dispatch_orchestrator_tasks') {
    return dispatchOrchestratorTasks(ctx, sessionState, args, options, executeNestedTool);
  }

  return { handled: false };
}
