import type { ServiceContext } from '../service-context.js';

const RELAY_STORAGE_KEYS = ['relayEnabled', 'relayUrl', 'relayToken'] as const;

type RelayStoredConfig = {
  relayEnabled?: boolean | string;
  relayUrl?: string;
  relayToken?: string;
  relayConnected?: boolean;
  relayLastError?: string;
};

type OffscreenApiLike = {
  createDocument?: (options: {
    url: string;
    reasons: string[];
    justification: string;
  }) => Promise<void>;
  closeDocument?: () => Promise<void>;
  hasDocument?: () => Promise<boolean>;
  Reason?: Record<string, string | undefined>;
};

const isLoopbackHost = (hostname: string) => {
  const value = String(hostname || '').toLowerCase();
  return value === '127.0.0.1' || value === 'localhost' || value === '::1';
};

const toRelayHttpOrigin = (rawUrl: string) => {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol)) {
      return '';
    }
    parsed.protocol = parsed.protocol === 'https:' || parsed.protocol === 'wss:' ? 'https:' : 'http:';
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.origin;
  } catch {
    return '';
  }
};

async function fetchLoopbackPairToken(origin: string): Promise<string> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), 1_500);
  try {
    const res = await fetch(`${origin}/v1/pair`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) return '';
    const data = (await res.json().catch(() => null)) as { token?: unknown } | null;
    return typeof data?.token === 'string' ? data.token.trim() : '';
  } catch {
    return '';
  } finally {
    clearTimeout(timerId);
  }
}

async function tryLoopbackHttpPair() {
  const stored = (await chrome.storage.local
    .get([...RELAY_STORAGE_KEYS, 'relayConnected'])
    .catch(() => ({}))) as RelayStoredConfig;
  if (stored.relayConnected === true) return;
  if (stored.relayEnabled === false || stored.relayEnabled === 'false') return;

  const configuredOrigin = toRelayHttpOrigin(typeof stored.relayUrl === 'string' ? stored.relayUrl : '');
  const candidates: string[] = [];
  if (configuredOrigin) {
    const host = (() => {
      try {
        return new URL(configuredOrigin).hostname;
      } catch {
        return '';
      }
    })();
    if (isLoopbackHost(host)) candidates.push(configuredOrigin);
    else return;
  } else {
    candidates.push('http://127.0.0.1:17373');
  }

  const existingToken = typeof stored.relayToken === 'string' ? stored.relayToken.trim() : '';
  for (const origin of candidates) {
    const token = await fetchLoopbackPairToken(origin);
    if (!token) continue;
    if (existingToken === token && configuredOrigin === origin && stored.relayEnabled === true) return;
    await chrome.storage.local
      .set({
        relayEnabled: true,
        relayUrl: origin,
        relayToken: token,
      })
      .catch((error) => {
        console.warn('[RelayConfig] Failed to persist loopback relay config:', error);
      });
    return;
  }
}

function tryNativeMessagingPair() {
  chrome.storage.local.get(RELAY_STORAGE_KEYS, (stored: RelayStoredConfig) => {
    const enabled = stored.relayEnabled === true || stored.relayEnabled === 'true';
    const hasUrl = typeof stored.relayUrl === 'string' && stored.relayUrl.trim() !== '';
    const hasToken = typeof stored.relayToken === 'string' && stored.relayToken.trim() !== '';
    if (enabled && hasUrl && hasToken) return;

    try {
      const port = chrome.runtime.connectNative('com.parchi.bridge');
      port.onMessage.addListener((msg: unknown) => {
        const payload = msg as { type?: unknown; url?: unknown; token?: unknown };
        if (payload?.type === 'auth_config' && typeof payload.url === 'string' && typeof payload.token === 'string') {
          void chrome.storage.local
            .set({
              relayEnabled: true,
              relayUrl: payload.url,
              relayToken: payload.token,
            })
            .catch((error) => {
              console.warn('[RelayConfig] Failed to persist native relay config:', error);
            });
        }
        port.disconnect();
      });

      port.onDisconnect.addListener(() => {
        const err = chrome.runtime.lastError;
        if (err) console.debug('[native-messaging] Not available:', err.message);
      });

      port.postMessage({ type: 'hello' });
    } catch {
      // Native messaging not available
    }
  });
}

async function ensureRelayKeepalive() {
  const offscreen = (chrome as typeof chrome & { offscreen?: OffscreenApiLike }).offscreen;
  if (!offscreen?.createDocument) return;
  try {
    const hasDoc = typeof offscreen.hasDocument === 'function' ? await offscreen.hasDocument() : false;
    if (hasDoc) return;
    await offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: [offscreen.Reason?.DOM_PARSER || 'DOM_PARSER'],
      justification: 'Keep relay WebSocket alive for the extension relay agent in MV3.',
    });
  } catch (error) {
    console.warn('[relay] offscreen keepalive failed:', error);
  }
}

async function closeRelayKeepalive() {
  const offscreen = (chrome as typeof chrome & { offscreen?: OffscreenApiLike }).offscreen;
  if (!offscreen?.closeDocument) return;
  try {
    const hasDoc = typeof offscreen.hasDocument === 'function' ? await offscreen.hasDocument() : false;
    if (!hasDoc) return;
    await offscreen.closeDocument();
  } catch {
    // Ignore
  }
}

export function createApplyRelayConfig(ctx: ServiceContext) {
  let applying = false;
  return async () => {
    if (applying) return;
    applying = true;
    try {
      const stored = (await chrome.storage.local.get(RELAY_STORAGE_KEYS)) as RelayStoredConfig;
      const enabled = stored.relayEnabled === true || stored.relayEnabled === 'true';
      const url = typeof stored.relayUrl === 'string' ? stored.relayUrl.trim() : '';
      const token = typeof stored.relayToken === 'string' ? stored.relayToken.trim() : '';
      if (enabled && (!url || !token)) {
        await chrome.storage.local
          .set({ relayConnected: false, relayLastError: 'Missing relay URL or token' })
          .catch((error) => {
            console.warn('[RelayConfig] Failed to persist relay error state:', error);
          });
      }
      if (enabled && url && token) {
        await ensureRelayKeepalive();
      } else {
        await closeRelayKeepalive();
      }
      ctx.relay.configure({ enabled, url, token });
    } finally {
      applying = false;
    }
  };
}

export async function initRelay(ctx: ServiceContext, applyRelayConfig: () => Promise<void>) {
  try {
    await applyRelayConfig();
  } catch (error) {
    console.warn('[relay] init failed:', error);
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (!RELAY_STORAGE_KEYS.some((key) => key in changes)) return;
    void applyRelayConfig().catch((err) => {
      console.warn('[relay] Failed to apply relay config on storage change:', err);
    });
  });

  tryNativeMessagingPair();
  scheduleRelayAutoPairCheck(ctx, 800);
}

export function scheduleRelayAutoPairCheck(ctx: ServiceContext, delayMs = 1500) {
  clearTimeout(ctx._relayAutoPairTimer);
  ctx._relayAutoPairTimer = setTimeout(
    () => {
      ctx._relayAutoPairTimer = undefined;
      void tryLoopbackHttpPair().catch((err) => {
        console.warn('[relay] Loopback HTTP pair check failed:', err);
      });
    },
    Math.max(0, delayMs),
  );
}
