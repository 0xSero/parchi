#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const electronAgentPath = path.join(rootDir, 'dist-electron-agent', 'electron-agent.js');

const stateDir = path.join(os.homedir(), '.parchi');
const relayStatePath = path.join(stateDir, 'relay-secure.json');
const pidPath = path.join(stateDir, 'electron-agent-secure.pid');
const logPath = path.join(stateDir, 'electron-agent-secure.log');

const parseArgs = (argv) => {
  const positional = [];
  const flags = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const [key, value] = arg.slice(2).split('=');
    flags[key] = value ?? 'true';
  }
  return { positional, flags };
};

const ensureStateDir = () => {
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(stateDir, 0o700);
  } catch {}
};

const writeFileSecure = (targetPath, content) => {
  fs.writeFileSync(targetPath, content, { mode: 0o600 });
  try {
    fs.chmodSync(targetPath, 0o600);
  } catch {}
};

const readJson = (targetPath) => {
  try {
    return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  } catch {
    return null;
  }
};

const readPid = () => {
  const raw = fs.existsSync(pidPath) ? fs.readFileSync(pidPath, 'utf8').trim() : '';
  const pid = Number(raw);
  return Number.isFinite(pid) && pid > 0 ? pid : null;
};

const isPidRunning = (pid) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const clearPid = () => {
  try {
    fs.unlinkSync(pidPath);
  } catch {}
};

const readRelayConfig = () => {
  const config = readJson(relayStatePath);
  if (!config || typeof config !== 'object') {
    throw new Error(`Missing relay config (${relayStatePath}). Run: npm run relay:secure -- start`);
  }

  const token = String(config.token || '').trim();
  const host = String(config.host || '127.0.0.1').trim();
  const port = Number(config.port || 17373);

  if (!token) {
    throw new Error(`Relay token missing in ${relayStatePath}. Run: npm run relay:secure -- rotate`);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Relay port invalid in ${relayStatePath}: ${config.port}`);
  }

  return {
    token,
    host,
    port,
    relayUrl: `http://${host}:${port}`,
  };
};

const fetchRpc = async ({ relayUrl, token, method, params }) => {
  const res = await fetch(`${relayUrl}/v1/rpc`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `electron-secure-${Date.now()}`,
      method,
      params,
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`RPC ${method} failed (${res.status}): ${JSON.stringify(payload)}`);
  }
  if (payload?.error?.message) {
    throw new Error(`RPC ${method} error: ${payload.error.message}`);
  }
  return payload?.result;
};

const waitForAgentConnection = async (relayConfig, timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const agents = await fetchRpc({
        relayUrl: relayConfig.relayUrl,
        token: relayConfig.token,
        method: 'agents.list',
      });

      if (Array.isArray(agents) && agents.some((agent) => String(agent?.name || '') === 'parchi-electron-agent')) {
        return true;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return false;
};

const cmdStatus = async () => {
  const pid = readPid();
  const running = isPidRunning(pid);
  if (pid && !running) clearPid();

  let relay = null;
  let agents = [];
  try {
    relay = readRelayConfig();
    const list = await fetchRpc({
      relayUrl: relay.relayUrl,
      token: relay.token,
      method: 'agents.list',
    });
    agents = Array.isArray(list) ? list.filter((a) => String(a?.name || '') === 'parchi-electron-agent') : [];
  } catch (error) {
    relay = { error: error instanceof Error ? error.message : String(error ?? '') };
  }

  console.log(
    JSON.stringify(
      {
        managed: true,
        pid: running ? pid : null,
        running,
        relay,
        agentCount: agents.length,
        agents,
        logPath,
        pidPath,
      },
      null,
      2,
    ),
  );
};

const cmdStart = async () => {
  if (!fs.existsSync(electronAgentPath)) {
    throw new Error(`Missing ${path.relative(rootDir, electronAgentPath)}. Run: npm run build`);
  }

  const pid = readPid();
  if (isPidRunning(pid)) {
    console.log(`Electron agent already running (pid ${pid})`);
    await cmdStatus();
    return;
  }

  clearPid();
  ensureStateDir();
  const relayConfig = readRelayConfig();

  const out = fs.openSync(logPath, 'a', 0o600);
  const child = spawn(process.execPath, [electronAgentPath], {
    detached: true,
    stdio: ['ignore', out, out],
    env: {
      ...process.env,
      PARCHI_RELAY_TOKEN: relayConfig.token,
      PARCHI_RELAY_URL: relayConfig.relayUrl,
    },
  });

  child.unref();
  writeFileSecure(pidPath, `${child.pid}\n`);

  await new Promise((resolve) => setTimeout(resolve, 450));
  if (!isPidRunning(child.pid)) {
    clearPid();
    throw new Error(`Electron agent process exited immediately. Check log: ${logPath}`);
  }

  const connected = await waitForAgentConnection(relayConfig, 5000);
  if (!connected) {
    console.warn('Electron agent process started, but relay did not report connection within 5s.');
  }

  console.log(`Electron agent started (pid ${child.pid})`);
  await cmdStatus();
};

const cmdStop = () => {
  const pid = readPid();
  if (!pid || !isPidRunning(pid)) {
    clearPid();
    console.log('Electron agent is not running.');
    return;
  }

  process.kill(pid, 'SIGTERM');
  clearPid();
  console.log(`Stopped electron agent pid ${pid}`);
};

const usage = () => {
  console.log(`electron-agent secure helper

Usage:
  node scripts/electron-agent-secure.mjs start
  node scripts/electron-agent-secure.mjs stop
  node scripts/electron-agent-secure.mjs status

This helper reads relay token/host/port from:
  ${relayStatePath}

and manages PID/log files at:
  ${pidPath}
  ${logPath}
`);
};

const main = async () => {
  const { positional } = parseArgs(process.argv.slice(2));
  const cmd = positional[0] || 'status';

  if (cmd === 'start') return await cmdStart();
  if (cmd === 'stop') return cmdStop();
  if (cmd === 'status') return await cmdStatus();

  usage();
  process.exit(1);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
