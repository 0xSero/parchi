import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PARCHI_DIR = path.join(os.homedir(), '.parchi');
export const AUTH_FILE = path.join(PARCHI_DIR, 'auth.json');
export const PID_FILE = path.join(PARCHI_DIR, 'daemon.pid');
export const DEFAULT_PORT = 19816;

export interface AuthConfig {
  token: string;
  port: number;
  createdAt: string;
  extensionId?: string;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function readAuth(): AuthConfig | null {
  try {
    const raw = fs.readFileSync(AUTH_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.token !== 'string') return null;
    return parsed as AuthConfig;
  } catch {
    return null;
  }
}

export function writeAuth(config: AuthConfig): void {
  fs.mkdirSync(PARCHI_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(AUTH_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function readPid(): number | null {
  try {
    const raw = fs.readFileSync(PID_FILE, 'utf8').trim();
    const pid = Number(raw);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

export function writePid(pid: number): void {
  fs.mkdirSync(PARCHI_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(PID_FILE, String(pid), { mode: 0o644 });
}

export function removePid(): void {
  try {
    fs.unlinkSync(PID_FILE);
  } catch (err) {
    // PID file may not exist or may be inaccessible; ignore.
    console.warn('[auth] Failed to remove PID file:', err);
  }
}

export function isDaemonRunning(): boolean {
  const pid = readPid();
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    // Process doesn't exist — stale PID file
    removePid();
    return false;
  }
}
