import {
  type OrchestratorPlan,
  type OrchestratorTaskStatus,
  getOrchestratorPlanValidationIssues,
  getReadyOrchestratorTaskIds,
} from '@parchi/shared';

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
