import crypto from 'node:crypto';
import http, { type IncomingMessage } from 'node:http';
import { type JsonRpcRequest, isJsonRpcNotification, isJsonRpcResponse } from '@parchi/shared';
import { type WebSocket, WebSocketServer } from 'ws';
import { removePid, writePid } from './auth.js';
import { handleDaemonHttpRequest } from './daemon-http.js';
import { handleDaemonRpc } from './daemon-rpc.js';
import { type AgentConnection, type AgentHello, type RunRecord, asRecord, now } from './daemon-shared.js';

export class ParchiDaemon {
  private token: string;
  private host: string;
  private port: number;
  private server: http.Server;
  private wss: WebSocketServer;
  private agents: Map<string, AgentConnection>;
  private defaultAgentId: string | null;
  private runs: Map<string, RunRecord>;

  constructor({ token, host, port }: { token: string; host: string; port: number }) {
    this.token = token;
    this.host = host;
    this.port = port;
    this.agents = new Map();
    this.defaultAgentId = null;
    this.runs = new Map();

    this.server = http.createServer((req, res) => void this.handleHttp(req, res));
    this.wss = new WebSocketServer({ noServer: true });

    this.server.on('upgrade', (req, socket, head) => {
      try {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        if (url.pathname !== '/v1/extension') {
          socket.destroy();
          return;
        }
        const token = url.searchParams.get('token') || '';
        if (!this.safeTokenEqual(token, this.token)) {
          socket.destroy();
          return;
        }
        this.wss.handleUpgrade(req, socket, head, (ws) => this.onExtensionWs(ws));
      } catch {
        socket.destroy();
      }
    });
  }

  private safeTokenEqual(a: string, b: string) {
    const aa = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (aa.length !== bb.length) return false;
    return crypto.timingSafeEqual(aa, bb);
  }

  private isLoopbackRequest(req: IncomingMessage) {
    const remote = String(req.socket.remoteAddress || '').toLowerCase();
    return remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  }

  private isAuthorized(req: IncomingMessage) {
    const auth = String(req.headers.authorization || '').trim();
    if (!auth.toLowerCase().startsWith('bearer ')) return false;
    const token = auth.slice('bearer '.length).trim();
    return this.safeTokenEqual(token, this.token);
  }

  private getDefaultAgentOrThrow(agentId?: string | null) {
    const resolved = agentId || this.defaultAgentId;
    if (!resolved) throw new Error('No default agent is set (and no agentId was provided).');
    const agent = this.agents.get(resolved);
    if (!agent) throw new Error(`Agent not connected: ${resolved}`);
    return agent;
  }

  private ensureRun(runId: string, agentId: string) {
    const existing = this.runs.get(runId);
    if (existing) return existing;
    const rec: RunRecord = {
      runId,
      agentId,
      createdAt: now(),
      updatedAt: now(),
      events: [],
      done: null,
      waiters: [],
    };
    this.runs.set(runId, rec);
    return rec;
  }

  private resolveRunWait(run: RunRecord) {
    const waiters = run.waiters.slice();
    run.waiters.length = 0;
    waiters.forEach((fn) => fn(run));
  }

