// Provider model normalization and merging utilities
import type { ProviderModelEntry } from '@parchi/shared';
import { OAUTH_PROVIDERS } from '../../oauth/providers.js';
import type { OAuthProviderKey } from '../../oauth/types.js';
import { getProviderDefinition } from './definitions.js';

const asString = (value: unknown) => String(value || '').trim();

export const normalizeProviderModels = (models: unknown, fallbackModelId = ''): ProviderModelEntry[] => {
  const out: ProviderModelEntry[] = [];
  const seen = new Set<string>();
  const pushModel = (entry: ProviderModelEntry | null | undefined) => {
    const id = asString(entry?.id);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      label: asString(entry?.label) || undefined,
      contextWindow: Number.isFinite(Number(entry?.contextWindow)) ? Number(entry?.contextWindow) : undefined,
      supportsVision: entry?.supportsVision === true,
      addedManually: entry?.addedManually === true,
    });
  };

  if (Array.isArray(models)) {
    for (const model of models) {
      if (typeof model === 'string') {
        pushModel({ id: model });
        continue;
      }
      pushModel(model as ProviderModelEntry);
    }
  }

  if (fallbackModelId) {
    pushModel({ id: fallbackModelId, addedManually: true });
  }

  return out;
};

const getDefinitionModelsForProviderType = (providerType: string): ProviderModelEntry[] => {
  const normalizedProviderType = asString(providerType).toLowerCase();
  if (!normalizedProviderType) return [];
  const baseKey = normalizedProviderType.replace(/-oauth$/, '') as OAuthProviderKey;
  const def = getProviderDefinition(normalizedProviderType);
  const oauthDef = OAUTH_PROVIDERS[baseKey];
  return normalizeProviderModels(def?.models || oauthDef?.models);
};

export const mergeProviderModels = (providerType: string, ...sources: unknown[]): ProviderModelEntry[] => {
  const merged: ProviderModelEntry[] = [];
  const indexById = new Map<string, number>();

  for (const source of [getDefinitionModelsForProviderType(providerType), ...sources]) {
    for (const model of normalizeProviderModels(source)) {
      const existingIndex = indexById.get(model.id);
      if (existingIndex === undefined) {
        indexById.set(model.id, merged.length);
        merged.push(model);
        continue;
      }

      const existing = merged[existingIndex];
      merged[existingIndex] = {
        ...existing,
        label: existing.label || model.label,
        contextWindow: existing.contextWindow ?? model.contextWindow,
        supportsVision: existing.supportsVision === true || model.supportsVision === true,
        addedManually: existing.addedManually === true || model.addedManually === true,
      };
    }
  }

  return merged;
};
