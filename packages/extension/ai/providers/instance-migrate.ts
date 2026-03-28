// Provider settings migration utilities
import { asRecord } from '@parchi/shared';
import { buildProviderFromProfile } from './instance-normalize.js';
import { ensureProviderModel, getProviderRegistry } from './instance-registry.js';

type SettingsLike = Record<string, any>;

const asRecordOrEmpty = (value: unknown): Record<string, unknown> => asRecord(value) ?? {};
const asStringRecord = (value: unknown): Record<string, string> => {
  const record = asRecord(value);
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, entry]) => (typeof entry === 'string' ? [[key, entry]] : [])),
  );
};

const asString = (value: unknown) => String(value || '').trim();

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
    extraHeaders: asStringRecord(provider.extraHeaders),
    model: modelId || asString(profile.model),
  };
};

export const migrateSettingsToProviderRegistry = (settings: SettingsLike): SettingsLike => {
  const next: SettingsLike = { ...settings };
  const providers = getProviderRegistry(next);
  const configs = asRecordOrEmpty(next.configs);
  const migratedConfigs: Record<string, any> = {};

  for (const [name, rawProfile] of Object.entries(configs)) {
    const profile = asRecordOrEmpty(rawProfile);
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
      extraHeaders: asStringRecord(next.extraHeaders),
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
    asRecordOrEmpty(migratedConfigs[activeConfigName]),
  );
  next.provider = asString(activeProfile.provider);
  next.apiKey = asString(activeProfile.apiKey);
  next.model = asString(activeProfile.modelId || activeProfile.model);
  next.customEndpoint = asString(activeProfile.customEndpoint);
  next.extraHeaders = asStringRecord(activeProfile.extraHeaders);
  next.activeConfig = activeConfigName;

  return next;
};
