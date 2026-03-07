import {
  buildOrchestratorPlan,
  getDispatchableOrchestratorTaskIds,
  getOrchestratorPlanValidationIssues,
} from '../../packages/shared/src/orchestrator.js';
import type { OrchestratorPlan } from '../../packages/shared/src/orchestrator.js';

type SimSubagentStatus = 'running' | 'completed' | 'failed';

type SimSubagent = {
  id: string;
  taskId: string;
  status: SimSubagentStatus;
  tabId?: number;
  startedAt: number;
  finishedAt?: number;
};

export type FixtureExecutionResult = {
  fixture: string;
  goal: string;
  success: boolean;
  taskCount: number;
  completedTasks: number;
  missingOutputKeys: string[];
  validationIssues: string[];
  whiteboard: Record<string, unknown>;
  timeline: Array<Record<string, unknown>>;
};

type ExecutorState = {
  fixture: string;
  plan: OrchestratorPlan;
  whiteboard: Map<string, unknown>;
  subagents: Map<string, SimSubagent>;
  timeline: Array<Record<string, unknown>>;
  sequence: number;
};

const now = () => Date.now();

const writeTaskOutputs = (state: ExecutorState, taskId: string) => {
  const task = state.plan.tasks.find((entry) => entry.id === taskId);
  if (!task) return;
  for (const output of task.outputs) {
    state.whiteboard.set(output.key, {
      producerTaskId: taskId,
      status: 'ok',
      value: `${taskId}:${output.key}`,
    });
    state.timeline.push({
      t: now(),
      event: 'whiteboard_set',
      taskId,
      key: output.key,
    });
  }
};

const setOrchestratorPlan = (fixture: string, input: unknown): ExecutorState => {
  const plan = buildOrchestratorPlan((input || {}) as Record<string, unknown>);
  const state: ExecutorState = {
    fixture,
    plan,
    whiteboard: new Map(),
    subagents: new Map(),
    timeline: [],
    sequence: 0,
  };
  state.timeline.push({
    t: now(),
    event: 'set_orchestrator_plan',
    goal: plan.goal,
    taskCount: plan.tasks.length,
  });
  for (const task of state.plan.tasks) {
    if (task.status === 'completed') {
      writeTaskOutputs(state, task.id);
    }
  }
  return state;
};

const dispatchOrchestratorTasks = (state: ExecutorState, maxTasks?: number) => {
  const runningTaskIds = Array.from(state.subagents.values())
    .filter((entry) => entry.status === 'running')
    .map((entry) => entry.taskId);
  const slots = Math.max(
    0,
    Math.min(
      5,
      Number.isFinite(Number(maxTasks))
        ? Math.floor(Number(maxTasks))
        : state.plan.maxConcurrentTabs - runningTaskIds.length,
    ),
  );
  if (slots <= 0) return [];

  const dispatchable = getDispatchableOrchestratorTaskIds(state.plan, {
    runningTaskIds,
    maxSlots: slots,
  });

  for (const taskId of dispatchable) {
    const task = state.plan.tasks.find((entry) => entry.id === taskId);
    if (!task) continue;
    task.status = 'running';
    const id = `sim-subagent-${++state.sequence}`;
    state.subagents.set(id, {
      id,
      taskId,
      status: 'running',
      tabId: task.assignedTabId,
      startedAt: now(),
    });
    state.timeline.push({
      t: now(),
      event: 'dispatch_orchestrator_task',
      taskId,
      subagentId: id,
      tabId: task.assignedTabId,
    });
  }

  return dispatchable;
};

const awaitSubagent = (state: ExecutorState) => {
  const running = Array.from(state.subagents.values()).filter((entry) => entry.status === 'running');
  for (const subagent of running) {
    subagent.status = 'completed';
    subagent.finishedAt = now();
    const task = state.plan.tasks.find((entry) => entry.id === subagent.taskId);
    if (task) {
      task.status = 'completed';
      writeTaskOutputs(state, task.id);
    }
    state.timeline.push({
      t: now(),
      event: 'await_subagent',
      subagentId: subagent.id,
      taskId: subagent.taskId,
      status: 'completed',
    });
  }
  return running.length;
};

const getMissingRequiredOutputKeys = (state: ExecutorState) => {
  const requiredKeys = new Set(
    state.plan.tasks
      .flatMap((task) => task.outputs)
      .filter((binding) => binding.required !== false)
      .map((binding) => binding.key),
  );
  return Array.from(requiredKeys).filter((key) => !state.whiteboard.has(key));
};

export function executeOrchestratorFixture(fixture: string, input: unknown): FixtureExecutionResult {
  const state = setOrchestratorPlan(fixture, input);
  const validationIssues = getOrchestratorPlanValidationIssues(state.plan);
  if (validationIssues.length > 0) {
    return {
      fixture,
      goal: state.plan.goal,
      success: false,
      taskCount: state.plan.tasks.length,
      completedTasks: state.plan.tasks.filter((task) => task.status === 'completed').length,
      missingOutputKeys: [],
      validationIssues,
      whiteboard: {},
      timeline: state.timeline,
    };
  }

  let safety = 0;
  while (safety < 100) {
    safety += 1;
    const dispatched = dispatchOrchestratorTasks(state);
    if (dispatched.length === 0) break;
    awaitSubagent(state);
  }

  const missingOutputKeys = getMissingRequiredOutputKeys(state);
  const completedTasks = state.plan.tasks.filter((task) => task.status === 'completed').length;
  const success = missingOutputKeys.length === 0 && completedTasks === state.plan.tasks.length;

  state.timeline.push({
    t: now(),
    event: 'goal_validation',
    success,
    completedTasks,
    taskCount: state.plan.tasks.length,
    missingOutputKeys,
  });

  return {
    fixture,
    goal: state.plan.goal,
    success,
    taskCount: state.plan.tasks.length,
    completedTasks,
    missingOutputKeys,
    validationIssues: [],
    whiteboard: Object.fromEntries(state.whiteboard.entries()),
    timeline: state.timeline,
  };
}
