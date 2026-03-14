// Re-exports from orchestrator submodules for backward compatibility
export {
  normalizeTaskStatus,
  clonePlan,
  syncReadyStatuses,
  buildPlanSummary,
  findTask,
} from './task-utils.js';

export {
  snapshotWhiteboard,
  writeTaskOutputsToWhiteboard,
  seedCompletedTaskOutputs,
  validateTaskAgainstWhiteboard,
} from './whiteboard.js';

export {
  listHistoricalSubagents,
  listRunningSubagents,
  recordSubagentStart,
  recordSubagentCompletion,
  awaitSubagents,
} from './subagent-tracking.js';
