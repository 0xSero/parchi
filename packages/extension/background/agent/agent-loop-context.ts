import { isVisionModelProfile } from '../model-profiles.js';
import type { ServiceContext } from '../service-context.js';
import type { RunMeta } from '../service-types.js';
import type { AgentLoopContext, AgentProfile, AgentSettings } from './agent-loop-shared.js';

export async function buildAgentLoopContext(
  ctx: ServiceContext,
  settings: AgentSettings,
  orchestratorProfile: AgentProfile,
  teamProfiles: Array<{ name: string; provider?: string; model?: string }>,
  orchestratorEnabled: boolean,
  showThinking: boolean,
): Promise<AgentLoopContext> {
  const browserTools = ctx.getBrowserTools(ctx.currentSessionId || '');
  const tools = ctx.getToolsForSession(
    settings,
    orchestratorEnabled,
    teamProfiles,
    isVisionModelProfile(orchestratorProfile),
  );
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const sessionTabs = browserTools.getSessionTabSummaries();
  const workingTabId: number | null = browserTools.getCurrentSessionTabId() ?? activeTab?.id ?? null;
  const workingTab = sessionTabs.find((tab) => tab.id === workingTabId);

  return {
    currentUrl: workingTab?.url || activeTab?.url || 'unknown',
    currentTitle: workingTab?.title || activeTab?.title || 'unknown',
    tabId: workingTabId,
    availableTabs: sessionTabs
      .filter((tab) => typeof tab.id === 'number')
      .map((tab) => ({ id: tab.id as number, title: tab.title, url: tab.url })),
    orchestratorEnabled,
    teamProfiles,
    provider: orchestratorProfile.provider || '',
    model: orchestratorProfile.model || settings.model || '',
    toolCatalog: tools.map((tool) => ({ name: tool.name, description: tool.description || '' })),
    showThinking,
  };
}

export function checkKimiHeaderRequirement(
  profiles: { active?: AgentProfile; orchestrator?: AgentProfile; vision?: AgentProfile | null },
  ctx: { kimiHeaderRuleOk?: boolean; getSessionState: (sessionId: string) => { kimiWarningSent?: boolean } },
  sessionId: string,
  sendRuntime: (runMeta: RunMeta, message: Record<string, unknown>) => void,
  runMeta: RunMeta,
): void {
  const kimiInUse =
    profiles.active?.provider === 'kimi' ||
    profiles.orchestrator?.provider === 'kimi' ||
    profiles.vision?.provider === 'kimi';
  const sessionState = ctx.getSessionState(sessionId);
  if (kimiInUse && !ctx.kimiHeaderRuleOk && !sessionState.kimiWarningSent) {
    sessionState.kimiWarningSent = true;
    sendRuntime(runMeta, {
      type: 'run_warning',
      message:
        'Kimi requires User-Agent "coding-agent". This browser runtime could not configure a compatible header rewrite path (DNR/webRequest), so requests may fail. Use a build with header rewrite support or route through a proxy that sets this header.',
    });
  }
}

export function shouldEnableAnthropicThinking(showThinking: boolean, orchestratorProfile: AgentProfile): boolean {
  return (
    showThinking &&
    (orchestratorProfile.provider === 'anthropic' ||
      orchestratorProfile.provider === 'kimi' ||
      ((orchestratorProfile.provider === 'openrouter' || orchestratorProfile.provider === 'parchi') &&
        /claude/i.test(orchestratorProfile.model || '')))
  );
}

export function parseBooleanSetting(value: boolean | string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  if (typeof value === 'boolean') return value;
  return value !== 'false';
}