  private onExtensionWs(ws: WebSocket) {
    let agentId: string | null = null;

    ws.on('message', (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(data));
      } catch {
        return;
      }

      if (isJsonRpcResponse(parsed)) {
        if (!agentId) return;
        const agent = this.agents.get(agentId);
        if (!agent) return;
        agent.lastSeenAt = now();
        const pending = agent.pending.get(parsed.id);
        if (!pending) return;
        clearTimeout(pending.timeoutId);
        agent.pending.delete(parsed.id);
        if ('error' in parsed) {
          pending.reject(new Error(parsed.error.message));
        } else {
          pending.resolve(parsed.result);
        }
        return;
      }

      if (isJsonRpcNotification(parsed)) {
        if (parsed.method === 'agent.hello') {
          const hello = (parsed.params || {}) as AgentHello;
          if (!hello || typeof hello.agentId !== 'string' || !hello.agentId.trim()) return;
          agentId = hello.agentId;
          const existing = this.agents.get(agentId);
          if (existing) {
            try {
              existing.ws.close();
            } catch {}
          }
          const conn: AgentConnection = {
            agentId,
            ws,
            hello,
            connectedAt: now(),
            lastSeenAt: now(),
            pending: new Map(),
          };
          this.agents.set(agentId, conn);
          if (!this.defaultAgentId) this.defaultAgentId = agentId;
          return;
        }

        if (parsed.method === 'run.event') {
          const params = asRecord(parsed.params) || {};
          const runId = typeof params.runId === 'string' ? params.runId : '';
          if (!runId) return;
          const agent = agentId ? this.agents.get(agentId) : null;
          const rec = this.ensureRun(runId, agent?.agentId || 'unknown');
          rec.updatedAt = now();
          rec.events.push(params.event);
          return;
        }

        if (parsed.method === 'run.done') {
          const params = asRecord(parsed.params) || {};
          const runId = typeof params.runId === 'string' ? params.runId : '';
          if (!runId) return;
          const agent = agentId ? this.agents.get(agentId) : null;
          const rec = this.ensureRun(runId, agent?.agentId || 'unknown');
          rec.updatedAt = now();
          rec.done = {
            status: params.status === 'completed' || params.status === 'stopped' ? params.status : 'failed',
            final: params.final,
            error: params.error,
          };
          this.resolveRunWait(rec);
          return;
        }
      }
    });

    ws.on('close', () => {
      if (!agentId) return;
      const agent = this.agents.get(agentId);
      if (!agent) return;
      if (agent.ws !== ws) return;
      this.agents.delete(agentId);
      if (this.defaultAgentId === agentId) this.defaultAgentId = null;
      for (const p of agent.pending.values()) {
        clearTimeout(p.timeoutId);
        p.reject(new Error('Agent disconnected'));
      }
      agent.pending.clear();
    });
  }

  private async callAgentRpc(agent: AgentConnection, method: string, params: unknown, timeoutMs = 120_000) {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const req: JsonRpcRequest = { jsonrpc: '2.0', id, method, params };

    const result = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        agent.pending.delete(id);
        reject(new Error(`Timed out waiting for agent response (${method})`));
      }, timeoutMs);

      agent.pending.set(id, { resolve, reject, timeoutId });

      try {
        agent.ws.send(JSON.stringify(req));
      } catch (err) {
        clearTimeout(timeoutId);
        agent.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err ?? 'send failed')));
      }
    });

    return result;
  }

  private async handleRpc(method: string, params: unknown) {
    return await handleDaemonRpc(
      {
        agents: this.agents,
        runs: this.runs,
        getDefaultAgentId: () => this.defaultAgentId,
        setDefaultAgentId: (agentId) => {
          this.defaultAgentId = agentId;
        },
        getDefaultAgentOrThrow: (agentId) => this.getDefaultAgentOrThrow(agentId),
        callAgentRpc: (agent, methodName, rpcParams) => this.callAgentRpc(agent, methodName, rpcParams),
      },
      method,
      params,
    );
  }

  private async handleHttp(req: IncomingMessage, res: http.ServerResponse) {
    await handleDaemonHttpRequest({
      req,
      res,
      agentCount: this.agents.size,
      token: this.token,
      isLoopbackRequest: (request) => this.isLoopbackRequest(request),
      isAuthorized: (request) => this.isAuthorized(request),
      handleRpc: (method, params) => this.handleRpc(method, params),
    });
  }

  async start() {
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.port, this.host, () => {
        this.server.removeListener('error', reject);
        resolve();
      });
    });
    writePid(process.pid);
    process.on('SIGINT', () => {
      removePid();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      removePid();
      process.exit(0);
    });
    console.log(`[parchi] daemon listening on http://${this.host}:${this.port}`);
    console.log(`[parchi] ws extension endpoint ws://${this.host}:${this.port}/v1/extension?token=...`);
  }
}
