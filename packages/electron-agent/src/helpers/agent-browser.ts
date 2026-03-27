import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import type { AgentBrowserRunResult } from '../types.js';

const require = createRequire(import.meta.url);

const maybeParseJson = (stdout: string): unknown | undefined => {
  const trimmed = stdout.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch (_parseErr) {
    // Not valid JSON; try line-by-line below.
  }
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    try {
      return JSON.parse(line);
    } catch (_lineParseErr) {
      // Not valid JSON; try previous line.
    }
  }
  return undefined;
};

const splitCommandString = (raw: string) => {
  const tokens = raw.match(/"([^"]*)"|'([^']*)'|\S+/g) || [];
  return tokens.map((token) => token.replace(/^['"]|['"]$/g, '')).filter(Boolean);
};

export const resolveAgentBrowserCommandPrefix = (rawOverride: string | undefined): string[] => {
  const override = String(rawOverride || '').trim();
  if (override) {
    if (override.startsWith('[')) {
      try {
        const parsed = JSON.parse(override);
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string' && item.trim())) {
          return parsed.map((item) => item.trim());
        }
      } catch (_parseErr) {
        // Not a valid JSON array override; fall through.
      }
    }
    const split = splitCommandString(override);
    if (split.length > 0) return split;
  }

  try {
    const binPath = require.resolve('agent-browser/bin/agent-browser.js');
    return [process.execPath, binPath];
  } catch {
    return ['npx', 'agent-browser'];
  }
};

export const runAgentBrowserCommand = async ({
  commandPrefix,
  args,
  timeoutMs,
}: {
  commandPrefix: string[];
  args: string[];
  timeoutMs: number;
}): Promise<AgentBrowserRunResult> => {
  if (!Array.isArray(commandPrefix) || commandPrefix.length === 0) {
    throw new Error('Invalid agent-browser command prefix');
  }

  const [command, ...prefixArgs] = commandPrefix;
  const fullArgs = [...prefixArgs, ...args];

  return await new Promise((resolve, reject) => {
    const child = spawn(command, fullArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk);
    });

    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk);
    });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.once('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    child.once('close', (exitCode, signal) => {
      clearTimeout(timeoutId);
      resolve({
        command: [command, ...fullArgs],
        exitCode,
        signal,
        timedOut,
        stdout,
        stderr,
        parsedJson: maybeParseJson(stdout),
      });
    });
  });
};
