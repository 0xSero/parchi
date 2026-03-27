import { type JsonRpcNotification, type JsonRpcRequest, type JsonRpcResponse, isJsonRpcRequest } from '@parchi/shared';

export type { JsonRpcRequest, JsonRpcResponse, JsonRpcNotification };

export class RelayBridge {
  private ws: WebSocket | null;
  private enabled: boolean;
  private url: string;
  private token: string;
  private reconnectTimerId: number | null;
  private reconnectAttempt: number;
  private getHelloPayload: () => Promise<Record<string, unknown>>;
  private onRequest: (req: JsonRpcRequest) => Promise<unknown>;
  private onStatus: (status: { connected: boolean; lastError?: string | null }) => void;

  constructor({
    getHelloPayload,
    onRequest,
    onStatus,
  }: {
    getHelloPayload: () => Promise<Record<string, unknown>>;
    onRequest: (req: JsonRpcRequest) => Promise<unknown>;
    onStatus?: (status: { connected: boolean; lastError?: string | null }) => void;
  }) {
    this.ws = null;
    this.enabled = false;
    this.url = '';
    this.token = '';
    this.reconnectTimerId = null;
    this.reconnectAttempt = 0;
    this.getHelloPayload = getHelloPayload;
    this.onRequest = onRequest;
    this.onStatus = onStatus || (() => {});
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  configure({ enabled, url, token }: { enabled: boolean; url: string; token: string }) {
    this.enabled = enabled;
    this.url = url;
    this.token = token;
    if (!enabled) {
      this.disconnect();
      this.onStatus({ connected: false, lastError: null });
      return;
    }
    if (!url || !token) {
      this.disconnect();
      this.onStatus({ connected: false, lastError: null });
      return;
    }
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.connect();
  }

  disconnect() {
    if (this.reconnectTimerId) {
      clearTimeout(this.reconnectTimerId);
      this.reconnectTimerId = null;
    }
    this.reconnectAttempt = 0;
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        console.warn('[relay] failed to close WebSocket during disconnect:', e);
      }
    }
    this.ws = null;
  }

  private toWsUrl(baseUrl: string, token: string) {
    try {
      const url = new URL(baseUrl);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.pathname = '/v1/extension';
      url.searchParams.set('token', token);
      return url.toString();
    } catch {
      return null;
    }
  }

  private scheduleReconnect() {
    if (!this.enabled) return;
    if (this.reconnectTimerId) return;
    const attempt = Math.min(10, this.reconnectAttempt + 1);
    this.reconnectAttempt = attempt;
    const delay = Math.min(15_000, 250 * 2 ** (attempt - 1));
    this.reconnectTimerId = window.setTimeout(() => {
      this.reconnectTimerId = null;
      this.connect();
    }, delay);
  }

  private connect() {
    if (!this.enabled || !this.url || !this.token) return;
    const wsUrl = this.toWsUrl(this.url, this.token);
    if (!wsUrl) {
      console.warn('[relay] invalid relayUrl:', this.url);
      this.onStatus({ connected: false, lastError: 'Invalid relay URL' });
      return;
    }
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.warn('[relay] failed to create WebSocket:', err);
      this.onStatus({ connected: false, lastError: 'Failed to create WebSocket' });
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = async () => {
      this.reconnectAttempt = 0;
      this.onStatus({ connected: true, lastError: null });
      try {
        const helloParams = await this.getHelloPayload();
        const hello: JsonRpcNotification = { jsonrpc: '2.0', method: 'agent.hello', params: helloParams };
        ws.send(JSON.stringify(hello));
      } catch (err) {
        console.warn('[relay] failed to send hello:', err);
      }
    };

    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.onStatus({ connected: false, lastError: null });
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will schedule reconnect.
      this.onStatus({ connected: false, lastError: 'WebSocket error' });
    };

    ws.onmessage = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(event.data ?? ''));
      } catch {
        return;
      }
      if (!isJsonRpcRequest(parsed)) return;
      void this.handleRequest(ws, parsed).catch((err) => {
        console.warn('[relay-bridge] Request handling failed:', err);
      });
    };
  }

  private async handleRequest(ws: WebSocket, req: JsonRpcRequest) {
    try {
      const result = await this.onRequest(req);
      const resp: JsonRpcResponse = { jsonrpc: '2.0', id: req.id, result };
      ws.send(JSON.stringify(resp));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err ?? 'error');
      const resp: JsonRpcResponse = { jsonrpc: '2.0', id: req.id, error: { code: -32000, message } };
      try {
        ws.send(JSON.stringify(resp));
      } catch (sendErr) {
        console.warn('[relay] failed to send error response:', sendErr);
      }
    }
  }

  notify(method: string, params: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const msg: JsonRpcNotification = { jsonrpc: '2.0', method, params };
    try {
      this.ws.send(JSON.stringify(msg));
    } catch (notifyErr) {
      console.warn('[relay] failed to send notification:', notifyErr);
    }
  }
}
