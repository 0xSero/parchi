import type { OrchestratorPlan, OrchestratorTaskNode } from '@parchi/shared';
import type { SessionState, SubagentResult } from '../service-types.js';

export const snapshotWhiteboard = (sessionState: SessionState) =>
  Object.fromEntries(
    Array.from(sessionState.orchestratorWhiteboard.entries()).map(([key, entry]) => [key, { ...entry }]),
  );

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
