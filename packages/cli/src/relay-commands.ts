/**
 * Relay Commands - Relay service CLI commands using shared protocol
 */
import {
  executeRelayRun,
  executeRelayToolCall,
  executeRelayToolsList,
  parseJsonFlag,
  parseTabSelection,
  printJson,
} from './relay-protocol.js';
import { fetchRpc } from './rpc-client.js';

const die = (msg: string) => {
  console.error(msg);
  process.exit(1);
};

export async function cmdRelayRpc(positional: string[], flags: Record<string, string>) {
  const method = positional[1];
  if (!method) die('relay rpc: missing method');
  const params = parseJsonFlag(flags.params, undefined);
  const result = await fetchRpc({ method, params });
  printJson(result);
}

export async function cmdRelayDoctor(flags: Record<string, string>) {
  const agentId = flags.agentId;
  const skipTool = flags.skipTool === 'true';

  const report: { ok: boolean; checks: Record<string, unknown> } = {
    ok: true,
    checks: {},
  };

  const fail = (name: string, err: unknown) => {
    report.ok = false;
    report.checks[name] = {
      ok: false,
      error: err instanceof Error ? err.message : String(err ?? 'error'),
    };
  };

  try {
    const ping = await fetchRpc({ method: 'relay.ping' });
    report.checks.ping = { ok: true, result: ping };
  } catch (err) {
    fail('ping', err);
    printJson(report);
    process.exit(2);
  }

  let agents: unknown[] = [];
  try {
    agents = (await fetchRpc({ method: 'agents.list' })) as unknown[];
    report.checks.agents = { ok: true, count: Array.isArray(agents) ? agents.length : 0, agents };
  } catch (err) {
    fail('agents', err);
  }

  let resolvedAgentId: string | null = agentId || null;
  if (!resolvedAgentId) {
    try {
      const def = (await fetchRpc({ method: 'agents.default.get' })) as { agentId?: string };
      resolvedAgentId = typeof def?.agentId === 'string' ? def.agentId : null;
      report.checks.defaultAgent = { ok: true, agentId: resolvedAgentId };
    } catch (err) {
      fail('defaultAgent', err);
    }
  } else {
    report.checks.defaultAgent = { ok: true, agentId: resolvedAgentId, source: 'flag' };
  }

  const connected = Array.isArray(agents)
    ? agents.some((a) => (a as { agentId?: string })?.agentId === resolvedAgentId)
    : false;
  if (resolvedAgentId && !connected) {
    report.ok = false;
    report.checks.agentConnected = {
      ok: false,
      agentId: resolvedAgentId,
      hint: 'AgentId not in agents.list. Ensure the extension is loaded from dist/ and Relay is enabled/applied.',
    };
  } else {
    report.checks.agentConnected = { ok: true, agentId: resolvedAgentId };
  }

  try {
    const params = resolvedAgentId ? { agentId: resolvedAgentId } : undefined;
    const tools = await fetchRpc({ method: 'tools.list', params });
    report.checks.tools = { ok: true, toolCount: Array.isArray(tools) ? tools.length : null, tools };
  } catch (err) {
    fail('tools', err);
  }

  if (!skipTool) {
    try {
      const result = await executeRelayToolCall({
        tool: 'getTabs',
        args: {},
        agentId: resolvedAgentId ?? undefined,
      });
      report.checks.forwarding = { ok: true, tool: 'getTabs', result };
    } catch (err) {
      fail('forwarding', err);
    }
  } else {
    report.checks.forwarding = { ok: true, skipped: true };
  }

  printJson(report);
  if (!report.ok) process.exit(2);
}

export async function cmdRelayAgents() {
  const result = await fetchRpc({ method: 'agents.list' });
  printJson(result);
}

export async function cmdRelayDefaultAgent(positional: string[]) {
  const action = positional[1] || '';
  if (action === 'get') {
    printJson(await fetchRpc({ method: 'agents.default.get' }));
    return;
  }
  if (action === 'set') {
    const agentId = positional[2];
    if (!agentId) die('relay default-agent set: missing agentId');
    printJson(await fetchRpc({ method: 'agents.default.set', params: { agentId } }));
    return;
  }
  die('relay default-agent: expected get|set');
}

export async function cmdRelayTools(flags: Record<string, string>) {
  const result = await executeRelayToolsList(flags.agentId);
  printJson(result);
}

export async function cmdRelayTool(positional: string[], flags: Record<string, string>) {
  const tool = positional[1];
  if (!tool) die('relay tool: missing toolName');
  const args = parseJsonFlag(flags.args, {}) as Record<string, unknown>;
  const result = await executeRelayToolCall({
    tool,
    args,
    agentId: flags.agentId,
  });
  printJson(result);
}

export async function cmdRelayRun(positional: string[], flags: Record<string, string>) {
  const prompt = positional.slice(1).join(' ').trim();
  if (!prompt) die('relay run: missing prompt');

  const selectedTabIds = parseTabSelection(flags.tabs);
  const timeoutMs = Number(flags.timeoutMs || 600_000);

  const result = await executeRelayRun({
    prompt,
    agentId: flags.agentId,
    timeoutMs,
    selectedTabIds,
  });

  if (!result) {
    printJson({ error: 'Failed to start run - no runId returned' });
    return;
  }
  printJson(result);
}
