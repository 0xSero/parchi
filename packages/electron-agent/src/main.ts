import { type JsonRpcNotification, type JsonRpcRequest, type JsonRpcResponse, isJsonRpcRequest } from '@parchi/shared';
import { WebSocket } from 'ws';
import { loadElectronAgentConfig } from './configs.js';
import type { RelayTransport } from './interfaces.js';
import { executeElectronTool, getElectronToolDefinitions } from './logic/tools.js';
import type { ElectronAgentConfig, JsonRecord } from './types.js';

class ElectronRelayAgent {
  private config: ElectronAgentConfig;
  private ws: WebSocket | null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null;
  private reconnectAttempt: number;
  private shuttingDown: boolean;

  constructor(config: ElectronAgentConfig) {
    this.config = config;
    this.ws = null;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.shuttingDown = false;
  }

  start() {
    this.connect();
    process.on('SIGINT', () => this.stop(0));
    process.on('SIGTERM', () => this.stop(0));
  }

  private stop(exitCode: number) {
    this.shuttingDown = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (closeErr) {
        console.warn('[main] Failed to close WebSocket on shutdown:', closeErr);
      }
      this.ws = null;
    }
    process.exit(exitCode);
  }

  private connect() {
    if (this.shuttingDown) return;
    const wsUrl = this.toWsUrl();
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.on('open', () => {
      this.reconnectAttempt = 0;
      console.log(`[electron-agent] connected (${this.config.agentId})`);
      this.sendHello();
    });

    ws.on('message', (event) => {
      void this.onMessage(event.toString());
    });

    ws.on('error', (error) => {
      console.error(`[electron-agent] websocket error: ${error instanceof Error ? error.message : String(error)}`);
    });

    ws.on('close', () => {
      if (this.ws === ws) this.ws = null;
      if (this.shuttingDown) return;
      this.scheduleReconnect();
    });
  }

  private toWsUrl() {
    const relay = new URL(this.config.relayUrl);
    relay.protocol = relay.protocol === 'https:' ? 'wss:' : 'ws:';
    relay.pathname = '/v1/extension';
    relay.searchParams.set('token', this.config.relayToken);
    return relay.toString();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.shuttingDown) return;
    this.reconnectAttempt += 1;
    const delay = Math.min(
      this.config.reconnectDelayMaxMs,
      this.config.reconnectDelayBaseMs * 2 ** Math.max(0, this.reconnectAttempt - 1),
    );
    console.log(`[electron-agent] reconnecting in ${delay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private send(payload: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }

  private sendHello() {
    const hello: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'agent.hello',
      params: {
        agentId: this.config.agentId,
        name: this.config.agentName,
        version: this.config.agentVersion,
        browser: 'electron-cdp',
        userAgent: 'parchi-electron-agent',
        capabilities: {
          tools: true,
          agentRun: false,
        },
      },
    };
    this.send(hello);
  }

  private async onMessage(raw: string) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    if (!isJsonRpcRequest(parsed)) return;

    try {
      const result = await this.handleRequest(parsed, { send: (payload) => this.send(payload) });
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: parsed.id,
        result,
      };
      this.send(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? 'error');
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: parsed.id,
        error: { code: -32000, message },
      };
      this.send(response);
    }
  }

  private async handleRequest(request: JsonRpcRequest, _transport: RelayTransport) {
    if (request.method === 'tools.list') {
      return getElectronToolDefinitions();
    }

    if (request.method === 'tool.call') {
      const params = asRecord(request.params);
      const tool = asString(params.tool);
      if (!tool) throw new Error('tool.call: missing tool');
      const args = asRecord(params.args);
      return await executeElectronTool({
        tool,
        args,
        context: {
          agentBrowser: this.config.agentBrowser,
        },
      });
    }

    throw new Error(`Unsupported method for electron agent: ${request.method}`);
  }
}

const asRecord = (value: unknown): JsonRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as JsonRecord;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

try {
  const config = loadElectronAgentConfig();
  const agent = new ElectronRelayAgent(config);
  agent.start();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error ?? 'Unknown error'));
  process.exit(1);
}
