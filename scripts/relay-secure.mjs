#!/usr/bin/env node

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const daemonPath = path.join(rootDir, 'dist-relay', 'relay-daemon.js');
const stateDir = path.join(os.homedir(), '.parchi');
const statePath = path.join(stateDir, 'relay-secure.json');
const pidPath = path.join(stateDir, 'relay-secure.pid');
const logPath = path.join(stateDir, 'relay-secure.log');
const defaultHost = '127.0.0.1';
const defaultPort = 17373;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const randomToken = () => crypto.randomBytes(32).toString('hex');

const isLoopbackHost = (host) => ['127.0.0.1', 'localhost', '::1'].includes(String(host || '').toLowerCase());

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

const fetchJson = async (url) => {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    return { ok: res.ok, status: res.status, data: json };
  } catch (error) {
    return { ok: false, status: 0, data: null, error: error instanceof Error ? error.message : String(error) };
  }
};

const healthCheck = async (host, port) => {
  return await fetchJson(`http://${host}:${port}/healthz`);
};

const pairCheck = async (host, port) => {
  return await fetchJson(`http://${host}:${port}/v1/pair`);
};

const resolveConfig = (flags, { rotate = false } = {}) => {
  ensureStateDir();
  const existing = readJson(statePath) || {};
  const host = String(flags.host || existing.host || defaultHost).trim();
  const port = Number(flags.port || existing.port || defaultPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${flags.port ?? existing.port}`);
  }
  if (!isLoopbackHost(host) && flags.allowRemote !== 'true') {
    throw new Error(`Refusing non-loopback host (${host}). Pass --allowRemote=true if intentional.`);
  }
  const token = rotate ? randomToken() : String(existing.token || '').trim() || randomToken();
  const now = new Date().toISOString();
  const next = {
    token,
    host,
    port,
    createdAt: existing.createdAt || now,
    updatedAt: now,
  };
  writeFileSecure(statePath, `${JSON.stringify(next, null, 2)}\n`);
  return next;
};

const printEnv = (config) => {
  console.log(`export PARCHI_RELAY_TOKEN="${config.token}"`);
  console.log(`export PARCHI_RELAY_HOST="${config.host}"`);
  console.log(`export PARCHI_RELAY_PORT="${config.port}"`);
};

const cmdStatus = async () => {
  const config = readJson(statePath);
  const pid = readPid();
  const running = isPidRunning(pid);
  if (pid && !running) clearPid();
  const host = config?.host || defaultHost;
  const port = config?.port || defaultPort;
  const health = await healthCheck(host, port);
  const pair = await pairCheck(host, port);
  console.log(
    JSON.stringify(
      {
        managed: Boolean(config),
        pid: running ? pid : null,
        host,
        port,
        health,
        pair: pair.ok ? { ok: pair.data?.ok === true, paired: pair.data?.paired === true } : pair,
        logPath,
        statePath,
      },
      null,
      2,
    ),
  );
};

const cmdStart = async (flags) => {
  if (!fs.existsSync(daemonPath)) {
    throw new Error(`Missing ${path.relative(rootDir, daemonPath)}. Run: npm run build`);
  }
  const config = resolveConfig(flags);
  const pid = readPid();
  if (isPidRunning(pid)) {
    console.log(`Relay already running (pid ${pid})`);
    printEnv(config);
    return;
  }
  clearPid();
  ensureStateDir();
  const out = fs.openSync(logPath, 'a', 0o600);
  const child = spawn(
    process.execPath,
    [daemonPath, `--token=${config.token}`, `--host=${config.host}`, `--port=${config.port}`],
    {
    detached: true,
    stdio: ['ignore', out, out],
    env: {
      ...process.env,
      PARCHI_RELAY_TOKEN: config.token,
      PARCHI_RELAY_HOST: config.host,
      PARCHI_RELAY_PORT: String(config.port),
    },
  });
  child.unref();
  writeFileSecure(pidPath, `${child.pid}\n`);
  await sleep(500);
  const health = await healthCheck(config.host, config.port);
  if (!health.ok || health.data?.ok !== true) {
    clearPid();
    throw new Error(`Relay failed health check at http://${config.host}:${config.port}/healthz (see ${logPath})`);
  }
  console.log(`Relay started (pid ${child.pid})`);
  printEnv(config);
};

const cmdStop = () => {
  const pid = readPid();
  if (!pid || !isPidRunning(pid)) {
    clearPid();
    console.log('Relay is not running.');
    return;
  }
  process.kill(pid, 'SIGTERM');
  clearPid();
  console.log(`Stopped relay pid ${pid}`);
};

const cmdRotate = async (flags) => {
  const previousPid = readPid();
  const wasRunning = isPidRunning(previousPid);
  if (wasRunning) {
    process.kill(previousPid, 'SIGTERM');
    clearPid();
    await sleep(300);
  }
  const config = resolveConfig(flags, { rotate: true });
  console.log('Relay token rotated.');
  if (wasRunning) {
    await cmdStart(flags);
  } else {
    printEnv(config);
  }
};

const usage = () => {
  console.log(`relay-secure helper

Usage:
  node scripts/relay-secure.mjs start [--host=127.0.0.1] [--port=17373]
  node scripts/relay-secure.mjs stop
  node scripts/relay-secure.mjs status
  node scripts/relay-secure.mjs rotate [--host=127.0.0.1] [--port=17373]
  node scripts/relay-secure.mjs env

Security defaults:
  - Generates a random 32-byte token on first run.
  - Stores token in ${statePath} with 0600 permissions.
  - Refuses non-loopback hosts unless --allowRemote=true.
`);
};

const main = async () => {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const cmd = positional[0] || 'status';
  if (cmd === 'start') return await cmdStart(flags);
  if (cmd === 'stop') return cmdStop();
  if (cmd === 'status') return await cmdStatus();
  if (cmd === 'rotate') return await cmdRotate(flags);
  if (cmd === 'env') {
    const config = resolveConfig(flags);
    printEnv(config);
    return;
  }
  usage();
  process.exit(1);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
