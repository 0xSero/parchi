import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { type JsonRpcResponse, isJsonRpcRequest } from '@parchi/shared';
import { asRecord, json, readBody } from './daemon-shared.js';

type HandleDaemonHttpRequestArgs = {
  req: IncomingMessage;
  res: ServerResponse;
  agentCount: number;
  token: string;
  isLoopbackRequest: (req: IncomingMessage) => boolean;
  isAuthorized: (req: IncomingMessage) => boolean;
  handleRpc: (method: string, params: unknown) => Promise<unknown>;
};

export async function handleDaemonHttpRequest({
  req,
  res,
  agentCount,
  token,
  isLoopbackRequest,
  isAuthorized,
  handleRpc,
}: HandleDaemonHttpRequestArgs) {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/healthz') {
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === '/v1/pair') {
    const payload: Record<string, unknown> = { ok: true, paired: agentCount > 0 };
    // Auto-pair is for localhost-only setup flows. Do not expose token to
    // non-loopback clients.
    if (isLoopbackRequest(req)) payload.token = token;
    json(res, 200, payload);
    return;
  }

  if (url.pathname !== '/v1/rpc' || req.method !== 'POST') {
    json(res, 404, { error: 'not_found' });
    return;
  }

  if (!isAuthorized(req)) {
    json(res, 401, { error: 'unauthorized' });
    return;
  }

  let body: unknown;
  try {
    body = await readBody(req);
  } catch (err) {
    json(res, 400, {
      error: 'invalid_json',
      message: err instanceof Error ? err.message : String(err ?? ''),
    });
    return;
  }

  const bodyRecord = asRecord(body);
  const id = bodyRecord?.id;
  const method = bodyRecord?.method;
  if (!isJsonRpcRequest(body)) {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: typeof id === 'string' || typeof id === 'number' ? id : 'invalid',
      error: { code: -32600, message: 'Invalid Request' },
    };
    json(res, 400, response);
    return;
  }

  try {
    const result = await handleRpc(typeof method === 'string' ? method : '', body.params);
    const response: JsonRpcResponse = { jsonrpc: '2.0', id: body.id, result };
    json(res, 200, response);
  } catch (err) {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: body.id,
      error: { code: -32000, message: err instanceof Error ? err.message : String(err ?? 'error') },
    };
    json(res, 200, response);
  }
}
