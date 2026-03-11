import crypto from 'node:crypto';
import http, { type IncomingMessage } from 'node:http';
import { WebSocketServer } from 'ws';
import { removePid, writePid } from './auth.js';
import { handleDaemonHttpRequest } from './daemon-http.js';
import { handleDaemonRpc } from './daemon-rpc.js';
import type { AgentConnection, RunRecord } from './daemon-shared.js';
import { callAgentRpc } from './daemon/rpc-caller.js';
import { handleWebSocketConnection } from './daemon/websocket-handler.js';

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

  private onExtensionWs(ws: import('ws').WebSocket) {
    handleWebSocketConnection(ws, {
      agents: this.agents,
      runs: this.runs,
      defaultAgentId: this.defaultAgentId,
      setDefaultAgentId: (id) => {
        this.defaultAgentId = id;
      },
      getDefaultAgentOrThrow: (agentId) => this.getDefaultAgentOrThrow(agentId),
      callAgentRpc: (agent, method, params) => callAgentRpc(agent, method, params),
    });
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
        callAgentRpc: (agent, methodName, rpcParams) => callAgentRpc(agent, methodName, rpcParams),
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
