// packages/extension/offscreen/offscreen.ts
var PORT_NAME = "relay-keepalive";
var PING_MS = 25e3;
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function run() {
  while (true) {
    let port = null;
    try {
      port = chrome.runtime.connect({ name: PORT_NAME });
    } catch {
      await sleep(1e3);
      continue;
    }
    let closed = false;
    port.onDisconnect.addListener(() => {
      closed = true;
    });
    while (!closed) {
      try {
        port.postMessage({ type: "ping", t: Date.now() });
      } catch {
        break;
      }
      await sleep(PING_MS);
    }
    await sleep(500);
  }
}
void run();
//# sourceMappingURL=offscreen.js.map
