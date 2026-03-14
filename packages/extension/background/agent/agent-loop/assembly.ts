import { patchSettingsSnapshot, readSettingsSnapshot } from '../../../state/persistence/settings-repository.js';
import { shouldEnableAnthropicThinking } from './context.js';
import type { ModelConfig } from './model.js';
import type { AgentLoopDiagnostics, AgentProfile, AgentSettings, PreparedAgentLoopRun } from './shared.js';

export function assemblePreparedAgentLoop(params: {
  ctx: PreparedAgentLoopRun['ctx'];
  runMeta: PreparedAgentLoopRun['runMeta'];
  abortSignal: AbortSignal;
  settings: AgentSettings;
  sessionState: PreparedAgentLoopRun['sessionState'];
  browserTools: PreparedAgentLoopRun['browserTools'];
  profiles: {
    activeProfile: AgentProfile;
    orchestratorProfile: AgentProfile;
    visionProfile: AgentProfile | null;
    runtimeProfileResolution: PreparedAgentLoopRun['runtimeProfileResolution'];
  };
  flags: {
    streamEnabled: boolean;
    showThinking: boolean;
    openRouterLikeProvider: boolean;
    oauthProviderKey: string | null;
    requestedModelFamily: string;
  };
  context: import('./shared.js').AgentLoopContext;
  matchedSkillsResult: import('./shared.js').MatchedSkill[];
  preparedHistory: {
    normalizedHistory: PreparedAgentLoopRun['currentHistory'];
    recordedImages: PreparedAgentLoopRun['recordedImages'];
  };
  modelConfig: ModelConfig;
  diagnostics: AgentLoopDiagnostics;
}): PreparedAgentLoopRun {
  const {
    settings,
    sessionState,
    browserTools,
    profiles,
    flags,
    context,
    matchedSkillsResult,
    preparedHistory,
    modelConfig,
    diagnostics,
  } = params;
  const { activeProfile, orchestratorProfile, visionProfile, runtimeProfileResolution } = profiles;
  const { streamEnabled, showThinking, openRouterLikeProvider, oauthProviderKey, requestedModelFamily } = flags;

  return {
    ctx: params.ctx,
    runMeta: params.runMeta,
    abortSignal: params.abortSignal,
    settings,
    sessionState,
    browserTools,
    activeProfile,
    orchestratorProfile,
    visionProfile,
    runtimeProfileResolution,
    streamEnabled,
    showThinking,
    enableAnthropicThinking: shouldEnableAnthropicThinking(showThinking, orchestratorProfile),
    context,
    matchedSkillsResult,
    currentHistory: preparedHistory.normalizedHistory,
    recordedImages: preparedHistory.recordedImages,
    activeModelId: modelConfig.activeModelId,
    model: modelConfig.model,
    modelRetryOrder: modelConfig.modelRetryOrder,
    oauthProviderKey: oauthProviderKey as import('../../../oauth/types.js').OAuthProviderKey | null,
    oauthFallbackCandidatesLoaded: false,
    requestedModelFamily,
    enforceSameFamilyOAuthFallback: oauthProviderKey === 'copilot' && requestedModelFamily.length > 0,
    openRouterLikeProvider,
    toolSet: modelConfig.toolSet,
    switchActiveModel(nextModelId: string) {
      const trimmed = String(nextModelId || '').trim();
      if (!trimmed) return false;
      if (trimmed === this.activeModelId) return true;
      this.orchestratorProfile = { ...this.orchestratorProfile, model: trimmed };
      this.activeModelId = trimmed;
      this.model = buildModelFromProfile(this.orchestratorProfile);
      diagnostics.benchmarkModel = trimmed;
      return true;
    },
    async persistRecoveredModelSelection(nextModelId: string) {
      if (!this.openRouterLikeProvider) return;
      const trimmed = String(nextModelId || '').trim();
      if (!trimmed) return;
      try {
        const stored = await readSettingsSnapshot();
        const configName = String(stored.activeConfig || settings.activeConfig || 'default');
        const configs =
          stored.configs && typeof stored.configs === 'object' && !Array.isArray(stored.configs)
            ? { ...stored.configs }
            : {};
        const activeConfig =
          configs[configName] && typeof configs[configName] === 'object' && !Array.isArray(configs[configName])
            ? { ...configs[configName] }
            : {};
        activeConfig.model = trimmed;
        configs[configName] = activeConfig;
        await patchSettingsSnapshot({ model: trimmed, configs });
      } catch {}
    },
    captureErrorClassificationContext() {
      diagnostics.latestErrorContext = {
        route: this.runtimeProfileResolution.route,
        provider: String(this.orchestratorProfile?.provider || ''),
        proxyProvider: String(this.orchestratorProfile.proxyProvider || ''),
        model: this.activeModelId,
        useProxy: Boolean(this.orchestratorProfile.useProxy),
      };
      return diagnostics.latestErrorContext;
    },
  };
}

function buildModelFromProfile(profile: AgentProfile) {
  const { resolveLanguageModel } = require('../../../ai/sdk/index.js');
  return resolveLanguageModel(profile);
}
