// Re-exports from orchestrator submodules for backward compatibility
export {
  normalizeTaskStatus,
  clonePlan,
  syncReadyStatuses,
  buildPlanSummary,
  findTask,
} from './orchestrator-task-utils.js';

export {
  snapshotWhiteboard,
  writeTaskOutputsToWhiteboard,
  seedCompletedTaskOutputs,
  validateTaskAgainstWhiteboard,
} from './orchestrator-whiteboard.js';

export {
  listHistoricalSubagents,
  listRunningSubagents,
  recordSubagentStart,
  recordSubagentCompletion,
  awaitSubagents,
} from './orchestrator-subagent-tracking.js';
