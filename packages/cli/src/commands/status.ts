import { isDaemonRunning, readAuth, readPid } from '../auth.js';
import { fetchRpc } from '../rpc-client.js';

const print = (value: unknown) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

export async function cmdStatus() {
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
