// Provider instance registry operations
import type { ProviderInstance, ProviderModelEntry } from '@parchi/shared';
import { normalizeProviderModels } from './instance-models.js';
import { isProviderRegistry, normalizeProviderInstance } from './instance-normalize.js';

type SettingsLike = Record<string, any>;

const asString = (value: unknown) => String(value || '').trim();

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
