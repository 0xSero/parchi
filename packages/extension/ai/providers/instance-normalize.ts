// Provider instance normalization utilities
import type { ProviderInstance } from '@parchi/shared';
import { OAUTH_PROVIDERS } from '../../oauth/providers.js';
import type { OAuthProviderKey } from '../../oauth/types.js';
import { getProviderDefinition } from './definitions.js';
import { buildProviderInstanceId } from './instance-id.js';
import { mergeProviderModels } from './instance-models.js';

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};

const asString = (value: unknown) => String(value || '').trim();

export const normalizeProviderType = (value: unknown) => asString(value).toLowerCase();

export const isProviderRegistry = (value: unknown): value is Record<string, ProviderInstance> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return true;
};

export const normalizeProviderInstance = (value: unknown): ProviderInstance | null => {
  const provider = asRecord(value) as ProviderInstance;
  const id = asString(provider.id);
  // Support both new 'provider' field and legacy 'providerType' for backward compatibility
  const providerType = normalizeProviderType(
    provider.provider ?? (provider as unknown as Record<string, string>).providerType,
  );
  if (!id || !providerType) return null;

  const authType: ProviderInstance['authType'] = providerType.endsWith('-oauth')
    ? 'oauth'
    : providerType === 'parchi'
      ? 'managed'
      : provider.authType === 'oauth' || provider.authType === 'managed'
        ? provider.authType
        : 'api-key';
  const apiKey = asString(provider.apiKey);
  const providerRecord = provider as unknown as Record<string, unknown>;
  const fallbackModelId = asString(providerRecord.modelId || providerRecord.model);
  const models = mergeProviderModels(providerType, provider.models, fallbackModelId ? [fallbackModelId] : []);

  return {
    ...provider,
    id,
    name: asString(provider.name) || getProviderDefinition(providerType)?.name || id,
    provider: providerType,
    authType,
    apiKey: authType === 'api-key' ? apiKey : '',
    customEndpoint: asString(provider.customEndpoint),
    extraHeaders: asRecord(provider.extraHeaders),
    oauthProviderKey:
      authType === 'oauth'
        ? ((asString(provider.oauthProviderKey) || providerType.replace(/-oauth$/, '')) as OAuthProviderKey)
        : undefined,
    oauthEmail: asString(provider.oauthEmail) || undefined,
    oauthError: asString(provider.oauthError) || undefined,
    isConnected: authType === 'oauth' ? provider.isConnected === true : authType === 'managed' ? true : Boolean(apiKey),
    models,
    createdAt: Number(provider.createdAt || Date.now()),
    updatedAt: Number(provider.updatedAt || provider.createdAt || Date.now()),
    source: provider.source,
  } satisfies ProviderInstance;
};

export const buildProviderFromProfile = (
  profileName: string,
  profile: Record<string, any>,
  existingProviders: Record<string, ProviderInstance>,
) => {
  const providerType = normalizeProviderType(profile.provider);
  const authType: ProviderInstance['authType'] = providerType.endsWith('-oauth')
    ? 'oauth'
    : providerType === 'parchi'
      ? 'managed'
      : 'api-key';
  const oauthProviderKey = authType === 'oauth' ? (providerType.replace(/-oauth$/, '') as OAuthProviderKey) : undefined;
  const providerName =
    asString(profile.providerLabel) ||
    (authType === 'oauth'
      ? OAUTH_PROVIDERS[oauthProviderKey || 'claude']?.name
      : getProviderDefinition(providerType)?.name || profileName);
  const customEndpoint = asString(profile.customEndpoint);
  const apiKey = asString(profile.apiKey);
  const id =
    asString(profile.providerId) ||
    buildProviderInstanceId({
      provider: providerType,
      authType,
      customEndpoint,
      apiKey,
      oauthProviderKey,
      name: providerName,
    });
  const now = Date.now();
  const prior = existingProviders[id];
  const models = mergeProviderModels(
    providerType,
    prior?.models,
    [asString(profile.model || profile.modelId)].filter(Boolean),
  );
  return {
    id,
    name: providerName,
    provider: providerType,
    authType,
    apiKey: authType === 'api-key' ? apiKey : '',
    customEndpoint,
    extraHeaders: asRecord(profile.extraHeaders),
    oauthProviderKey,
    oauthEmail: prior?.oauthEmail,
    oauthError: prior?.oauthError,
    isConnected: authType === 'oauth' ? prior?.isConnected === true : authType === 'managed' ? true : Boolean(apiKey),
    models,
    supportsImages: prior?.supportsImages ?? profile.supportsImages ?? undefined,
    createdAt: Number(prior?.createdAt || now),
    updatedAt: now,
    source: prior?.source || 'migration',
  } satisfies ProviderInstance;
};
