import type { OAuthProviderKey } from './types.js';

const OAUTH_PROVIDER_MODEL_PREFIX_ALIASES: Record<OAuthProviderKey, string[]> = {
  claude: ['claude', 'anthropic'],
  codex: ['codex', 'openai'],
  copilot: ['copilot', 'github-copilot', 'githubcopilot', 'github'],
  qwen: ['qwen'],
  xai: ['grok', 'xai', 'x.ai'],
};

const normalizeProviderSpecificOAuthModelId = (providerKey: string, modelId: string): string => {
  if (providerKey !== 'copilot') return modelId;
  const lower = modelId.toLowerCase();

  // Copilot accepts Anthropic models using the claude-* slug family.
  // Users often type shorthand like "sonnet-4.6" or "opus-4.6".
  if (/^(sonnet|opus|haiku)-/.test(lower)) {
    return `claude-${modelId}`;
  }

  return modelId;
};

const toBaseProviderKey = (providerKey: string) =>
  providerKey
    .trim()
    .toLowerCase()
    .replace(/-oauth$/i, '');

export function normalizeOAuthModelIdForProvider(providerKey: string, modelId: string): string {
  let model = String(modelId || '').trim();
  if (!model) return '';

  const baseProviderKey = toBaseProviderKey(String(providerKey || ''));
  if (!baseProviderKey) return model;

  if (model.includes('/')) {
    const aliases = OAUTH_PROVIDER_MODEL_PREFIX_ALIASES[baseProviderKey as OAuthProviderKey] || [baseProviderKey];
    const stripPrefixes = new Set([baseProviderKey, ...aliases].map((alias) => alias.toLowerCase()));

    for (let i = 0; i < 2; i += 1) {
      const slashIndex = model.indexOf('/');
      if (slashIndex <= 0) break;
      const prefix = model.slice(0, slashIndex).trim().toLowerCase();
      if (!stripPrefixes.has(prefix)) break;
      model = model.slice(slashIndex + 1).trim();
      if (!model) return '';
    }

    // OAuth providers in this extension use raw model IDs (no provider namespace).
    // If a namespaced ID still remains (e.g., openrouter/vendor/model), keep only
    // the terminal model segment so runtime requests don't send provider/model.
    if (model.includes('/')) {
      const segments = model
        .split('/')
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
      if (segments.length > 0) {
        model = segments[segments.length - 1] || '';
      }
    }
  }

  return normalizeProviderSpecificOAuthModelId(baseProviderKey, model);
}

export function normalizeOAuthModelIdsForProvider(providerKey: string, modelIds: string[]): string[] {
  const normalized = modelIds
    .map((modelId) => normalizeOAuthModelIdForProvider(providerKey, modelId))
    .filter((modelId) => modelId.length > 0);
  return Array.from(new Set(normalized));
}
