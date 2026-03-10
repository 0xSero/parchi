/**
 * Common task statuses shared between PlanStatus and OrchestratorTaskStatus.
 * These represent the fundamental states that apply to both plan steps and orchestrator tasks.
 */
export const COMMON_TASK_STATUSES = ['pending', 'running', 'blocked'] as const;

export type CommonTaskStatus = (typeof COMMON_TASK_STATUSES)[number];

/**
 * Extended task statuses for orchestrator tasks.
 * Includes all common statuses plus orchestrator-specific states.
 */
export const ORCHESTRATOR_TASK_STATUSES = [
  'pending',
  'ready',
  'running',
  'blocked',
  'completed',
  'failed',
  'cancelled',
] as const;

export type OrchestratorTaskStatus = (typeof ORCHESTRATOR_TASK_STATUSES)[number];

export type OrchestratorTaskKind = 'browser' | 'research' | 'synthesis' | 'validation' | 'handoff';

export type OrchestratorTaskBinding = {
  key: string;
  description?: string;
  required?: boolean;
  fromTaskId?: string;
};

export type OrchestratorValidationRule = {
  kind: 'url_includes' | 'dom_includes' | 'whiteboard_key' | 'tool_success' | 'manual';
  value?: string;
  selector?: string;
  required?: boolean;
};

export type OrchestratorTaskNode = {
  id: string;
  title: string;
  summary?: string;
  kind: OrchestratorTaskKind;
  status: OrchestratorTaskStatus;
  dependencies: string[];
  sitePatterns: string[];
  requiredSkills: string[];
  assignedProfile?: string;
  assignedTabId?: number;
  prompt?: string;
  inputs: OrchestratorTaskBinding[];
  outputs: OrchestratorTaskBinding[];
  validations: OrchestratorValidationRule[];
  notes?: string;
  maxAttempts?: number;
};

export type OrchestratorInterviewQuestion = {
  id: string;
  question: string;
  answerKey?: string;
  required?: boolean;
};

export type OrchestratorPlan = {
  version: 1;
  goal: string;
  assumptions: string[];
  interviewQuestions: OrchestratorInterviewQuestion[];
  tasks: OrchestratorTaskNode[];
  whiteboardKeys: string[];
  maxConcurrentTabs: number;
  createdAt: number;
  updatedAt: number;
};

export type WhiteboardEntry = {
  key: string;
  value: unknown;
  updatedAt: number;
  updatedBy: 'user' | 'assistant' | 'subagent' | 'system';
  note?: string;
};

type BuildOrchestratorPlanInput = {
  goal?: unknown;
  assumptions?: unknown;
  interviewQuestions?: unknown;
  tasks?: unknown;
  whiteboardKeys?: unknown;
  maxConcurrentTabs?: unknown;
};

const TASK_STATUS_SET = new Set<OrchestratorTaskStatus>(ORCHESTRATOR_TASK_STATUSES);
const TASK_KIND_SET = new Set<OrchestratorTaskKind>(['browser', 'research', 'synthesis', 'validation', 'handoff']);

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

export function normalizeOrchestratorTaskStatus(value: unknown): OrchestratorTaskStatus {
  if (typeof value !== 'string') return 'pending';
  const normalized = value.trim().toLowerCase() as OrchestratorTaskStatus;
  return TASK_STATUS_SET.has(normalized) ? normalized : 'pending';
}

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

export function isOrchestratorTaskTerminal(status: OrchestratorTaskStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

export function getReadyOrchestratorTaskIds(plan: OrchestratorPlan): string[] {
  const completed = new Set(plan.tasks.filter((task) => task.status === 'completed').map((task) => task.id));
  return plan.tasks
    .filter((task) => task.status === 'pending' || task.status === 'ready')
    .filter((task) => task.dependencies.every((dependency) => completed.has(dependency)))
    .map((task) => task.id);
}

export function getDispatchableOrchestratorTaskIds(
  plan: OrchestratorPlan,
  options: { runningTaskIds?: string[]; maxSlots?: number } = {},
): string[] {
  const ready = getReadyOrchestratorTaskIds(plan);
  const running = new Set(Array.isArray(options.runningTaskIds) ? options.runningTaskIds : []);
  const maxSlots = Math.max(0, Math.min(5, Math.floor(options.maxSlots ?? plan.maxConcurrentTabs)));
  if (maxSlots === 0) return [];
  return ready.filter((taskId) => !running.has(taskId)).slice(0, maxSlots);
}

export function getOrchestratorPlanValidationIssues(plan: OrchestratorPlan): string[] {
  const issues: string[] = [];
  const taskIds = new Set(plan.tasks.map((task) => task.id));

  for (const task of plan.tasks) {
    for (const dependency of task.dependencies) {
      if (!taskIds.has(dependency)) {
        issues.push(`Task "${task.id}" has missing dependency "${dependency}".`);
      }
    }
    for (const input of task.inputs) {
      if (input.fromTaskId && !taskIds.has(input.fromTaskId)) {
        issues.push(`Task "${task.id}" input "${input.key}" references missing task "${input.fromTaskId}".`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(plan.tasks.map((task) => [task.id, task]));
  const walk = (taskId: string) => {
    if (visited.has(taskId)) return;
    if (visiting.has(taskId)) {
      issues.push(`Detected dependency cycle involving task "${taskId}".`);
      return;
    }
    visiting.add(taskId);
    const task = byId.get(taskId);
    if (task) {
      for (const dependency of task.dependencies) {
        if (byId.has(dependency)) walk(dependency);
      }
    }
    visiting.delete(taskId);
    visited.add(taskId);
  };

  for (const task of plan.tasks) {
    walk(task.id);
  }

  return Array.from(new Set(issues));
}
