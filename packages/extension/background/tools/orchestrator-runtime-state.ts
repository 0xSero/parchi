import {
  type OrchestratorPlan,
  type OrchestratorTaskNode,
  type OrchestratorTaskStatus,
  getOrchestratorPlanValidationIssues,
  getReadyOrchestratorTaskIds,
} from '@parchi/shared';
import type { HistoricalSubagent, SessionState, SubagentResult } from '../service-types.js';
import type { ToolExecutionArgs } from './tool-executor-shared.js';

const ORCHESTRATOR_TASK_STATUS_ALIASES: Record<string, OrchestratorTaskStatus> = {
  complete: 'completed',
  completed: 'completed',
  done: 'completed',
  cancel: 'cancelled',
  canceled: 'cancelled',
  cancelled: 'cancelled',
};

export const normalizeTaskStatus = (value: unknown): OrchestratorTaskStatus | null => {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) return null;
  const normalized = ORCHESTRATOR_TASK_STATUS_ALIASES[raw] || raw;
  return normalized === 'pending' ||
    normalized === 'ready' ||
    normalized === 'running' ||
    normalized === 'blocked' ||
    normalized === 'completed' ||
    normalized === 'failed' ||
    normalized === 'cancelled'
    ? normalized
    : null;
};

export const clonePlan = (plan: OrchestratorPlan | null): OrchestratorPlan | null =>
  plan
    ? {
        ...plan,
        tasks: plan.tasks.map((task) => ({
          ...task,
          dependencies: [...task.dependencies],
          sitePatterns: [...task.sitePatterns],
          requiredSkills: [...task.requiredSkills],
          inputs: task.inputs.map((entry) => ({ ...entry })),
          outputs: task.outputs.map((entry) => ({ ...entry })),
          validations: task.validations.map((entry) => ({ ...entry })),
        })),
        assumptions: [...plan.assumptions],
        interviewQuestions: plan.interviewQuestions.map((question) => ({ ...question })),
        whiteboardKeys: [...plan.whiteboardKeys],
      }
    : null;

export const listHistoricalSubagents = (sessionState: SessionState) =>
  Array.from(sessionState.subagentHistory.values())
    .filter((entry) => entry.status !== 'running')
    .sort((a, b) => a.startedAt - b.startedAt);

export const listRunningSubagents = (sessionState: SessionState): HistoricalSubagent[] =>
  Array.from(sessionState.runningSubagents.values()).map((entry) => ({
    id: entry.id,
    name: entry.name,
    tabId: entry.tabId,
    agentSessionId: entry.agentSessionId,
    colorIndex: entry.colorIndex,
    taskId: entry.taskId,
    status: 'running',
    startedAt: entry.startedAt,
  }));

export const snapshotWhiteboard = (sessionState: SessionState) =>
  Object.fromEntries(
    Array.from(sessionState.orchestratorWhiteboard.entries()).map(([key, entry]) => [key, { ...entry }]),
  );

export const syncReadyStatuses = (plan: OrchestratorPlan) => {
  const completed = new Set(plan.tasks.filter((task) => task.status === 'completed').map((task) => task.id));
  for (const task of plan.tasks) {
    if (task.status === 'pending' && task.dependencies.every((dependency) => completed.has(dependency))) {
      task.status = 'ready';
    }
  }
};

export const buildPlanSummary = (plan: OrchestratorPlan | null) => {
  if (!plan) return null;
  const validationIssues = getOrchestratorPlanValidationIssues(plan);
  const readyTaskIds = getReadyOrchestratorTaskIds(plan);
  return {
    plan,
    validationIssues,
    readyTaskIds,
    taskCounts: {
      total: plan.tasks.length,
      pending: plan.tasks.filter((task) => task.status === 'pending').length,
      ready: plan.tasks.filter((task) => task.status === 'ready').length,
      running: plan.tasks.filter((task) => task.status === 'running').length,
      blocked: plan.tasks.filter((task) => task.status === 'blocked').length,
      completed: plan.tasks.filter((task) => task.status === 'completed').length,
      failed: plan.tasks.filter((task) => task.status === 'failed').length,
      cancelled: plan.tasks.filter((task) => task.status === 'cancelled').length,
    },
  };
};

export const findTask = (plan: OrchestratorPlan | null, taskId: string) =>
  plan?.tasks.find((task) => task.id === taskId) || null;

