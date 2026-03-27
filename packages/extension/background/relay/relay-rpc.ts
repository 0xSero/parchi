import { getActiveTab } from '../../utils/active-tab.js';
import { isVisionModelProfile, resolveProfile, resolveTeamProfiles } from '../model-profiles.js';
import type { ServiceContext } from '../service-context.js';
import { checkToolPermission } from '../tool-permissions.js';

export type RelayRpcHandler = (params: unknown) => Promise<unknown>;

type RelayRunParams = {
  prompt: string;
  sessionId: string;
  selectedTabIds: number[] | null;
};

const parseRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

function validateRelayRunParams(params: unknown): RelayRunParams {
  const record = parseRecord(params);
  if (!record) {
    throw new Error('agent.run: params must be an object');
  }

  const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : '';
  if (!prompt) throw new Error('agent.run: missing prompt');
  if (prompt.length > 20_000) throw new Error('agent.run: prompt too large (max 20,000 chars)');

  const sessionId =
    typeof record.sessionId === 'string' && record.sessionId.trim() ? record.sessionId.trim() : `session-${Date.now()}`;
  if (sessionId.length > 120) throw new Error('agent.run: sessionId too long (max 120 chars)');
  if (!/^[a-zA-Z0-9._:-]+$/.test(sessionId)) {
    throw new Error('agent.run: sessionId contains invalid characters');
  }

  if (record.selectedTabIds !== undefined && !Array.isArray(record.selectedTabIds)) {
    throw new Error('agent.run: selectedTabIds must be an array when provided');
  }
  if (Array.isArray(record.selectedTabIds) && record.selectedTabIds.length > 25) {
    throw new Error('agent.run: selectedTabIds supports at most 25 tabs');
  }

  const selectedTabIds = Array.isArray(record.selectedTabIds)
    ? Array.from(
        new Set(
          record.selectedTabIds
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && Number.isFinite(value) && value > 0),
        ),
      )
    : null;

  if (
    Array.isArray(record.selectedTabIds) &&
    record.selectedTabIds.length > 0 &&
    (!selectedTabIds || !selectedTabIds.length)
  ) {
    throw new Error('agent.run: selectedTabIds must contain positive integer tab IDs');
  }

  return { prompt, sessionId, selectedTabIds };
}

async function handleRelayToolsList(ctx: ServiceContext) {
  const settings = await chrome.storage.local.get([
    'activeConfig',
    'provider',
    'apiKey',
    'model',
    'customEndpoint',
    'extraHeaders',
    'systemPrompt',
    'configs',
    'useOrchestrator',
    'orchestratorProfile',
    'visionBridge',
    'visionProfile',
    'enableScreenshots',
    'sendScreenshotsAsImages',
    'screenshotQuality',
    'showThinking',
    'streamResponses',
    'temperature',
    'maxTokens',
    'timeout',
    'contextLimit',
    'toolPermissions',
    'allowedDomains',
  ]);
  const activeProfileName = typeof settings.activeConfig === 'string' ? settings.activeConfig : 'default';
  const activeProfile = resolveProfile(settings, activeProfileName);
  const orchestratorEnabled = settings.useOrchestrator === true;
  const teamProfiles = resolveTeamProfiles(settings);
  const visionToolsEnabled = isVisionModelProfile(activeProfile);
  return ctx.getToolsForSession(settings, orchestratorEnabled, teamProfiles, visionToolsEnabled);
}

async function handleRelayToolCall(ctx: ServiceContext, params: unknown) {
  const record = parseRecord(params);
  const tool = typeof record?.tool === 'string' ? record.tool : '';
  const sessionId = typeof record?.sessionId === 'string' ? record.sessionId : ctx.currentSessionId || 'relay';
  const args = parseRecord(record?.args) || {};
  if (!tool) throw new Error('tool.call: missing tool');

  const settings = await chrome.storage.local.get(['toolPermissions', 'allowedDomains']);
  const perm = await checkToolPermission(
    tool,
    args,
    settings,
    ctx.currentSettings,
    sessionId,
    ctx.currentSessionId,
    (id) => ctx.getBrowserTools(id),
  );
  if (!perm.allowed) throw new Error(perm.reason || 'Tool blocked by policy');
  return await ctx.getBrowserTools(sessionId).executeTool(tool, args);
}

async function handleRelaySessionSetTabs(ctx: ServiceContext, params: unknown) {
  const record = parseRecord(params);
  const sessionId = typeof record?.sessionId === 'string' ? record.sessionId : ctx.currentSessionId || 'relay';
  const ids = Array.isArray(record?.tabIds) ? record.tabIds : [];
  const tabIds = ids.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);

  const tabs: chrome.tabs.Tab[] = [];
  for (const tabId of tabIds) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab) tabs.push(tab);
    } catch {
      // Ignore stale tab ids
    }
  }

  await ctx.getBrowserTools(sessionId).configureSessionTabs(tabs, { title: 'Parchi', color: 'blue' });
  return { ok: true, tabIds: tabs.map((tab) => tab.id).filter((id): id is number => typeof id === 'number') };
}

async function handleRelaySettingsGet(params: unknown) {
  const record = parseRecord(params);
  const keys = record?.keys;
  if (!Array.isArray(keys)) throw new Error('settings.get: keys must be an array');
  return await chrome.storage.local.get(keys);
}

async function handleRelaySettingsSet(params: unknown) {
  const record = parseRecord(params);
  const data = parseRecord(record?.data);
  if (!data) throw new Error('settings.set: data must be an object');
  await chrome.storage.local.set(data);
  return { ok: true };
}

async function handleRelayAgentRun(ctx: ServiceContext, params: unknown) {
  const { prompt, sessionId, selectedTabIds } = validateRelayRunParams(params);
  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const selectedTabs: chrome.tabs.Tab[] = [];
  if (Array.isArray(selectedTabIds) && selectedTabIds.length) {
    for (const tabId of selectedTabIds) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab) selectedTabs.push(tab);
      } catch {
        // Ignore stale tab ids
      }
    }
  }

  if (!selectedTabs.length) {
    const activeTab = await getActiveTab();
    if (activeTab) selectedTabs.push(activeTab);
  }

  void ctx.processUserMessage(prompt, [], selectedTabs, sessionId, { runId, turnId, origin: 'relay' }).catch((err) => {
    console.warn('[relay-rpc] Agent run failed:', err);
  });
  return { runId, sessionId };
}

export function buildRelayRpcHandlers(ctx: ServiceContext): Record<string, RelayRpcHandler> {
  return {
    'tools.list': () => handleRelayToolsList(ctx),
    'tool.call': (params) => handleRelayToolCall(ctx, params),
    'session.setTabs': (params) => handleRelaySessionSetTabs(ctx, params),
    'settings.get': (params) => handleRelaySettingsGet(params),
    'settings.set': (params) => handleRelaySettingsSet(params),
    'agent.run': (params) => handleRelayAgentRun(ctx, params),
  };
}

export async function handleRelayRpc(ctx: ServiceContext, method: string, params: unknown) {
  const handlers = buildRelayRpcHandlers(ctx);
  const handler = handlers[method];
  if (!handler) {
    throw new Error(`Unknown method: ${method}`);
  }
  return await handler(params);
}
