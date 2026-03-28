import { sleep } from '@parchi/shared';

const PORT_NAME = 'relay-keepalive';
const PING_MS = 25_000;

async function run() {
  // Offscreen documents can survive across SW restarts. We keep reconnecting so the SW
  // reliably wakes and can maintain the relay WebSocket connection.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let port: chrome.runtime.Port | null = null;
    try {
      port = chrome.runtime.connect({ name: PORT_NAME });
    } catch {
      await sleep(1000);
      continue;
    }

    let closed = false;
    port.onDisconnect.addListener(() => {
      closed = true;
    });

    // Periodic message helps ensure the SW stays "busy" and re-wakes quickly after any restart.
    while (!closed) {
      try {
        port.postMessage({ type: 'ping', t: Date.now() });
      } catch {
        break;
      }
      await sleep(PING_MS);
    }

    await sleep(500);
  }
}

void run().catch((err) => {
  console.error('[offscreen] Offscreen document initialization failed:', err);
});
