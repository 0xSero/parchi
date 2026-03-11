import { runAgentBrowserCommand } from '../helpers/agent-browser.js';
import type { AgentBrowserCommandConfig, JsonRecord } from '../types.js';
import { asString } from './type-guards.js';

export const toSessionName = (raw: unknown): string => {
  const base = asString(raw) || 'default';
  const safe = base.replace(/[^a-zA-Z0-9_.:-]/g, '-').slice(0, 80);
  return `electron-${safe || 'default'}`;
};

export const buildGlobalArgs = (args: JsonRecord, json = true): string[] => {
  const out: string[] = [];
  out.push('--session', toSessionName(args.sessionId));

  const cdpEndpoint = asString(args.cdpEndpoint);
  if (cdpEndpoint) {
    out.push('--cdp', cdpEndpoint);
  }

  if (json) out.push('--json');
  return out;
};

export const normalizeCommandResult = (result: Awaited<ReturnType<typeof runAgentBrowserCommand>>) => ({
  ok: result.exitCode === 0 && !result.timedOut,
  command: result.command,
  exitCode: result.exitCode,
  signal: result.signal,
  timedOut: result.timedOut,
  stdout: result.stdout,
  stderr: result.stderr,
  data: result.parsedJson,
});

export const runAgentCommand = async (
  context: { agentBrowser: AgentBrowserCommandConfig },
  args: string[],
): Promise<ReturnType<typeof normalizeCommandResult>> => {
  const result = await runAgentBrowserCommand({
    commandPrefix: context.agentBrowser.commandPrefix,
    args,
    timeoutMs: context.agentBrowser.defaultTimeoutMs,
  });
  return normalizeCommandResult(result);
};
