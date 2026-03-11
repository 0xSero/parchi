/**
 * Core types and constants for the orchestrator system.
 * Defines task statuses, plan structures, and validation rules.
 */

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

export const TASK_KIND_SET = new Set<OrchestratorTaskKind>([
  'browser',
  'research',
  'synthesis',
  'validation',
  'handoff',
]);

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
