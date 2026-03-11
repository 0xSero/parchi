import type { JsonRpcRequest } from '@parchi/shared';
import type { AgentConnection } from '../daemon-shared.js';

export async function callAgentRpc(
  agent: AgentConnection,
  method: string,
  params: unknown,
  timeoutMs = 120_000,
): Promise<unknown> {
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
