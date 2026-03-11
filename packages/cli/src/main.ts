import { DEFAULT_PORT, generateToken, isDaemonRunning, readAuth, readPid, removePid, writeAuth } from './auth.js';
import { startDaemon } from './daemon-args.js';
import { cmdElectron } from './electron.js';
import { isNativeMessagingMode, parseArgs, runInitFlow } from './main-helpers.js';
import { handleNativeMessaging } from './native-host.js';
import {
  cmdRelayAgents,
  cmdRelayDefaultAgent,
  cmdRelayDoctor,
  cmdRelayRpc,
  cmdRelayRun,
  cmdRelayTool,
  cmdRelayTools,
} from './relay-commands.js';
import { fetchRpc } from './rpc-client.js';

// ── Printing ────────────────────────────────────────────────────────────────
const print = (value: unknown) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

// ── Commands ────────────────────────────────────────────────────────────────

async function cmdInit(flags: Record<string, string>) {
  await runInitFlow({
    flags,
    authDeps: {
      defaultPort: DEFAULT_PORT,
      generateToken,
      readAuth,
      writeAuth,
      isDaemonRunning,
    },
  });
}

async function cmdStatus() {
  const auth = readAuth();
  if (!auth) {
    print({ configured: false, hint: 'Run `parchi init` first.' });
    return;
  }

  const daemonRunning = isDaemonRunning();
  const result: Record<string, unknown> = {
    configured: true,
    port: auth.port,
    daemon: daemonRunning ? 'running' : 'stopped',
    pid: readPid(),
  };

  if (daemonRunning) {
    try {
      const ping = await fetchRpc({ method: 'relay.ping' });
      result.relay = ping;
    } catch (err) {
      result.relay = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  print(result);
}

async function cmdStop() {
  const pid = readPid();
  if (!pid) {
    console.log('Daemon is not running.');
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
    removePid();
    console.log(`Daemon (PID ${pid}) stopped.`);
  } catch {
    removePid();
    console.log('Daemon was not running (stale PID removed).');
  }
}

async function cmdTools(flags: Record<string, string>) {
  const agentId = flags.agentId;
  const params = agentId ? { agentId } : undefined;
  const result = await fetchRpc({ method: 'tools.list', params });
  print(result);
}

async function cmdTool(positional: string[], flags: Record<string, string>) {
  const toolName = positional[1];
  if (!toolName) {
    console.error("Usage: parchi tool <name> [--args='{...}']");
    process.exit(1);
  }
  let args: unknown = {};
  if (flags.args) {
    try {
      args = JSON.parse(flags.args);
    } catch {
      console.error('Invalid JSON for --args');
      process.exit(1);
    }
  }
  const agentId = flags.agentId;
  const params = agentId ? { agentId, tool: toolName, args } : { tool: toolName, args };
  const result = await fetchRpc({ method: 'tool.call', params });
  print(result);
}

async function cmdRun(positional: string[], flags: Record<string, string>) {
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

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Native messaging mode — Chrome launches us with a pipe
  if (isNativeMessagingMode()) {
    await handleNativeMessaging();
    return;
  }

  const { positional, flags } = parseArgs(process.argv.slice(2));
  const cmd = positional[0] || '';

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(`parchi — zero-config browser control

Commands:
  parchi init                       Generate token, install native host, start daemon
  parchi run <prompt>               Start agent run, wait for result
  parchi tool <name> [--args='{}']  Call a browser tool
  parchi tools                      List available tools
  parchi status                     Show daemon + extension connection status
  parchi stop                       Stop the daemon
  parchi daemon                     Run daemon in foreground (for debugging)
  parchi relay ...                  Relay service commands (rpc, doctor, agents, tools, run)
  parchi electron ...               Direct Electron control via agent-browser`);
    return;
  }

  if (cmd === 'init') return cmdInit(flags);
  if (cmd === 'daemon') return startDaemon({ foreground: true });
  if (cmd === 'status') return cmdStatus();
  if (cmd === 'stop') return cmdStop();
  if (cmd === 'tools') return cmdTools(flags);
  if (cmd === 'tool') return cmdTool(positional, flags);
  if (cmd === 'run') return cmdRun(positional, flags);
  if (cmd === 'electron') return cmdElectron(process.argv.slice(3));

  // Relay subcommands (merged from relay-service)
  if (cmd === 'relay') {
    const sub = positional[1] || '';
    if (!sub || sub === 'help' || sub === '--help') {
      console.log(`parchi relay — relay service commands

Commands:
  parchi relay rpc <method> [--params='{...}']     Call RPC method directly
  parchi relay doctor [--agentId=...] [--skipTool] Run connectivity diagnostics
  parchi relay agents                              List connected agents
  parchi relay default-agent get|set <agentId>     Get or set default agent
  parchi relay tools [--agentId=...]               List available tools
  parchi relay tool <name> [--args='{...}']        Call a browser tool
  parchi relay run <prompt> [--tabs=...]           Start agent run and wait for result`);
      return;
    }
    if (sub === 'rpc') return cmdRelayRpc(positional, flags);
    if (sub === 'doctor') return cmdRelayDoctor(flags);
    if (sub === 'agents') return cmdRelayAgents();
    if (sub === 'default-agent') return cmdRelayDefaultAgent(positional);
    if (sub === 'tools') return cmdRelayTools(flags);
    if (sub === 'tool') return cmdRelayTool(positional, flags);
    if (sub === 'run') return cmdRelayRun(positional, flags);
    console.error(`Unknown relay subcommand: ${sub}. Run 'parchi relay help' for usage.`);
    process.exit(1);
  }

  // Pass-through RPC for advanced usage
  if (cmd === 'rpc') {
    const method = positional[1];
    if (!method) {
      console.error("Usage: parchi rpc <method> [--params='{...}']");
      process.exit(1);
    }
    let params: unknown;
    if (flags.params) {
      try {
        params = JSON.parse(flags.params);
      } catch {
        console.error('Invalid JSON for --params');
        process.exit(1);
      }
    }
    const result = await fetchRpc({ method, params });
    print(result);
    return;
  }

  console.error(`Unknown command: ${cmd}. Run 'parchi help' for usage.`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
