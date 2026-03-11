import {
  buildOrchestratorPlan,
  getDispatchableOrchestratorTaskIds,
  getOrchestratorPlanValidationIssues,
} from '@parchi/shared';
import type { ServiceContext } from '../service-context.js';
import type { SessionState } from '../service-types.js';
import {
  buildPlanSummary,
  clonePlan,
  seedCompletedTaskOutputs,
  syncReadyStatuses,
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

export async function dispatchOrchestratorTasks(
  ctx: ServiceContext,
  sessionState: SessionState,
  args: ToolExecutionArgs,
  options: ToolExecutionOptions,
  executeNestedTool: NestedToolExecutor,
): Promise<{ handled: true; result: unknown }> {
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
    const task = plan.tasks.find((t) => t.id === taskId);
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

export async function setOrchestratorPlan(
  ctx: ServiceContext,
  sessionState: SessionState,
  args: ToolExecutionArgs,
  options: ToolExecutionOptions,
): Promise<{ handled: true; result: unknown }> {
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
