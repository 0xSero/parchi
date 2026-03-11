import { fetchRpc } from '../rpc-client.js';

const print = (value: unknown) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

export async function cmdRun(positional: string[], flags: Record<string, string>) {
  const prompt = positional.slice(1).join(' ').trim();
  if (!prompt) {
    console.error('Usage: parchi run <prompt>');
    process.exit(1);
  }

  const agentId = flags.agentId;
  const timeoutMs = Number(flags.timeoutMs || 600_000);
  const tabsRaw = flags.tabs || 'active';
  const selectedTabIds =
    tabsRaw === 'active'
      ? null
      : tabsRaw
          .split(',')
          .map((p) => Number(p.trim()))
          .filter((n) => Number.isFinite(n) && n > 0);

  const startParams: Record<string, unknown> = { prompt };
  if (selectedTabIds?.length) startParams.selectedTabIds = selectedTabIds;
  if (agentId) startParams.agentId = agentId;

  const started = (await fetchRpc({ method: 'agent.run', params: startParams })) as Record<string, unknown>;
  const runId = typeof started?.runId === 'string' ? started.runId : '';
  if (!runId) {
    print(started);
    return;
  }
  const waited = await fetchRpc({ method: 'run.wait', params: { runId, timeoutMs } });
  print(waited);
}
