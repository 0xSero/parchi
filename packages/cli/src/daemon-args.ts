import { readAuth } from './auth.js';
import { ParchiDaemon } from './daemon.js';

export function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [k, v] = arg.slice(2).split('=');
    out[k] = v ?? 'true';
  }
  return out;
}

export async function startDaemon(_opts?: { foreground?: boolean; args?: string[] }) {
  // Parse command-line arguments for direct daemon launch (e.g., from tests)
  const args = _opts?.args ?? process.argv.slice(2);
  const parsed = parseArgs(args);

  let token: string;
  let host: string;
  let port: number;

  // If token provided via CLI args, use those (for tests/direct launch)
  if (parsed.token) {
    token = parsed.token || process.env.PARCHI_RELAY_TOKEN || '';
    host = parsed.host || process.env.PARCHI_RELAY_HOST || '127.0.0.1';
    port = Number(parsed.port || process.env.PARCHI_RELAY_PORT || 17373);
    if (!token) {
      console.error('Missing relay token. Provide `--token=...` or set PARCHI_RELAY_TOKEN.');
      process.exit(1);
    }
  } else {
    // Otherwise use auth config
    const auth = readAuth();
    if (!auth) {
      console.error('No auth config found. Run `parchi init` first.');
      process.exit(1);
    }
    token = auth.token;
    host = '127.0.0.1';
    port = auth.port;
  }

  const daemon = new ParchiDaemon({ token, host, port });
  await daemon.start();
}