export const writeTaskOutputsToWhiteboard = (
  sessionState: SessionState,
  task: OrchestratorTaskNode,
  result: SubagentResult,
  now: number,
) => {
  const payload =
    result.data && typeof result.data === 'object' && !Array.isArray(result.data)
      ? (result.data as Record<string, unknown>)
      : null;
  for (const output of task.outputs) {
    const value =
      payload && Object.prototype.hasOwnProperty.call(payload, output.key)
        ? payload[output.key]
        : payload && task.outputs.length === 1 && Object.keys(payload).length > 0
          ? payload
          : result.summary;
    sessionState.orchestratorWhiteboard.set(output.key, {
      key: output.key,
      value,
      updatedAt: now,
      updatedBy: 'subagent',
      note: result.summary,
    });
  }
};

export const seedCompletedTaskOutputs = (sessionState: SessionState, plan: OrchestratorPlan, now: number) => {
  for (const task of plan.tasks) {
    if (task.status !== 'completed') continue;
    for (const output of task.outputs) {
      if (sessionState.orchestratorWhiteboard.has(output.key)) continue;
      sessionState.orchestratorWhiteboard.set(output.key, {
        key: output.key,
        value: `${task.id}:${output.key}`,
        updatedAt: now,
        updatedBy: 'system',
        note: 'Seeded from pre-completed orchestrator task.',
      });
    }
  }
};

export const validateTaskAgainstWhiteboard = (sessionState: SessionState, task: OrchestratorTaskNode) => {
  const failures: string[] = [];
  for (const rule of task.validations) {
    if (rule.kind !== 'whiteboard_key' || rule.required === false) continue;
    const key = String(rule.value || '').trim();
    if (!key) continue;
    if (!sessionState.orchestratorWhiteboard.has(key)) {
      failures.push(`Missing whiteboard key "${key}" for task "${task.id}".`);
    }
  }
  for (const output of task.outputs) {
    if (output.required === false) continue;
    if (!sessionState.orchestratorWhiteboard.has(output.key)) {
      failures.push(`Missing required output "${output.key}" for task "${task.id}".`);
    }
  }
  return failures;
};

const updateSubagentHistory = (
  sessionState: SessionState,
  result: SubagentResult,
  status: HistoricalSubagent['status'],
) => {
  const existing = sessionState.subagentHistory.get(result.id);
  if (!existing) return;
  existing.status = status;
  existing.success = result.success;
  existing.summary = result.summary;
  existing.data = result.data;
  existing.finishedAt = Date.now();
};

export function recordSubagentStart(
  sessionState: SessionState,
  payload: {
    id: string;
    name: string;
    tabId: number;
    agentSessionId: string;
    colorIndex: number;
    taskId?: string;
    startedAt: number;
  },
) {
  sessionState.subagentHistory.set(payload.id, {
    id: payload.id,
    name: payload.name,
    tabId: payload.tabId,
    agentSessionId: payload.agentSessionId,
    colorIndex: payload.colorIndex,
    taskId: payload.taskId,
    status: 'running',
    startedAt: payload.startedAt,
  });
}

export const recordSubagentCompletion = (sessionState: SessionState, result: SubagentResult) =>
  updateSubagentHistory(sessionState, result, result.success ? 'completed' : 'failed');

export async function awaitSubagents(
  sessionState: SessionState,
  args: ToolExecutionArgs,
): Promise<
  | { success: true; agents: SubagentResult[]; note?: string }
  | { success: false; error: string; pendingAgents?: Array<{ id: string; name: string; tabId: number }> }
> {
  const running = sessionState.runningSubagents;
  if (running.size === 0) {
    return { success: true, agents: [], note: 'No running sub-agents to wait for.' };
  }

  const requestedIds = Array.isArray(args.agentIds)
    ? args.agentIds.map((id) => String(id || '').trim()).filter(Boolean)
    : typeof args.agentId === 'string' && args.agentId.trim()
      ? [args.agentId.trim()]
      : [];
  const timeoutSec = typeof args.timeout === 'number' && args.timeout > 0 ? args.timeout : 300;
  const timeoutMs = Math.min(timeoutSec * 1000, 300_000);

  const targets = requestedIds.length
    ? requestedIds.map((id) => running.get(id)).filter(Boolean)
    : Array.from(running.values());

  if (targets.length === 0) {
    return { success: false, error: 'None of the specified agent IDs are currently running.' };
  }

  const promises = targets.map((agent) => agent!.promise);
  const timer = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), timeoutMs));
  const raceResult = await Promise.race([Promise.all(promises), timer]);

  if (raceResult === 'timeout') {
    const pending = targets.map((a) => ({ id: a!.id, name: a!.name, tabId: a!.tabId }));
    return { success: false, error: 'Timed out waiting for agents.', pendingAgents: pending };
  }

  const results = raceResult as SubagentResult[];
  for (const result of results) {
    running.delete(result.id);
    updateSubagentHistory(sessionState, result, result.success ? 'completed' : 'failed');
  }
  return { success: true, agents: results };
}
