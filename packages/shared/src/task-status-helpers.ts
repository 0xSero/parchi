/**
 * Helper functions for working with orchestrator task statuses.
 */

import { ORCHESTRATOR_TASK_STATUSES, type OrchestratorTaskStatus } from './orchestrator-types.js';

const TASK_STATUS_SET = new Set<OrchestratorTaskStatus>(ORCHESTRATOR_TASK_STATUSES);

/**
 * Normalizes a value to a valid OrchestratorTaskStatus.
 * Returns 'pending' for invalid or unrecognized values.
 */
export function normalizeOrchestratorTaskStatus(value: unknown): OrchestratorTaskStatus {
  if (typeof value !== 'string') return 'pending';
  const normalized = value.trim().toLowerCase() as OrchestratorTaskStatus;
  return TASK_STATUS_SET.has(normalized) ? normalized : 'pending';
}

/**
 * Returns true if the task status is terminal (completed, failed, or cancelled).
 */
export function isOrchestratorTaskTerminal(status: OrchestratorTaskStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}
