import { normalizeOpenRouterModelId } from '../ai/sdk-client.js';
import { invalidateRuntimeAuthSession, isUsableRuntimeJwt, refreshRuntimeAuthSession } from '../convex/client.js';
import {
  getAccessToken as getOAuthAccessToken,
  getApiBaseUrl as getOAuthApiBaseUrl,
  getProviderConfig as getOAuthProviderConfig,
} from '../oauth/manager.js';
import type { OAuthProviderKey } from '../oauth/types.js';
import { materializeProfileWithProvider } from '../state/provider-registry.js';

export function hasOwnApiKey(profile: Record<string, any> | null | undefined) {
  return Boolean(String(profile?.apiKey || '').trim());
}

export function hasConfiguredModel(profile: Record<string, any> | null | undefined) {
  return Boolean(String(profile?.model || '').trim());
}

export async function injectOAuthTokens(profile: Record<string, any>): Promise<Record<string, any>> {
  const provider = String(profile?.provider || '')
    .trim()
    .toLowerCase();
  if (!provider.endsWith('-oauth')) return profile;
  const baseKey = provider.replace(/-oauth$/, '') as OAuthProviderKey;
  const accessToken = await getOAuthAccessToken(baseKey);
  if (!accessToken) {
    throw new Error(`OAuth session expired for ${baseKey}. Please reconnect in Settings > OAuth.`);
  }
  const apiBaseUrl = await getOAuthApiBaseUrl(baseKey);
  const config = getOAuthProviderConfig(baseKey);
  return {
    ...profile,
    oauthAccessToken: accessToken,
    oauthApiBaseUrl: apiBaseUrl || undefined,
    oauthApiHeaders: config?.apiHeaders || undefined,
  };
}

export function normalizeProxyModelId(provider: string, modelId: string) {
  const model = String(modelId || '').trim();
  if (!model) return '';
  if (provider !== 'openrouter') return model;
  return normalizeOpenRouterModelId(model);
}

export function hasActivePaidSubscription(settings: Record<string, any> = {}) {
  const mode = String(settings.accountModeChoice || '').toLowerCase();
  if (mode !== 'paid') return false;
  // Support both legacy subscriptions AND prepaid credits
  const hasCredits = Number(settings.convexCreditBalanceCents || 0) > 0;
  const status = String(settings.convexSubscriptionStatus || '').toLowerCase();
  const plan = String(settings.convexSubscriptionPlan || '').toLowerCase();
  const hasLegacySub = plan === 'pro' && status === 'active';
  return hasCredits || hasLegacySub;
}

export function resolveConvexProxyBaseUrl(settings: Record<string, any> = {}) {
  const explicitSite = String(settings.convexSiteUrl || '').trim();
  const rawBase = explicitSite || String(settings.convexUrl || '').trim();
  if (!rawBase) return '';
  try {
    const url = new URL(rawBase);
    if (url.hostname.endsWith('.convex.cloud')) {
      url.hostname = url.hostname.replace(/\.convex\.cloud$/i, '.convex.site');
    }
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return rawBase.replace(/\/+$/, '');
  }
}

export function canUseConvexProxy(settings: Record<string, any> = {}) {
  return Boolean(
    resolveConvexProxyBaseUrl(settings) &&
      isUsableRuntimeJwt(settings.convexAccessToken, settings.convexTokenExpiresAt, { minRemainingMs: 0 }),
  );
}

export async function refreshConvexProxyAuthSession(settings: Record<string, any>, options: { force?: boolean } = {}) {
  const mode = String(settings.accountModeChoice || '')
    .trim()
    .toLowerCase();
  if (mode !== 'paid') return false;
  if (!resolveConvexProxyBaseUrl(settings)) return false;

  try {
    const session = await refreshRuntimeAuthSession({ force: options.force === true });
    const accessToken = String(session.accessToken || '').trim();
    if (!accessToken) {
      settings.convexAccessToken = '';
      settings.convexRefreshToken = '';
      settings.convexTokenExpiresAt = 0;
      return false;
    }
    settings.convexAccessToken = accessToken;
    settings.convexRefreshToken = String(session.refreshToken || '').trim();
    settings.convexTokenExpiresAt = Number(session.expiresAt || 0);
    return true;
  } catch (error) {
    console.warn('[paid-auth] Failed to refresh convex proxy auth session:', error);
    await invalidateRuntimeAuthSession();
    settings.convexAccessToken = '';
    settings.convexRefreshToken = '';
    settings.convexTokenExpiresAt = 0;
    return false;
  }
}

