import type { ProviderInstance, ProviderModelEntry } from '@parchi/shared';
import { getProviderDefinition } from '../ai/providers/registry.js';
import { OAUTH_PROVIDERS } from '../oauth/providers.js';
import type { OAuthProviderKey } from '../oauth/types.js';
import { mergeProviderModels, normalizeProviderModels } from './provider-models.js';

type SettingsLike = Record<string, any>;

const asRecord = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};

const asString = (value: unknown) => String(value || '').trim();

export const normalizeProviderType = (value: unknown) => asString(value).toLowerCase();

export const isProviderRegistry = (value: unknown): value is Record<string, ProviderInstance> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return true;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'provider';

const hashBasis = (provider: string, authType: string, endpoint: string, key: string, name: string) =>
  `${provider}|${authType}|${endpoint}|${key}|${name}`.toLowerCase();

export const buildProviderInstanceId = (input: {
  provider: string;
  authType: ProviderInstance['authType'];
  customEndpoint?: string;
  apiKey?: string;
  oauthProviderKey?: string;
  name?: string;
}) => {
  const basis = hashBasis(
    input.provider,
    input.authType,
    asString(input.customEndpoint),
    input.authType === 'oauth' ? asString(input.oauthProviderKey) : asString(input.apiKey),
    asString(input.name),
  );
  let hash = 2166136261;
  for (let i = 0; i < basis.length; i += 1) {
    hash ^= basis.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${slugify(input.name || input.provider)}-${Math.abs(hash >>> 0).toString(36)}`;
};

const normalizeProviderInstance = (value: unknown): ProviderInstance | null => {
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

const buildProviderFromProfile = (
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

export const getProviderRegistry = (settings: SettingsLike): Record<string, ProviderInstance> => {
  const providers = isProviderRegistry(settings.providers) ? settings.providers : {};
  const normalized: Record<string, ProviderInstance> = {};
  for (const [key, value] of Object.entries(providers)) {
    const provider = normalizeProviderInstance(value);
    if (!provider) continue;
    normalized[key] = provider;
  }
  return normalized;
};

export const listProviderInstances = (settings: SettingsLike): ProviderInstance[] =>
  Object.values(getProviderRegistry(settings)).sort((a, b) => a.name.localeCompare(b.name));

export const getProviderInstance = (settings: SettingsLike, providerId: string): ProviderInstance | null => {
  if (!providerId) return null;
  return getProviderRegistry(settings)[providerId] || null;
};

export const ensureProviderModel = (
  provider: ProviderInstance,
  model: Partial<ProviderModelEntry> | string | null | undefined,
): ProviderInstance => {
  if (!model) return provider;
  const entry =
    typeof model === 'string'
      ? ({ id: model, addedManually: true } satisfies ProviderModelEntry)
      : ({
          id: asString(model.id),
          label: asString(model.label) || undefined,
          contextWindow: Number.isFinite(Number(model.contextWindow)) ? Number(model.contextWindow) : undefined,
          supportsVision: model.supportsVision === true,
          addedManually: model.addedManually === true,
        } satisfies ProviderModelEntry);
  if (!entry.id) return provider;
  const existing = normalizeProviderModels(provider.models);
  if (existing.some((item) => item.id === entry.id)) return provider;
  return { ...provider, models: [...existing, entry], updatedAt: Date.now() };
};

export const materializeProfileWithProvider = (
  settings: SettingsLike,
  _name: string,
  profile: Record<string, any>,
): Record<string, any> => {
  const providers = getProviderRegistry(settings);
  const providerId = asString(profile.providerId);
  const provider = providerId ? providers[providerId] : null;
  if (!provider) return profile;
  const modelId = asString(profile.modelId || profile.model);
  return {
    ...profile,
    providerId,
    modelId: modelId || profile.model || '',
    provider: provider.provider,
    providerLabel: provider.name,
    apiKey: provider.authType === 'api-key' ? asString(provider.apiKey) : '',
    customEndpoint: asString(provider.customEndpoint),
    extraHeaders: asRecord(provider.extraHeaders),
    model: modelId || asString(profile.model),
  };
};

export const migrateSettingsToProviderRegistry = (settings: SettingsLike): SettingsLike => {
  const next: SettingsLike = { ...settings };
  const providers = getProviderRegistry(next);
  const configs = asRecord(next.configs);
  const migratedConfigs: Record<string, any> = {};

  for (const [name, rawProfile] of Object.entries(configs)) {
    const profile = asRecord(rawProfile);
    if (!profile.providerId && profile.provider) {
      const instance = buildProviderFromProfile(name, profile, providers);
      providers[instance.id] = ensureProviderModel(instance, asString(profile.model));
      migratedConfigs[name] = {
        ...profile,
        providerId: instance.id,
        modelId: asString(profile.modelId || profile.model),
        providerLabel: profile.providerLabel || instance.name,
      };
      continue;
    }

    migratedConfigs[name] = materializeProfileWithProvider({ ...next, providers }, name, profile);
  }

  if (!migratedConfigs.default) {
    migratedConfigs.default = {
      providerId: '',
      modelId: '',
      provider: asString(next.provider),
      model: asString(next.model),
      apiKey: asString(next.apiKey),
      customEndpoint: asString(next.customEndpoint),
      extraHeaders: asRecord(next.extraHeaders),
      systemPrompt: asString(next.systemPrompt),
    };
    if (migratedConfigs.default.provider) {
      const instance = buildProviderFromProfile('default', migratedConfigs.default, providers);
      providers[instance.id] = ensureProviderModel(instance, asString(migratedConfigs.default.model));
      migratedConfigs.default.providerId = instance.id;
      migratedConfigs.default.modelId = asString(migratedConfigs.default.model);
      migratedConfigs.default.providerLabel = instance.name;
    }
  }

  next.providers = providers;
  next.configs = migratedConfigs;

  const activeConfigName = asString(next.activeConfig) || 'default';
  const activeProfile = materializeProfileWithProvider(
    next,
    activeConfigName,
    asRecord(migratedConfigs[activeConfigName]),
  );
  next.provider = asString(activeProfile.provider);
  next.apiKey = asString(activeProfile.apiKey);
  next.model = asString(activeProfile.modelId || activeProfile.model);
  next.customEndpoint = asString(activeProfile.customEndpoint);
  next.extraHeaders = asRecord(activeProfile.extraHeaders);
  next.activeConfig = activeConfigName;

  return next;
};
