import { redactTabEntry } from '../../destination-guard.js';
import { isVisionModelProfile } from '../../model-profiles.js';
import type { ServiceContext } from '../../service-context.js';
import type { RunMeta } from '../../service-types.js';
import type { AgentLoopContext, AgentProfile, AgentSettings } from './shared.js';

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
  const [rawActiveTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // Titles/URLs of private-network or unverified tabs must not reach the model via the system prompt (#42).
  const activeTab = rawActiveTab ? await redactTabEntry(rawActiveTab, settings) : undefined;
  const sessionTabs = await Promise.all(
    browserTools.getSessionTabSummaries().map((tab) => redactTabEntry(tab, settings)),
  );
  const workingTabId: number | null = browserTools.getCurrentSessionTabId() ?? rawActiveTab?.id ?? null;
  const workingTab = sessionTabs.find((tab) => tab.id === workingTabId);
  const titleOf = (tab: object | undefined) =>
    tab && 'title' in tab ? String(tab.title || '') : tab && 'redacted' in tab ? '[hidden]' : '';

  return {
    currentUrl: workingTab?.url || activeTab?.url || 'unknown',
    currentTitle: titleOf(workingTab) || titleOf(activeTab) || 'unknown',
    tabId: workingTabId,
    availableTabs: sessionTabs
      .filter((tab) => typeof tab.id === 'number')
      .map((tab) => ({ id: tab.id as number, title: titleOf(tab) || undefined, url: tab.url })),
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
