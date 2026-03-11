/**
 * Functions for building and normalizing orchestrator plans and tasks.
 */

import {
  type OrchestratorInterviewQuestion,
  type OrchestratorPlan,
  type OrchestratorTaskBinding,
  type OrchestratorTaskKind,
  type OrchestratorTaskNode,
  type OrchestratorValidationRule,
  TASK_KIND_SET,
} from './orchestrator-types.js';
import { normalizeOrchestratorTaskStatus } from './task-status-helpers.js';

type BuildOrchestratorPlanInput = {
  goal?: unknown;
  assumptions?: unknown;
  interviewQuestions?: unknown;
  tasks?: unknown;
  whiteboardKeys?: unknown;
  maxConcurrentTabs?: unknown;
};

const normalizeStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((entry) => String(entry || '').trim()).filter(Boolean) : [];

const normalizeBindingArray = (value: unknown): OrchestratorTaskBinding[] => {
  if (!Array.isArray(value)) return [];
  const normalized: OrchestratorTaskBinding[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as OrchestratorTaskBinding;
    const key = String(candidate.key || '').trim();
    if (!key) continue;
    normalized.push({
      key,
      description:
        typeof candidate.description === 'string' && candidate.description.trim()
          ? candidate.description.trim()
          : undefined,
      required: candidate.required !== false,
      fromTaskId:
        typeof candidate.fromTaskId === 'string' && candidate.fromTaskId.trim()
          ? candidate.fromTaskId.trim()
          : undefined,
    });
  }
  return normalized;
};

const normalizeValidationArray = (value: unknown): OrchestratorValidationRule[] => {
  if (!Array.isArray(value)) return [];
  const normalized: OrchestratorValidationRule[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as OrchestratorValidationRule;
    const kind = String(candidate.kind || '').trim() as OrchestratorValidationRule['kind'];
    if (!kind) continue;
    normalized.push({
      kind,
      value: typeof candidate.value === 'string' && candidate.value.trim() ? candidate.value.trim() : undefined,
      selector:
        typeof candidate.selector === 'string' && candidate.selector.trim() ? candidate.selector.trim() : undefined,
      required: candidate.required !== false,
    });
  }
  return normalized;
};

/**
 * Normalizes an array of task inputs into valid OrchestratorTaskNode objects.
 * Filters out invalid entries and applies defaults.
 */
export function normalizeOrchestratorTasks(input: unknown): OrchestratorTaskNode[] {
  if (!Array.isArray(input)) return [];
  const normalized: OrchestratorTaskNode[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const entry = input[index];
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Partial<OrchestratorTaskNode>;
    const id = String(candidate.id || `task-${index + 1}`).trim();
    const title = String(candidate.title || '').trim();
    if (!title) continue;
    const rawKind = String(candidate.kind || 'browser')
      .trim()
      .toLowerCase() as OrchestratorTaskKind;
    const kind = TASK_KIND_SET.has(rawKind) ? rawKind : 'browser';
    const dependencies = normalizeStringArray(candidate.dependencies).filter((dependency) => dependency !== id);
    normalized.push({
      id,
      title,
      summary: typeof candidate.summary === 'string' && candidate.summary.trim() ? candidate.summary.trim() : undefined,
      kind,
      status: normalizeOrchestratorTaskStatus(candidate.status),
      dependencies,
      sitePatterns: normalizeStringArray(candidate.sitePatterns),
      requiredSkills: normalizeStringArray(candidate.requiredSkills),
      assignedProfile:
        typeof candidate.assignedProfile === 'string' && candidate.assignedProfile.trim()
          ? candidate.assignedProfile.trim()
          : undefined,
      assignedTabId: typeof candidate.assignedTabId === 'number' ? candidate.assignedTabId : undefined,
      prompt: typeof candidate.prompt === 'string' && candidate.prompt.trim() ? candidate.prompt.trim() : undefined,
      inputs: normalizeBindingArray(candidate.inputs),
      outputs: normalizeBindingArray(candidate.outputs),
      validations: normalizeValidationArray(candidate.validations),
      notes: typeof candidate.notes === 'string' && candidate.notes.trim() ? candidate.notes.trim() : undefined,
      maxAttempts:
        typeof candidate.maxAttempts === 'number' && Number.isFinite(candidate.maxAttempts)
          ? Math.max(1, Math.floor(candidate.maxAttempts))
          : undefined,
    });
  }
  return normalized;
}

/**
 * Builds a complete OrchestratorPlan from input data.
 * Merges with an existing plan if provided, preserving createdAt timestamp.
 */
export function buildOrchestratorPlan(
  input: BuildOrchestratorPlanInput,
  options: { now?: number; existingPlan?: OrchestratorPlan | null } = {},
): OrchestratorPlan {
  const now = options.now ?? Date.now();
  const existingPlan = options.existingPlan ?? null;
  const tasks = normalizeOrchestratorTasks(input.tasks ?? existingPlan?.tasks ?? []);
  const interviewQuestions: OrchestratorInterviewQuestion[] = [];
  if (Array.isArray(input.interviewQuestions)) {
    for (let index = 0; index < input.interviewQuestions.length; index += 1) {
      const entry = input.interviewQuestions[index];
      if (!entry || typeof entry !== 'object') continue;
      const candidate = entry as OrchestratorInterviewQuestion;
      const question = String(candidate.question || '').trim();
      if (!question) continue;
      interviewQuestions.push({
        id: String(candidate.id || `question-${index + 1}`).trim(),
        question,
        answerKey:
          typeof candidate.answerKey === 'string' && candidate.answerKey.trim()
            ? candidate.answerKey.trim()
            : undefined,
        required: candidate.required !== false,
      });
    }
  }
  return {
    version: 1,
    goal: String(input.goal || existingPlan?.goal || '').trim(),
    assumptions: normalizeStringArray(input.assumptions ?? existingPlan?.assumptions ?? []),
    interviewQuestions: interviewQuestions.length ? interviewQuestions : (existingPlan?.interviewQuestions ?? []),
    tasks,
    whiteboardKeys: Array.from(
      new Set([
        ...normalizeStringArray(input.whiteboardKeys ?? existingPlan?.whiteboardKeys ?? []),
        ...tasks.flatMap((task) => task.inputs.map((binding) => binding.key)),
        ...tasks.flatMap((task) => task.outputs.map((binding) => binding.key)),
      ]),
    ),
    maxConcurrentTabs: Math.max(
      1,
      Math.min(5, Math.floor(Number(input.maxConcurrentTabs || existingPlan?.maxConcurrentTabs || 1))),
    ),
    createdAt: existingPlan?.createdAt ?? now,
    updatedAt: now,
  };
}
