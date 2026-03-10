import {
  buildOrchestratorPlan,
  getDispatchableOrchestratorTaskIds,
  getOrchestratorPlanValidationIssues,
} from '@parchi/shared';
import type { ServiceContext } from '../service-context.js';
import type { SessionState } from '../service-types.js';
import {
  awaitSubagents,
  buildPlanSummary,
  clonePlan,
  findTask,
  listHistoricalSubagents,
  listRunningSubagents,
  normalizeTaskStatus,
  seedCompletedTaskOutputs,
  snapshotWhiteboard,
  syncReadyStatuses,
  validateTaskAgainstWhiteboard,
  writeTaskOutputsToWhiteboard,
} from './orchestrator-runtime-state.js';
import {
  getSyntheticSubagentSpecs,
  spawnSyntheticSubagentForOrchestratorTest,
} from './tool-executor-orchestrator-test-mode.js';
import {
  type NestedToolExecutor,
  type ToolExecutionArgs,
  type ToolExecutionOptions,
  isObjectRecord,
} from './tool-executor-shared.js';

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
    const plan = buildOrchestratorPlan(args, { existingPlan: clonePlan(sessionState.orchestratorPlan) });
    syncReadyStatuses(plan);
    sessionState.orchestratorPlan = plan;
    seedCompletedTaskOutputs(sessionState, plan, Date.now());
    ctx.sendRuntime(options.runMeta, {
      type: 'run_status',
      phase: 'planning',
      attempts: { api: 0, tool: 0, finalize: 0 },
      maxRetries: { api: 0, tool: 0, finalize: 0 },
      note: `Orchestrator plan ready: ${plan.tasks.length} task(s).`,
      stage: 'orchestrator_plan',
      source: 'set_orchestrator_plan',
    });
    return { handled: true, result: { success: true, ...buildPlanSummary(plan) } };
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
    if (!sessionState.orchestratorPlan) {
      return { handled: true, result: { success: false, error: 'No orchestrator plan exists for this session.' } };
    }
    const plan = sessionState.orchestratorPlan;
    const validationIssues = getOrchestratorPlanValidationIssues(plan);
    if (validationIssues.length > 0) {
      return { handled: true, result: { success: false, error: 'Plan validation failed.', validationIssues } };
    }

    syncReadyStatuses(plan);
    const runningTaskIds = Array.from(sessionState.runningSubagents.values())
      .map((entry) => entry.taskId)
      .filter((value): value is string => Boolean(value));
    const requestedMax =
      typeof args.maxTasks === 'number' && Number.isFinite(args.maxTasks) ? Math.floor(args.maxTasks) : null;
    const remainingSlots = Math.max(0, plan.maxConcurrentTabs - runningTaskIds.length);
    const maxSlots = requestedMax === null ? remainingSlots : Math.max(0, Math.min(remainingSlots, requestedMax));
    const dispatchableTaskIds = getDispatchableOrchestratorTaskIds(plan, { runningTaskIds, maxSlots });
    const syntheticSpecs = getSyntheticSubagentSpecs(args.__testSubagentResults);

    const dispatched: Array<Record<string, unknown>> = [];
    for (const taskId of dispatchableTaskIds) {
      const task = findTask(plan, taskId);
      if (!task) continue;
      task.status = 'running';
      const syntheticSpec = syntheticSpecs && isObjectRecord(syntheticSpecs[task.id]) ? syntheticSpecs[task.id] : null;
      const spawnResult = syntheticSpec
        ? ((await spawnSyntheticSubagentForOrchestratorTest(
            ctx,
            sessionState,
            options.runMeta,
            task,
            syntheticSpec,
          )) as Record<string, unknown>)
        : ((await executeNestedTool(
            'spawn_subagent',
            {
              name: task.title,
              profile: task.assignedProfile,
              prompt:
                task.prompt ||
                task.summary ||
                `You are executing orchestrator task "${task.title}". Complete the task and cite evidence in your final summary.`,
              tasks: [
                task.title,
                ...(task.summary ? [`Context: ${task.summary}`] : []),
                ...(task.outputs.length
                  ? [`Required outputs: ${task.outputs.map((output) => output.key).join(', ')}.`]
                  : []),
              ],
              orchestratorTaskId: task.id,
            },
            options,
          )) as Record<string, unknown>);

      if (spawnResult.success !== true) {
        task.status = 'failed';
        dispatched.push({
          taskId: task.id,
          taskTitle: task.title,
          success: false,
          error: spawnResult.error || 'spawn_subagent failed',
        });
        continue;
      }
      if (typeof spawnResult.tabId === 'number' && Number.isFinite(spawnResult.tabId)) {
        task.assignedTabId = Math.floor(spawnResult.tabId);
      }
      dispatched.push({
        taskId: task.id,
        taskTitle: task.title,
        subagentId: spawnResult.id,
        tabId: spawnResult.tabId,
        success: true,
      });
    }

    plan.updatedAt = Date.now();
    return { handled: true, result: { success: true, dispatched, ...buildPlanSummary(plan) } };
  }

  return { handled: false };
}
