import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { DEFAULT_PORT, isDaemonRunning, readAuth } from './auth.js';

type RpcRequest = {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
};

type RpcResponse = {
  result?: unknown;
  error?: {
    message?: string;
  } | null;
};

function waitForDaemon(port: number, timeoutMs = 5_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/healthz`);
        if (res.ok) return resolve();
      } catch (_healthErr) {
        // Daemon not ready yet; retry.
      }
      if (Date.now() - start > timeoutMs) return reject(new Error('Daemon failed to start within timeout'));
      setTimeout(attempt, 200);
    };
    attempt();
  });
}

function spawnDaemon(): void {
  const binPath = process.argv[1];
  const child = spawn(process.execPath, [binPath, 'daemon'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

async function ensureDaemon(port: number): Promise<void> {
  if (isDaemonRunning()) return;
  spawnDaemon();
  await waitForDaemon(port);
}

export async function fetchRpc({
  method,
  params,
}: {
  method: string;
  params?: unknown;
}): Promise<unknown> {
  const auth = readAuth();
  if (!auth) {
    console.error('No auth config found. Run `parchi init` first.');
    process.exit(1);
  }

  const port = auth.port || DEFAULT_PORT;
  const token = auth.token;

  // Auto-start daemon if needed
  await ensureDaemon(port);

  const id = crypto.randomUUID();
  const body: RpcRequest = { jsonrpc: '2.0', id, method, params };
  const res = await fetch(`http://127.0.0.1:${port}/v1/rpc`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as RpcResponse | null;
  if (!json || typeof json !== 'object') {
    console.error('Invalid RPC response');
    process.exit(1);
  }
  if (json.error) {
    const msg = json.error.message || 'RPC error';
    throw new Error(msg);
  }
  return json.result;
}
