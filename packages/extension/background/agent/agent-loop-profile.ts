import {
  applyConvexProxyProfile,
  hasOwnApiKey,
  injectOAuthTokens,
  refreshConvexProxyAuthSession,
  resolveProfile,
  resolveRuntimeModelProfile,
  resolveTeamProfiles,
} from '../model-profiles.js';
import type { TokenTracePayload } from '../service-context.js';
import type { RunMeta, SessionState } from '../service-types.js';
import { OAUTH_PROVIDER_MAP, inferModelFamily } from './agent-loop-model-selection.js';
import type { AgentLoopDiagnostics, AgentProfile, AgentSettings, PreparedAgentLoopRun } from './agent-loop-shared.js';

export type ResolvedProfiles = {
  activeProfile: AgentProfile;
  orchestratorProfile: AgentProfile;
  visionProfile: AgentProfile | null;
  runtimeProfileResolution: PreparedAgentLoopRun['runtimeProfileResolution'];
  teamProfiles: Array<{ name: string; provider?: string; model?: string }>;
};

export async function resolveAgentProfiles(
  settings: AgentSettings,
  diagnostics: AgentLoopDiagnostics,
  ctx: {
    sendRuntime: (runMeta: RunMeta, message: Record<string, unknown>) => void;
    emitTokenTrace: (runMeta: RunMeta, sessionState: SessionState, trace: TokenTracePayload) => void;
  },
  runMeta: RunMeta,
  sessionState: SessionState,
): Promise<ResolvedProfiles | { blocked: true; message: string }> {
  const activeProfileName = String(settings.activeConfig || 'default');
  const orchestratorProfileName = String(settings.orchestratorProfile || activeProfileName);
  const visionProfileName = settings.visionProfile ? String(settings.visionProfile) : null;
  const orchestratorEnabled = settings.useOrchestrator === true;
  const teamProfiles = resolveTeamProfiles(settings);
  const activeProfile = resolveProfile(settings, activeProfileName) as AgentProfile;
  let orchestratorProfile = (
    orchestratorEnabled ? resolveProfile(settings, orchestratorProfileName) : activeProfile
  ) as AgentProfile;
  let visionProfile = (
    settings.visionBridge !== false ? resolveProfile(settings, visionProfileName || activeProfileName) : null
  ) as AgentProfile | null;

  if (!hasOwnApiKey(orchestratorProfile)) await refreshConvexProxyAuthSession(settings);

  let runtimeProfileResolution = resolveRuntimeModelProfile(
    orchestratorProfile,
    settings,
  ) as PreparedAgentLoopRun['runtimeProfileResolution'];
  diagnostics.benchmarkRoute = runtimeProfileResolution.route;
  diagnostics.benchmarkProvider = String(orchestratorProfile?.provider || '');
  diagnostics.benchmarkModel = String(orchestratorProfile?.model || settings.model || '');

  if (!runtimeProfileResolution.allowed) {
    return {
      blocked: true,
      message: runtimeProfileResolution.errorMessage || 'Please configure your API key in settings',
    };
  }

  if (runtimeProfileResolution.route === 'oauth') {
    try {
      orchestratorProfile = (await injectOAuthTokens(runtimeProfileResolution.profile)) as AgentProfile;
    } catch (error) {
      const canFallbackToActiveProfile = orchestratorEnabled && orchestratorProfileName !== activeProfileName;
      if (!canFallbackToActiveProfile) throw error;
      const activeRuntimeProfile = resolveRuntimeModelProfile(
        activeProfile,
        settings,
      ) as PreparedAgentLoopRun['runtimeProfileResolution'];
      if (!activeRuntimeProfile.allowed) throw error;
      ctx.sendRuntime(runMeta, {
        type: 'run_warning',
        message: `Orchestrator profile OAuth session is unavailable. Falling back to active profile "${activeProfileName}".`,
      });
      ctx.emitTokenTrace(runMeta, sessionState, {
        action: 'profile_fallback',
        reason: 'history_sanitized',
        note: `Orchestrator OAuth unavailable. Falling back to active profile "${activeProfileName}".`,
        details: {
          fromProfile: orchestratorProfileName,
          toProfile: activeProfileName,
          route: runtimeProfileResolution.route,
        },
      });
      runtimeProfileResolution = activeRuntimeProfile;
      orchestratorProfile =
        activeRuntimeProfile.route === 'oauth'
          ? ((await injectOAuthTokens(activeRuntimeProfile.profile)) as AgentProfile)
          : activeRuntimeProfile.profile;
      diagnostics.benchmarkRoute = runtimeProfileResolution.route;
      diagnostics.benchmarkProvider = String(orchestratorProfile?.provider || diagnostics.benchmarkProvider);
      diagnostics.benchmarkModel = String(orchestratorProfile?.model || diagnostics.benchmarkModel);
    }
  } else {
    orchestratorProfile = runtimeProfileResolution.profile;
  }

  if (visionProfile && !hasOwnApiKey(visionProfile) && runtimeProfileResolution.route === 'proxy') {
    visionProfile = applyConvexProxyProfile(visionProfile, settings) as AgentProfile;
  }

  return { activeProfile, orchestratorProfile, visionProfile, runtimeProfileResolution, teamProfiles };
}

export function buildModelRetryOrder(activeModelId: string, provider: string): string[] {
  const modelRetryOrder = [activeModelId];
  const openRouterLikeProvider = ['openrouter', 'parchi'].includes(String(provider).toLowerCase());
  if (openRouterLikeProvider) {
    if (!modelRetryOrder.includes('openrouter/auto')) modelRetryOrder.push('openrouter/auto');
    if (!modelRetryOrder.includes('openai/gpt-4o-mini')) modelRetryOrder.push('openai/gpt-4o-mini');
  }
  return modelRetryOrder;
}

export function resolveOauthProviderKey(provider: string): string | null {
  return (
    OAUTH_PROVIDER_MAP[
      String(provider || '')
        .trim()
        .toLowerCase()
    ] || null
  );
}

export function inferModelFamilyFromId(modelId: string): string {
  return inferModelFamily(modelId);
}