export function applyConvexProxyProfile(profile: Record<string, any>, settings: Record<string, any>) {
  const preferredProvider =
    profile?.provider === 'kimi'
      ? 'kimi'
      : profile?.provider === 'anthropic' || profile?.provider === 'glm' || profile?.provider === 'minimax'
        ? 'anthropic'
        : profile?.provider === 'openrouter' || profile?.provider === 'parchi'
          ? 'openrouter'
          : 'openai';
  const requestedModel = String(profile?.model || settings.model || '').trim();
  const normalizedModel = normalizeProxyModelId(preferredProvider, requestedModel);
  const proxyBaseUrl = resolveConvexProxyBaseUrl(settings);
  return {
    provider: preferredProvider,
    apiKey: profile?.apiKey || '',
    model: normalizedModel,
    customEndpoint: profile?.customEndpoint || '',
    extraHeaders: profile?.extraHeaders || {},
    useProxy: true,
    proxyBaseUrl,
    proxyAuthToken: String(settings.convexAccessToken || '').trim(),
    proxyProvider: preferredProvider,
  };
}

export function resolveRuntimeModelProfile(profile: Record<string, any>, settings: Record<string, any>) {
  if (!hasConfiguredModel(profile)) {
    return {
      allowed: false,
      route: 'none',
      profile,
      errorMessage: 'No model configured. Open Settings and choose a model to continue.',
    };
  }
  // OAuth subscription providers (e.g. claude-oauth, codex-oauth)
  const provider = String(profile?.provider || '')
    .trim()
    .toLowerCase();
  if (provider.endsWith('-oauth')) {
    return { allowed: true, route: 'oauth', profile };
  }
  if (hasOwnApiKey(profile)) {
    return { allowed: true, route: 'byok', profile };
  }
  if (!hasActivePaidSubscription(settings)) {
    return {
      allowed: false,
      route: 'none',
      profile,
      errorMessage: 'No access configured. Add your own API key in Setup, or buy credits in Account & Billing.',
    };
  }
  if (!canUseConvexProxy(settings)) {
    return {
      allowed: false,
      route: 'none',
      profile,
      errorMessage:
        'Paid access is selected but auth is missing. Sign in again in Account & Billing, then click Refresh.',
    };
  }
  return {
    allowed: true,
    route: 'proxy',
    profile: applyConvexProxyProfile(profile, settings),
  };
}

export function resolveProfile(settings: Record<string, any>, name = 'default') {
  const base = {
    provider: settings.provider,
    providerId: settings.providerId,
    providerLabel: settings.providerLabel,
    apiKey: settings.apiKey,
    modelId: settings.modelId,
    model: settings.model,
    customEndpoint: settings.customEndpoint,
    extraHeaders: settings.extraHeaders,
    systemPrompt: settings.systemPrompt,
    sendScreenshotsAsImages: settings.sendScreenshotsAsImages,
    screenshotQuality: settings.screenshotQuality,
    showThinking: settings.showThinking,
    streamResponses: settings.streamResponses,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
    timeout: settings.timeout,
    contextLimit: settings.contextLimit,
    enableScreenshots: settings.enableScreenshots,
  };
  const profile = settings.configs && settings.configs[name] ? settings.configs[name] : {};
  return materializeProfileWithProvider(settings, name, { ...base, ...profile });
}

export function resolveTeamProfiles(settings: Record<string, any>) {
  const names = Array.isArray(settings.auxAgentProfiles) ? settings.auxAgentProfiles : [];
  const unique = Array.from(new Set(names)).filter(
    (name): name is string => typeof name === 'string' && name.trim().length > 0,
  );
  return unique.map((name) => {
    const profile = resolveProfile(settings, name);
    return {
      name,
      provider: profile.provider || '',
      model: profile.model || '',
    };
  });
}

export function isVisionModelProfile(profile: Record<string, any> | null | undefined) {
  const provider = String(profile?.provider || '').toLowerCase();
  const model = String(profile?.model || '').toLowerCase();

  if (!provider) return false;
  if (provider === 'anthropic' || provider === 'claude-oauth') return true;
  if (provider === 'kimi') return true;
  if (provider === 'glm') return /4\.6v|vision/.test(model);
  if (provider === 'minimax') return /vision/.test(model);
  if (provider === 'codex-oauth' || provider === 'copilot-oauth') {
    return /gpt-4o|vision/i.test(model);
  }
  if (provider === 'openrouter' || provider === 'parchi') {
    return /(claude|gpt-4o|gpt-4-turbo|gemini|vision)/i.test(model);
  }
  if (provider === 'openai') {
    return /gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-4-vision|vision/.test(model);
  }
  if (provider === 'google') {
    return /(gemini|imagen)/.test(model);
  }

  return model.includes('vision');
}
