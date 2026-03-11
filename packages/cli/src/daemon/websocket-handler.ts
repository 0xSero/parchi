import type { WebSocket } from 'ws';
import type { AgentConnection, AgentHello, RunRecord } from '../daemon-shared.js';

export interface WebSocketHandlerDeps {
  agents: Map<string, AgentConnection>;
  runs: Map<string, RunRecord>;
  defaultAgentId: string | null;
  setDefaultAgentId: (id: string | null) => void;
  getDefaultAgentOrThrow: (agentId?: string | null) => AgentConnection;
  callAgentRpc: (agent: AgentConnection, method: string, params: unknown) => Promise<unknown>;
}

export function handleWebSocketConnection(ws: WebSocket, deps: WebSocketHandlerDeps): void {
  let agentId: string | null = null;

  ws.on('message', (data) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(data));
    } catch {
      return;
    }

    agentId = handleParsedMessage(parsed, ws, deps, agentId) || agentId;
  });

  ws.on('close', () => {
    if (!agentId) return;
    const agent = deps.agents.get(agentId);
    if (!agent) return;
    if (agent.ws !== ws) return;
    deps.agents.delete(agentId);
    if (deps.defaultAgentId === agentId) deps.setDefaultAgentId(null);
    for (const p of agent.pending.values()) {
      clearTimeout(p.timeoutId);
      p.reject(new Error('Agent disconnected'));
    }
    agent.pending.clear();
  });
}

function handleParsedMessage(
  parsed: unknown,
  ws: WebSocket,
  deps: WebSocketHandlerDeps,
  agentId: string | null,
): string | null {
  const { isJsonRpcResponse, isJsonRpcNotification } = require('@parchi/shared');
  const now = () => Date.now();

  if (isJsonRpcResponse(parsed)) {
    const response = parsed as { id: string; error?: { message: string }; result?: unknown };
    if (!agentId) return null;
    const agent = deps.agents.get(agentId);
    if (!agent) return null;
    agent.lastSeenAt = now();
    const pending = agent.pending.get(response.id);
    if (!pending) return null;
    clearTimeout(pending.timeoutId);
    agent.pending.delete(response.id);
    if ('error' in response && response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
    return null;
  }

  if (isJsonRpcNotification(parsed)) {
    return handleNotification(parsed as { method: string; params?: unknown }, ws, deps, agentId);
  }
  return null;
}

function handleNotification(
  parsed: { method: string; params?: unknown },
  ws: WebSocket,
  deps: WebSocketHandlerDeps,
  agentId: string | null,
): string | null {
  const { asRecord } = require('../daemon-shared.js');
  const now = () => Date.now();

  if (parsed.method === 'agent.hello') {
    const hello = (parsed.params || {}) as AgentHello;
    if (!hello || typeof hello.agentId !== 'string' || !hello.agentId.trim()) return null;
    const newAgentId = hello.agentId;
    const existing = deps.agents.get(newAgentId);
    if (existing) {
      try {
        existing.ws.close();
      } catch {}
    }
    const conn: AgentConnection = {
      agentId: newAgentId,
      ws,
      hello,
      connectedAt: now(),
      lastSeenAt: now(),
      pending: new Map(),
    };
    deps.agents.set(newAgentId, conn);
    if (!deps.defaultAgentId) deps.setDefaultAgentId(newAgentId);
    return newAgentId;
  }

  if (parsed.method === 'run.event') {
    const params = asRecord(parsed.params) || {};
    const runId = typeof params.runId === 'string' ? params.runId : '';
    if (!runId) return null;
    const agent = agentId ? deps.agents.get(agentId) : null;
    const rec = ensureRun(runId, agent?.agentId || 'unknown', deps.runs);
    rec.updatedAt = now();
    rec.events.push(params.event);
    return null;
  }

  if (parsed.method === 'run.done') {
    const params = asRecord(parsed.params) || {};
    const runId = typeof params.runId === 'string' ? params.runId : '';
    if (!runId) return null;
    const agent = agentId ? deps.agents.get(agentId) : null;
    const rec = ensureRun(runId, agent?.agentId || 'unknown', deps.runs);
    rec.updatedAt = now();
    rec.done = {
      status: params.status === 'completed' || params.status === 'stopped' ? params.status : 'failed',
      final: params.final,
      error: params.error,
    };
    resolveRunWait(rec);
    return null;
  }
  return null;
}

function ensureRun(runId: string, agentId: string, runs: Map<string, RunRecord>): RunRecord {
  const existing = runs.get(runId);
  if (existing) return existing;
  const now = () => Date.now();
  const rec: RunRecord = {
    runId,
    agentId,
    createdAt: now(),
    updatedAt: now(),
    events: [],
    done: null,
    waiters: [],
  };
  runs.set(runId, rec);
  return rec;
}

function resolveRunWait(run: RunRecord): void {
  const waiters = run.waiters.slice();
  run.waiters.length = 0;
  waiters.forEach((fn) => fn(run));
}
