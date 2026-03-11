/**
 * History Manager Module
 * Manages history turn entries and tool event capping
 */

export const MAX_HISTORY_TURN_ENTRIES = 200;
export const MAX_TOOL_EVENTS_PER_TURN = 160;

/**
 * Removes oldest entries when history exceeds max size
 */
export const clampHistoryTurnMap = (self: { historyTurnMap?: Map<string, unknown> }): void => {
  if (!self?.historyTurnMap || self.historyTurnMap.size <= MAX_HISTORY_TURN_ENTRIES) return;
  const overflow = self.historyTurnMap.size - MAX_HISTORY_TURN_ENTRIES;
  const keys = self.historyTurnMap.keys();
  for (let i = 0; i < overflow; i += 1) {
    const key = keys.next().value;
    if (key === undefined) break;
    self.historyTurnMap.delete(key);
  }
};

/**
 * Caps tool events per turn to prevent memory bloat
 */
export const capTurnToolEvents = (turnEntry: { toolEvents?: unknown[] }): void => {
  if (!turnEntry || !Array.isArray(turnEntry.toolEvents)) return;
  if (turnEntry.toolEvents.length <= MAX_TOOL_EVENTS_PER_TURN) return;
  turnEntry.toolEvents.splice(0, turnEntry.toolEvents.length - MAX_TOOL_EVENTS_PER_TURN);
};
