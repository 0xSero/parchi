import { COMMON_TASK_STATUSES, type CommonTaskStatus } from './orchestrator-types.js';

/**
 * Plan-specific statuses that extend the common task statuses.
 * 'done' is unique to plans (orchestrator uses 'completed' instead).
 */
export const PLAN_SPECIFIC_STATUSES = ['done'] as const;

export type PlanSpecificStatus = (typeof PLAN_SPECIFIC_STATUSES)[number];

/**
 * Full plan status values, combining common task statuses with plan-specific ones.
 */
export const PLAN_STATUSES = [...COMMON_TASK_STATUSES, ...PLAN_SPECIFIC_STATUSES] as const;

export type PlanStatus = CommonTaskStatus | PlanSpecificStatus;

const PLAN_STATUS_SET = new Set<PlanStatus>(PLAN_STATUSES);

export type PlanStep = {
  id: string;
  title: string;
  status: PlanStatus;
  notes?: string;
};

export type RunPlan = {
  steps: PlanStep[];
  createdAt: number;
  updatedAt: number;
};

type PlanStepInput = {
  title?: string;
  status?: string;
  notes?: string;
};

export function normalizePlanStatus(value: unknown): PlanStatus {
  if (typeof value !== 'string') return 'pending';
  const lowered = value.trim().toLowerCase();
  return PLAN_STATUS_SET.has(lowered as PlanStatus) ? (lowered as PlanStatus) : 'pending';
}

export function normalizePlanSteps(input: unknown, options: { maxSteps?: number } = {}): PlanStep[] {
  const rawSteps = Array.isArray(input) ? input : [];
  const maxSteps = options.maxSteps ?? 8;
  const normalized: PlanStep[] = [];

  for (const step of rawSteps) {
    let title = '';
    let status: PlanStatus = 'pending';
    let notes: string | undefined;

    if (typeof step === 'string') {
      title = step.trim();
    } else if (step && typeof step === 'object') {
      const candidate = step as PlanStepInput;
      if (typeof candidate.title === 'string') {
        title = candidate.title.trim();
      }
      status = normalizePlanStatus(candidate.status);
      if (typeof candidate.notes === 'string' && candidate.notes.trim()) {
        notes = candidate.notes.trim();
      }
    }

    if (!title) continue;
    normalized.push({
      id: `step-${normalized.length + 1}`,
      title,
      status,
      ...(notes ? { notes } : {}),
    });

    if (normalized.length >= maxSteps) break;
  }

  return normalized;
}

export function buildRunPlan(
  stepsInput: unknown,
  options: { existingPlan?: RunPlan | null; now?: number; maxSteps?: number; mode?: 'replace' | 'append' } = {},
): RunPlan {
  const now = options.now ?? Date.now();
  const maxSteps = options.maxSteps ?? 8;
  const mode = options.mode ?? 'replace';
  const incomingSteps = normalizePlanSteps(stepsInput, { maxSteps });
  const existingPlan = options.existingPlan ?? null;
  const existingSteps = existingPlan?.steps || [];

  const steps =
    mode === 'append'
      ? [
          ...existingSteps.map((step, index) => ({
            ...step,
            id: step.id || `step-${index + 1}`,
          })),
          ...incomingSteps.map((step, index) => ({
            ...step,
            id: `step-${existingSteps.length + index + 1}`,
          })),
        ].slice(0, maxSteps)
      : incomingSteps;

  const createdAt = options.existingPlan?.createdAt ?? now;
  return {
    steps,
    createdAt,
    updatedAt: now,
  };
}

/**
 * Returns true if the plan status is a terminal state (no further transitions).
 */
export function isPlanStatusTerminal(status: PlanStatus): boolean {
  return status === 'done';
}
