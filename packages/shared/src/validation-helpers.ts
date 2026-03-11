/**
 * Functions for validating orchestrator plans and computing task readiness.
 */

import type { OrchestratorPlan } from './orchestrator-types.js';

/**
 * Returns task IDs that are ready to run (pending/ready status with all dependencies completed).
 */
export function getReadyOrchestratorTaskIds(plan: OrchestratorPlan): string[] {
  const completed = new Set(plan.tasks.filter((task) => task.status === 'completed').map((task) => task.id));
  return plan.tasks
    .filter((task) => task.status === 'pending' || task.status === 'ready')
    .filter((task) => task.dependencies.every((dependency) => completed.has(dependency)))
    .map((task) => task.id);
}

/**
 * Returns task IDs that can be dispatched given current running tasks and slot constraints.
 */
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

/**
 * Validates an orchestrator plan and returns a list of issues found.
 * Checks for missing dependencies and dependency cycles.
 */
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
