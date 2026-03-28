import { RelayBridge } from '../../relay/relay-bridge.js';
import { getRuntimeFeatureFlags } from '../browser-compat.js';
import type { ServiceContext } from '../service-context.js';
import { createApplyRelayConfig, initRelay, scheduleRelayAutoPairCheck } from './relay-config.js';
import { type RelayRpcHandler, buildRelayRpcHandlers, handleRelayRpc } from './relay-rpc.js';

export {
  createApplyRelayConfig,
  initRelay,
  scheduleRelayAutoPairCheck,
  type RelayRpcHandler,
  buildRelayRpcHandlers,
  handleRelayRpc,
};

export function createRelayBridge(ctx: ServiceContext): RelayBridge {
  return new RelayBridge({
    getHelloPayload: async () => {
      const manifest = chrome.runtime.getManifest();
      const stored = await chrome.storage.local.get(['relayAgentId']);
      let agentId = typeof stored.relayAgentId === 'string' ? stored.relayAgentId : '';
      if (!agentId) {
        agentId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        await chrome.storage.local.set({ relayAgentId: agentId });
      }
      return {
        agentId,
        name: 'parchi-extension',
        version: String(manifest.version || ''),
        browser: getRuntimeFeatureFlags().browser,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        capabilities: { tools: true, agentRun: true },
      };
    },
    onRequest: async (req) => handleRelayRpc(ctx, req.method, req.params),
    onStatus: (status) => {
      if (!status.connected) scheduleRelayAutoPairCheck(ctx);
      clearTimeout(ctx._relayStatusTimer);
      ctx._relayStatusTimer = setTimeout(() => {
        const payload: Record<string, unknown> = { relayConnected: Boolean(status.connected) };
        if (status.connected) payload.relayLastConnectedAt = Date.now();
        if (status.lastError !== undefined) payload.relayLastError = status.lastError;
        void chrome.storage.local.set(payload).catch((error) => {
          console.warn('[RelayHandler] Failed to persist relay status:', error);
        });
      }, 500);
    },
  });
}
