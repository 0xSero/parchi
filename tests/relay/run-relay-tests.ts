#!/usr/bin/env node

/**
 * Relay Service Integration Tests
 *
 * These tests do not require a real browser extension. They:
 * - Start the relay daemon on a random localhost port
 * - Validate auth + JSON-RPC semantics
 * - Connect a fake "extension agent" via WebSocket and validate forwarding
 * - Validate run event storage + wait semantics
 */

import { spawn } from 'child_process';
import crypto from 'crypto';
import net from 'net';
import { WebSocket } from 'ws';

// Tests run from the repo root (npm scripts). In the built output under dist/,
// __dirname points at dist/tests/... which is not the repo root.
const ROOT = process.cwd();

const colors = {
  info: '\x1b[36m',
  success: '\x1b[32m',
  error: '\x1b[31m',
  warning: '\x1b[33m',
  reset: '\x1b[0m',
} as const;

function log(message: string, type: keyof typeof colors = 'info') {
  console.log(`${colors[type]}${message}${colors.reset}`);
}

class TestRunner {
  passed = 0;
  failed = 0;
  errors: Array<{ test: string; error: string }> = [];

  async test(description: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      this.passed += 1;
      log(`✓ ${description}`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? 'error');
      this.failed += 1;
      this.errors.push({ test: description, error: msg });
      log(`✗ ${description}: ${msg}`, 'error');
    }
  }
}

