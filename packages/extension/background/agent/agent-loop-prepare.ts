import { readSettingsSnapshot } from '../../state/persistence/settings-repository.js';
import { isVisionModelProfile } from '../model-profiles.js';
import { assemblePreparedAgentLoop } from './agent-loop-assembly.js';
import { buildAgentLoopContext, checkKimiHeaderRequirement, parseBooleanSetting } from './agent-loop-context.js';
import { buildModelConfig } from './agent-loop-model.js';
import { inferModelFamilyFromId, resolveAgentProfiles, resolveOauthProviderKey } from './agent-loop-profile.js';
import type {
  AgentLoopDiagnostics,
  AgentSettings,
  PreparedAgentLoopBlocked,
  PreparedAgentLoopRun,
  RecordedContext,
} from './agent-loop-shared.js';
import { prepareConversationHistory } from './history-prep.js';
import { getMatchedSkills } from './skill-matcher.js';

export async function prepareAgentLoopRun(
  ctx: PreparedAgentLoopRun['ctx'],
  runMeta: PreparedAgentLoopRun['runMeta'],
  abortSignal: AbortSignal,
  sessionId: string,
  userMessage: string,
  conversationHistory: PreparedAgentLoopRun['currentHistory'],
  selectedTabs: chrome.tabs.Tab[],
  recordedContext: RecordedContext,
  diagnostics: AgentLoopDiagnostics,
): Promise<PreparedAgentLoopRun | PreparedAgentLoopBlocked> {
  const sessionState = ctx.getSessionState(sessionId);
  const browserTools = ctx.getBrowserTools(sessionId);
  const settings = await loadAgentSettings();

  ctx.currentSettings = settings;
  ctx.currentSessionId = sessionId;

  try {
    await browserTools.configureSessionTabs(selectedTabs || [], { title: 'Parchi', color: 'blue' });
  } catch (error) {
    console.warn('Failed to configure session tabs:', error);
  }

  const profilesResult = await resolveAgentProfiles(settings, diagnostics, ctx, runMeta, sessionState);
  if ('blocked' in profilesResult) return profilesResult;

  const { activeProfile, orchestratorProfile, visionProfile, runtimeProfileResolution, teamProfiles } = profilesResult;
  const orchestratorEnabled = settings.useOrchestrator === true;

  checkKimiHeaderRequirement(
    { active: activeProfile, orchestrator: orchestratorProfile, vision: visionProfile },
    ctx,
    sessionId,
    ctx.sendRuntime.bind(ctx),
    runMeta,
  );

  const streamEnabled = parseBooleanSetting(settings.streamResponses as boolean | string | undefined, true);
  const showThinking = parseBooleanSetting(settings.showThinking as boolean | string | undefined, true);
  diagnostics.streamResponsesEnabled = streamEnabled;

  const context = await buildAgentLoopContext(
    ctx,
    settings,
    orchestratorProfile,
    teamProfiles,
    orchestratorEnabled,
    showThinking,
  );
  const matchedSkillsResult = await getMatchedSkills(String(context.currentUrl || ''));
  const preparedHistory = prepareConversationHistory(userMessage, conversationHistory, recordedContext);

  emitHistoryPrepared(ctx, runMeta, sessionState, preparedHistory);

  const tools = ctx.getToolsForSession(
    settings,
    orchestratorEnabled,
    teamProfiles,
    isVisionModelProfile(orchestratorProfile),
  );
  const modelRetryOrder = buildModelRetryOrder(
    String(orchestratorProfile.model || settings.model || ''),
    orchestratorProfile.provider || '',
  );
  const oauthProviderKey = resolveOauthProviderKey(orchestratorProfile.provider || '');
  const requestedModelFamily = inferModelFamilyFromId(String(orchestratorProfile.model || settings.model || ''));
  const openRouterLikeProvider = ['openrouter', 'parchi'].includes(
    String(orchestratorProfile.provider || '').toLowerCase(),
  );

  const modelConfig = buildModelConfig(
    orchestratorProfile,
    settings,
    tools,
    ctx,
    runMeta,
    visionProfile,
    modelRetryOrder,
  );

  diagnostics.latestErrorContext = {
    route: runtimeProfileResolution.route,
    provider: String(orchestratorProfile?.provider || ''),
    proxyProvider: String(orchestratorProfile.proxyProvider || ''),
    model: String(orchestratorProfile?.model || modelConfig.activeModelId || ''),
    useProxy: Boolean(orchestratorProfile.useProxy),
  };

  return assemblePreparedAgentLoop({
    ctx,
    runMeta,
    abortSignal,
    settings,
    sessionState,
    browserTools,
    profiles: { activeProfile, orchestratorProfile, visionProfile, runtimeProfileResolution },
    flags: { streamEnabled, showThinking, openRouterLikeProvider, oauthProviderKey, requestedModelFamily },
    context,
    matchedSkillsResult,
    preparedHistory: {
      normalizedHistory: preparedHistory.normalizedHistory,
      recordedImages: preparedHistory.recordedImages,
    },
    modelConfig,
    diagnostics,
  });
}

async function loadAgentSettings(): Promise<AgentSettings> {
  const settings = (await readSettingsSnapshot()) as AgentSettings;
  settings.enableScreenshots ??= true;
  settings.sendScreenshotsAsImages ??= false;
  settings.visionBridge ??= true;
  settings.toolPermissions ??= { read: true, interact: true, navigate: true, tabs: true, screenshots: true };
  settings.allowedDomains ??= '';
  if (!Array.isArray(settings.auxAgentProfiles)) settings.auxAgentProfiles = [];
  return settings;
}

function buildModelRetryOrder(activeModelId: string, provider: string): string[] {
  const order = [activeModelId];
  if (['openrouter', 'parchi'].includes(provider.toLowerCase())) {
    if (!order.includes('openrouter/auto')) order.push('openrouter/auto');
    if (!order.includes('openai/gpt-4o-mini')) order.push('openai/gpt-4o-mini');
  }
  return order;
}

function emitHistoryPrepared(
  ctx: PreparedAgentLoopRun['ctx'],
  runMeta: PreparedAgentLoopRun['runMeta'],
  sessionState: PreparedAgentLoopRun['sessionState'],
  preparedHistory: ReturnType<typeof prepareConversationHistory>,
) {
  ctx.emitTokenTrace(runMeta, sessionState, {
    action: 'history_prepared',
    reason: 'history_sanitized',
    note: `Prepared ${preparedHistory.normalizedHistory.length} messages for model call.`,
    details: {
      inputHistoryCount: preparedHistory.historyInput.length,
      withUserMessageCount: preparedHistory.historyWithUserMessage.length,
      normalizedCount: preparedHistory.normalizedHistory.length,
      appendedUserMessage: preparedHistory.shouldAppendUserMessage,
      replacedLastUserMessage: preparedHistory.shouldReplaceLastUserMessage,
    },
  });
}
