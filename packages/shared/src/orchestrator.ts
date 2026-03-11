/**
 * Orchestrator types and utilities for managing multi-step agent plans.
 *
 * This module re-exports from focused submodules:
 * - orchestrator-types: Core types and constants
 * - task-status-helpers: Status normalization and checking
 * - plan-builders: Plan and task construction
 * - validation-helpers: Plan validation and dependency checking
 */

// Re-export all types and constants from orchestrator-types
export {
  COMMON_TASK_STATUSES,
  ORCHESTRATOR_TASK_STATUSES,
  TASK_KIND_SET,
  type CommonTaskStatus,
  type OrchestratorTaskStatus,
  type OrchestratorTaskKind,
  type OrchestratorTaskBinding,
  type OrchestratorValidationRule,
  type OrchestratorTaskNode,
  type OrchestratorInterviewQuestion,
  type OrchestratorPlan,
  type WhiteboardEntry,
} from './orchestrator-types.js';

// Re-export status helpers
export {
  normalizeOrchestratorTaskStatus,
  isOrchestratorTaskTerminal,
} from './task-status-helpers.js';

// Re-export plan building functions
export {
  normalizeOrchestratorTasks,
  buildOrchestratorPlan,
} from './plan-builders.js';

// Re-export validation helpers
export {
  getReadyOrchestratorTaskIds,
  getDispatchableOrchestratorTaskIds,
  getOrchestratorPlanValidationIssues,
} from './validation-helpers.js';