const getFreePort = async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === 'string') return reject(new Error('Could not acquire free port'));
        resolve(address.port);
      });
    });
  });
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const rpc = async ({
  host,
  port,
  token,
  method,
  params,
  includeAuth = true,
}: {
  host: string;
  port: number;
  token: string;
  method: string;
  params?: unknown;
  includeAuth?: boolean;
}) => {
  const id = crypto.randomUUID();
  const res = await fetch(`http://${host}:${port}/v1/rpc`, {
    method: 'POST',
    headers: {
      ...(includeAuth ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  const data = await res.json();
  return { status: res.status, data };
};

const waitForPing = async (host: string, port: number, token: string) => {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const res = await rpc({ host, port, token, method: 'relay.ping' });
      if (res.status === 200 && res.data?.result?.ok) return;
    } catch {
      // Retry — daemon may not be ready yet
    }
    await sleep(60);
  }
  throw new Error('Daemon did not become ready');
};

const main = async () => {
  log('╔════════════════════════════════════════╗', 'info');
  log('║        Relay Service - Test Suite      ║', 'info');
  log('╚════════════════════════════════════════╝', 'info');

  const runner = new TestRunner();
  const host = '127.0.0.1';
  const port = await getFreePort();
  const token = `test_${crypto.randomBytes(16).toString('hex')}`;

  const daemonPath = `${ROOT}/dist-relay/relay-daemon.js`;
  // Fail fast with a clear message if build output is missing.
  if (!daemonPath || !daemonPath.endsWith('.js')) {
    throw new Error('Invalid daemon path');
  }
  const child = spawn(process.execPath, [daemonPath, `--host=${host}`, `--port=${port}`, `--token=${token}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PARCHI_RELAY_HOST: host,
      PARCHI_RELAY_PORT: String(port),
      PARCHI_RELAY_TOKEN: token,
    },
  });

  let daemonStdout = '';
  let daemonStderr = '';
  child.stdout?.on('data', (d) => (daemonStdout += String(d)));
  child.stderr?.on('data', (d) => (daemonStderr += String(d)));

  try {
    await waitForPing(host, port, token);

    await runner.test('unauthorized requests return 401', async () => {
      const res = await rpc({ host, port, token, method: 'relay.ping', includeAuth: false });
      if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
    });

    await runner.test('pair endpoint returns loopback token for auto-pair', async () => {
      const res = await fetch(`http://${host}:${port}/v1/pair`);
      if (res.status !== 200) throw new Error(`expected 200, got ${res.status}`);
      const data = await res.json();
      if (data?.ok !== true) throw new Error(`expected ok=true, got ${JSON.stringify(data)}`);
      if (data?.token !== token) throw new Error('expected pair endpoint token to match daemon token');
    });

    await runner.test('ping works', async () => {
      const res = await rpc({ host, port, token, method: 'relay.ping' });
      if (!res.data?.result?.ok) throw new Error('expected ok=true');
    });

    await runner.test('agents.list empty before any agent connects', async () => {
      const res = await rpc({ host, port, token, method: 'agents.list' });
      if (!Array.isArray(res.data?.result)) throw new Error('expected array');
      if (res.data.result.length !== 0) throw new Error('expected empty list');
    });

    await runner.test('forwarded call fails when no default agent', async () => {
      const res = await rpc({ host, port, token, method: 'tools.list' });
      if (!res.data?.error?.message?.includes('No default agent')) {
        throw new Error(`expected No default agent error, got ${JSON.stringify(res.data)}`);
      }
    });

    // Connect a fake extension agent and respond to forwarded RPC.
    await runner.test('WS agent connects and forwarded calls resolve', async () => {
      const ws = new WebSocket(`ws://${host}:${port}/v1/extension?token=${token}`);
      const agentId = `agent_${crypto.randomUUID()}`;

      const pending = new Map<string | number, (result: unknown) => void>();
      const onMessage = (raw: unknown) => {
        const msg = JSON.parse(String(raw));
        if (msg && msg.jsonrpc === '2.0' && msg.id && (msg.result || msg.error)) {
          const fn = pending.get(msg.id);
          if (fn) {
            pending.delete(msg.id);
            fn(msg);
          }
        }
        if (msg && msg.jsonrpc === '2.0' && msg.id && msg.method) {
          // Respond to forwarded requests from daemon.
          const method = String(msg.method);
          if (method === 'tools.list') {
            ws.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: [{ name: 'navigate' }] }));
            return;
          }
          if (method === 'tool.call') {
            ws.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { ok: true } }));
            return;
          }
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: 'unknown' } }));
        }
      };

      await new Promise<void>((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('ws open timeout')), 3000);
        ws.on('open', () => {
          clearTimeout(to);
          resolve();
        });
        ws.on('error', reject);
      });

      ws.on('message', (d) => onMessage(String(d)));
      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'agent.hello',
          params: { agentId, name: 'fake-agent', version: '0.0.0', capabilities: { tools: true, agentRun: true } },
        }),
      );

      // Wait until daemon sees it.
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const res = await rpc({ host, port, token, method: 'agents.list' });
        const result = (res.data as { result?: unknown } | null | undefined)?.result;
        if (Array.isArray(result) && result.some((a) => (a as { agentId?: unknown } | null)?.agentId === agentId))
          break;
        await sleep(60);
      }

      const toolsRes = await rpc({ host, port, token, method: 'tools.list' });
      if (!Array.isArray(toolsRes.data?.result) || toolsRes.data.result[0]?.name !== 'navigate') {
        throw new Error(`unexpected tools.list result: ${JSON.stringify(toolsRes.data)}`);
      }

      const toolCallRes = await rpc({
        host,
        port,
        token,
        method: 'tool.call',
        params: { tool: 'navigate', args: { url: 'https://example.com' } },
      });
      if (!toolCallRes.data?.result?.ok) {
        throw new Error(`unexpected tool.call result: ${JSON.stringify(toolCallRes.data)}`);
      }

      ws.close();
      await sleep(50);
    });

    await runner.test('run events are stored and run.wait returns done', async () => {
      const ws = new WebSocket(`ws://${host}:${port}/v1/extension?token=${token}`);
      const agentId = `agent_${crypto.randomUUID()}`;
      const runId = `run_${crypto.randomUUID()}`;

      await new Promise<void>((resolve, reject) => {
        const to = setTimeout(() => reject(new Error('ws open timeout')), 3000);
        ws.on('open', () => {
          clearTimeout(to);
          resolve();
        });
        ws.on('error', reject);
      });

      ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'agent.hello', params: { agentId } }));
      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'run.event',
          params: { runId, event: { type: 'run_status', phase: 'executing' } },
        }),
      );
      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'run.done',
          params: { runId, status: 'completed', final: { type: 'assistant_final', content: 'ok' } },
        }),
      );

      const waited = await rpc({ host, port, token, method: 'run.wait', params: { runId, timeoutMs: 2000 } });
      if (waited.data?.result?.done?.status !== 'completed')
        throw new Error(`unexpected: ${JSON.stringify(waited.data)}`);

      const events = await rpc({ host, port, token, method: 'run.events', params: { runId } });
      if (!Array.isArray(events.data?.result?.events) || events.data.result.events.length < 1) {
        throw new Error(`unexpected: ${JSON.stringify(events.data)}`);
      }

      ws.close();
    });
  } finally {
    try {
      child.kill('SIGTERM');
    } catch (err) {
      // Process may have already exited
      console.warn('Failed to kill relay daemon:', err);
    }
  }

  log('\n=== Relay Test Summary ===', 'info');
  log(`Tests Passed: ${runner.passed}`, 'success');
  if (runner.failed) {
    log(`Tests Failed: ${runner.failed}`, 'error');
    runner.errors.forEach((e) => {
      log(`  ${e.test}: ${e.error}`, 'error');
    });
    log('\nDaemon output (debug):', 'warning');
    if (daemonStdout.trim()) console.log(daemonStdout.trim());
    if (daemonStderr.trim()) console.error(daemonStderr.trim());
    process.exit(1);
  }

  log('✓ All relay tests passed!', 'success');
};

await main();
