/**
 * Relay Protocol - Core protocol execution functions
 *
 * Consolidates relay protocol handling for tool execution and agent runs.
 * Used by both CLI commands and relay commands.
 */

import { fetchRpc } from './rpc-client.js';

export const printJson = (value: unknown) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

export function parseJsonFlag(raw: string | undefined, fallback: unknown, errorMsg?: string): unknown {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    const msg = errorMsg ?? `Invalid JSON: ${err instanceof Error ? err.message : String(err ?? '')}`;
    console.error(msg);
    process.exit(1);
  }
}

export type RelayToolParams = {
  tool: string;
  args: Record<string, unknown>;
  agentId?: string;
};

export async function executeRelayToolCall(params: RelayToolParams): Promise<unknown> {
  return await fetchRpc({
    method: 'tool.call',
    params: {
      tool: params.tool,
      args: params.args,
      ...(params.agentId ? { agentId: params.agentId } : {}),
    },
  });
}

export async function executeRelayToolsList(agentId?: string): Promise<unknown> {
  return await fetchRpc({
    method: 'tools.list',
    params: agentId ? { agentId } : undefined,
  });
}

export type RelayRunParams = {
  prompt: string;
  agentId?: string;
  timeoutMs: number;
  selectedTabIds: number[] | null;
};

export type RelayRunResult = {
  runId: string;
  done: {
    status: 'completed' | 'failed' | 'stopped';
    final?: unknown;
    error?: unknown;
  };
};

export async function executeRelayRun(params: RelayRunParams): Promise<RelayRunResult | null> {
  const startParams: Record<string, unknown> = { prompt: params.prompt };
  if (params.selectedTabIds?.length) startParams.selectedTabIds = params.selectedTabIds;
  if (params.agentId) startParams.agentId = params.agentId;

  const started = (await fetchRpc({
    method: 'agent.run',
    params: startParams,
  })) as { runId?: string };

  const runId = typeof started?.runId === 'string' ? started.runId : '';
  if (!runId) return null;

  const waited = (await fetchRpc({
    method: 'run.wait',
    params: { runId, timeoutMs: params.timeoutMs },
  })) as RelayRunResult | null;

  return waited;
}

export function parseTabSelection(tabsRaw: string | undefined): number[] | null {
  if (tabsRaw === 'active' || !tabsRaw) return null;
  return tabsRaw
    .split(',')
    .map((p) => Number(p.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}
