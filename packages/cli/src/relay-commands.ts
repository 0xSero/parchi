import { fetchRpc } from './rpc-client.js';

const print = (value: unknown) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

const die = (msg: string) => {
  console.error(msg);
  process.exit(1);
};

const readJsonFlag = (raw: string | undefined, fallback: unknown) => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    die(`Invalid JSON: ${err instanceof Error ? err.message : String(err ?? '')}`);
  }
};

export async function cmdRelayRpc(positional: string[], flags: Record<string, string>) {
  const method = positional[1];
  if (!method) die('relay rpc: missing method');
  const params = readJsonFlag(flags.params, undefined);
  const result = await fetchRpc({ method, params });
  print(result);
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
    print(report);
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
      const params = resolvedAgentId
        ? { agentId: resolvedAgentId, tool: 'getTabs', args: {} }
        : { tool: 'getTabs', args: {} };
      const result = await fetchRpc({ method: 'tool.call', params });
      report.checks.forwarding = { ok: true, tool: 'getTabs', result };
    } catch (err) {
      fail('forwarding', err);
    }
  } else {
    report.checks.forwarding = { ok: true, skipped: true };
  }

  print(report);
  if (!report.ok) process.exit(2);
}

export async function cmdRelayAgents() {
  const result = await fetchRpc({ method: 'agents.list' });
  print(result);
}

export async function cmdRelayDefaultAgent(positional: string[]) {
  const action = positional[1] || '';
  if (action === 'get') {
    print(await fetchRpc({ method: 'agents.default.get' }));
    return;
  }
  if (action === 'set') {
    const agentId = positional[2];
    if (!agentId) die('relay default-agent set: missing agentId');
    print(await fetchRpc({ method: 'agents.default.set', params: { agentId } }));
    return;
  }
  die('relay default-agent: expected get|set');
}

export async function cmdRelayTools(flags: Record<string, string>) {
  const agentId = flags.agentId;
  const params = agentId ? { agentId } : undefined;
  const result = await fetchRpc({ method: 'tools.list', params });
  print(result);
}

export async function cmdRelayTool(positional: string[], flags: Record<string, string>) {
  const tool = positional[1];
  if (!tool) die('relay tool: missing toolName');
  const args = readJsonFlag(flags.args, {});
  const agentId = flags.agentId;
  const params = agentId ? { agentId, tool, args } : { tool, args };
  const result = await fetchRpc({ method: 'tool.call', params });
  print(result);
}

export async function cmdRelayRun(positional: string[], flags: Record<string, string>) {
  const prompt = positional.slice(1).join(' ').trim();
  if (!prompt) die('relay run: missing prompt');

  const agentId = flags.agentId;
  const tabsRaw = flags.tabs || 'active';
  const timeoutMs = Number(flags.timeoutMs || 600_000);
  const selectedTabIds =
    tabsRaw === 'active'
      ? null
      : tabsRaw
          .split(',')
          .map((p) => Number(p.trim()))
          .filter((n) => Number.isFinite(n) && n > 0);

  const startParams: Record<string, unknown> = { prompt };
  if (selectedTabIds && selectedTabIds.length) startParams.selectedTabIds = selectedTabIds;
  if (agentId) startParams.agentId = agentId;

  const started = (await fetchRpc({ method: 'agent.run', params: startParams })) as { runId?: string };
  const runId = typeof started?.runId === 'string' ? started.runId : '';
  if (!runId) {
    print(started);
    return;
  }
  const waited = await fetchRpc({ method: 'run.wait', params: { runId, timeoutMs } });
  print(waited);
}
