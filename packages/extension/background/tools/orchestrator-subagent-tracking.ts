import type { HistoricalSubagent, SessionState, SubagentResult } from '../service-types.js';
import type { ToolExecutionArgs } from './tool-executor-shared.js';

const updateSubagentHistory = (
  sessionState: SessionState,
  result: SubagentResult,
  status: HistoricalSubagent['status'],
) => {
  const existing = sessionState.subagentHistory.get(result.id);
  if (!existing) return;
  existing.status = status;
  existing.success = result.success;
  existing.summary = result.summary;
  existing.data = result.data;
  existing.finishedAt = Date.now();
};

export const listHistoricalSubagents = (sessionState: SessionState) =>
  Array.from(sessionState.subagentHistory.values())
    .filter((entry) => entry.status !== 'running')
    .sort((a, b) => a.startedAt - b.startedAt);

export const listRunningSubagents = (sessionState: SessionState): HistoricalSubagent[] =>
  Array.from(sessionState.runningSubagents.values()).map((entry) => ({
    id: entry.id,
    name: entry.name,
    tabId: entry.tabId,
    agentSessionId: entry.agentSessionId,
    colorIndex: entry.colorIndex,
    taskId: entry.taskId,
    status: 'running',
    startedAt: entry.startedAt,
  }));

export function recordSubagentStart(
  sessionState: SessionState,
  payload: {
    id: string;
    name: string;
    tabId: number;
    agentSessionId: string;
    colorIndex: number;
    taskId?: string;
    startedAt: number;
  },
) {
  sessionState.subagentHistory.set(payload.id, {
    id: payload.id,
    name: payload.name,
    tabId: payload.tabId,
    agentSessionId: payload.agentSessionId,
    colorIndex: payload.colorIndex,
    taskId: payload.taskId,
    status: 'running',
    startedAt: payload.startedAt,
  });
}

export const recordSubagentCompletion = (sessionState: SessionState, result: SubagentResult) =>
  updateSubagentHistory(sessionState, result, result.success ? 'completed' : 'failed');

export async function awaitSubagents(
  sessionState: SessionState,
  args: ToolExecutionArgs,
): Promise<
  | { success: true; agents: SubagentResult[]; note?: string }
  | { success: false; error: string; pendingAgents?: Array<{ id: string; name: string; tabId: number }> }
> {
  const running = sessionState.runningSubagents;
  if (running.size === 0) {
    return { success: true, agents: [], note: 'No running sub-agents to wait for.' };
  }

  const requestedIds = Array.isArray(args.agentIds)
    ? args.agentIds.map((id) => String(id || '').trim()).filter(Boolean)
    : typeof args.agentId === 'string' && args.agentId.trim()
      ? [args.agentId.trim()]
      : [];
  const timeoutSec = typeof args.timeout === 'number' && args.timeout > 0 ? args.timeout : 300;
  const timeoutMs = Math.min(timeoutSec * 1000, 300_000);

  const targets = requestedIds.length
    ? requestedIds.map((id) => running.get(id)).filter(Boolean)
    : Array.from(running.values());

  if (targets.length === 0) {
    return { success: false, error: 'None of the specified agent IDs are currently running.' };
  }

  const promises = targets.map((agent) => agent!.promise);
  const timer = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), timeoutMs));
  const raceResult = await Promise.race([Promise.all(promises), timer]);

  if (raceResult === 'timeout') {
    const pending = targets.map((a) => ({ id: a!.id, name: a!.name, tabId: a!.tabId }));
    return { success: false, error: 'Timed out waiting for agents.', pendingAgents: pending };
  }

  const results = raceResult as SubagentResult[];
  for (const result of results) {
    running.delete(result.id);
    updateSubagentHistory(sessionState, result, result.success ? 'completed' : 'failed');
  }
  return { success: true, agents: results };
}
