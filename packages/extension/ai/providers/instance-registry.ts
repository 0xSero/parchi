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
  const existingList = normalizeProviderModels(provider.models);
  const existingIndex = existingList.findIndex((item) => item.id === entry.id);
  if (existingIndex >= 0) {
    // update fields if provided in the new entry (e.g. context from API)
    const updated = { ...existingList[existingIndex] };
    if (entry.label !== undefined) updated.label = entry.label;
    if (entry.contextWindow !== undefined) updated.contextWindow = entry.contextWindow;
    if (entry.supportsVision !== undefined) updated.supportsVision = entry.supportsVision;
    if (entry.addedManually !== undefined) updated.addedManually = entry.addedManually;
    const newModels = [...existingList];
    newModels[existingIndex] = updated;
    return { ...provider, models: newModels, updatedAt: Date.now() };
  }
  return { ...provider, models: [...existingList, entry], updatedAt: Date.now() };
};
