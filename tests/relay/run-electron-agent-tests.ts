#!/usr/bin/env node
import { sleep } from '@parchi/shared';

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const getFreePort = async () =>
  await new Promise<number>((resolve, reject) => {
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

const rpc = async ({
  host,
  port,
  token,
  method,
  params,
}: {
  host: string;
  port: number;
  token: string;
  method: string;
  params?: unknown;
}) => {
  const id = crypto.randomUUID();
  const response = await fetch(`http://${host}:${port}/v1/rpc`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  const data = await response.json();
  return { status: response.status, data };
};

const waitForDaemon = async (host: string, port: number, token: string) => {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const result = await rpc({ host, port, token, method: 'relay.ping' });
      if (result.status === 200 && result.data?.result?.ok) return;
    } catch {
      // Retry — daemon may not be ready yet
    }
    await sleep(60);
  }
  throw new Error('relay daemon did not become ready');
};

const runProcess = async ({
  cmd,
  args,
  env,
}: {
  cmd: string;
  args: string[];
  env: Record<string, string | undefined>;
}) =>
  await new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...env,
      },
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => (stdout += String(chunk)));
    child.stderr?.on('data', (chunk) => (stderr += String(chunk)));
    child.once('error', reject);
    child.once('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const main = async () => {
  const host = '127.0.0.1';
  const port = await getFreePort();
  const token = `test_${crypto.randomBytes(12).toString('hex')}`;
  const agentId = `electron_test_${crypto.randomUUID()}`;

  const daemonPath = path.join(ROOT, 'dist-relay', 'relay-daemon.js');
  const electronAgentPath = path.join(ROOT, 'dist-electron-agent', 'electron-agent.js');
  const parchiPath = path.join(ROOT, 'dist-cli', 'parchi.js');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parchi-electron-agent-test-'));
  const mockCliPath = path.join(tempDir, 'mock-agent-browser.js');
  fs.writeFileSync(
    mockCliPath,
    [
      'const args = process.argv.slice(2);',
      'const payload = { ok: true, args, command: args.join(" ") };',
      'if (args.includes("snapshot")) payload.snapshot = true;',
      'if (args.includes("connect")) payload.connected = true;',
      'console.log(JSON.stringify(payload));',
    ].join('\n'),
    'utf8',
  );

  const daemon = spawn(process.execPath, [daemonPath, `--host=${host}`, `--port=${port}`, `--token=${token}`], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PARCHI_RELAY_HOST: host,
      PARCHI_RELAY_PORT: String(port),
      PARCHI_RELAY_TOKEN: token,
    },
  });

  let daemonStdErr = '';
  daemon.stderr?.on('data', (chunk) => (daemonStdErr += String(chunk)));

  try {
    await waitForDaemon(host, port, token);

    const electronAgent = spawn(process.execPath, [electronAgentPath], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PARCHI_RELAY_TOKEN: token,
        PARCHI_RELAY_URL: `http://${host}:${port}`,
        PARCHI_ELECTRON_AGENT_ID: agentId,
        PARCHI_ELECTRON_AGENT_BROWSER_COMMAND: JSON.stringify([process.execPath, mockCliPath]),
      },
    });

    let agentStdErr = '';
    electronAgent.stderr?.on('data', (chunk) => (agentStdErr += String(chunk)));

    try {
      const deadline = Date.now() + 5000;
      let connected = false;
      while (Date.now() < deadline) {
        const list = await rpc({ host, port, token, method: 'agents.list' });
        const agents = Array.isArray(list.data?.result) ? list.data.result : [];
        if (agents.some((agent: { agentId?: unknown }) => agent.agentId === agentId)) {
          connected = true;
          break;
        }
        await sleep(80);
      }
      assert(connected, `electron agent failed to register. stderr=${agentStdErr}`);

      const tools = await rpc({ host, port, token, method: 'tools.list', params: { agentId } });
      const toolNames = Array.isArray(tools.data?.result)
        ? tools.data.result.map((tool: { name?: unknown }) => String(tool.name || ''))
        : [];
      assert(
        toolNames.includes('electron.connect'),
        `expected electron.connect in tools.list, got ${toolNames.join(', ')}`,
      );

      const connectCall = await rpc({
        host,
        port,
        token,
        method: 'tool.call',
        params: {
          agentId,
          tool: 'electron.connect',
          args: { cdpEndpoint: '9222', sessionId: 'integration' },
        },
      });
      const connectData = connectCall.data?.result?.data;
      assert(connectCall.data?.result?.ok === true, `electron.connect failed: ${JSON.stringify(connectCall.data)}`);
      assert(
        Array.isArray(connectData?.args) && connectData.args.includes('connect'),
        `expected connect command in mock output: ${JSON.stringify(connectCall.data)}`,
      );

      const snapshotCall = await rpc({
        host,
        port,
        token,
        method: 'tool.call',
        params: {
          agentId,
          tool: 'electron.snapshot',
          args: { sessionId: 'integration', interactive: true },
        },
      });
      assert(snapshotCall.data?.result?.ok === true, `electron.snapshot failed: ${JSON.stringify(snapshotCall.data)}`);

      const directCli = await runProcess({
        cmd: process.execPath,
        args: [parchiPath, 'electron', 'run', 'snapshot', '-i', '--json'],
        env: {
          PARCHI_ELECTRON_AGENT_BROWSER_COMMAND: JSON.stringify([process.execPath, mockCliPath]),
        },
      });

      assert(directCli.code === 0, `direct CLI failed: ${directCli.stderr || directCli.stdout}`);
      assert(
        directCli.stdout.includes('snapshot') || directCli.stdout.includes('"snapshot"'),
        `expected snapshot output in direct CLI stdout: ${directCli.stdout}`,
      );

      console.log('✓ Electron agent integration tests passed');
    } finally {
      electronAgent.kill('SIGTERM');
      await sleep(80);
    }
  } finally {
    daemon.kill('SIGTERM');
    await sleep(80);
    fs.rmSync(tempDir, { recursive: true, force: true });
    if (daemonStdErr.trim()) {
      process.stderr.write(daemonStdErr);
    }
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error ?? 'error'));
  process.exit(1);
});
