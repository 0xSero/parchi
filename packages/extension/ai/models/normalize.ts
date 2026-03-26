/**
 * Unified model ID normalization utilities.
 *
 * All pure model-ID string transformations live here:
 * - OpenRouter vendor prefixing (bare ID -> vendor/model)
 * - OAuth model ID stripping (vendor/model -> bare ID)
 * - Provider-specific fixups (copilot shorthand expansion)
 * - Text-generation model filtering
 */

import type { OAuthProviderKey } from '../../oauth/types.js';

// --- OpenRouter vendor prefixing ---

/**
 * Normalize a model ID for OpenRouter by adding a vendor prefix when missing.
 * e.g. "claude-sonnet-4-20250514" -> "anthropic/claude-sonnet-4-20250514"
 */
export function normalizeOpenRouterModelId(modelId: string): string {
  let model = modelId.trim();
  if (/^(parchi|openrouter)\//i.test(model)) {
    const parts = model.split('/');
    if (parts.length >= 2) {
      model = parts.slice(1).join('/');
    }
  }
  if (!model || model.includes('/')) return model;
  const lower = model.toLowerCase();
  if (lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('o4'))
    return `openai/${model}`;
  if (lower.startsWith('claude')) return `anthropic/${model}`;
  if (lower.startsWith('gemini')) return `google/${model}`;
  if (lower.startsWith('deepseek')) return `deepseek/${model}`;
  if (lower.startsWith('qwen')) return `qwen/${model}`;
  if (lower.includes('llama')) return `meta-llama/${model}`;
  return model;
}

// --- OAuth model ID stripping ---

const OAUTH_PROVIDER_MODEL_PREFIX_ALIASES: Record<OAuthProviderKey, string[]> = {
  claude: ['claude', 'anthropic'],
  codex: ['codex', 'openai'],
  copilot: ['copilot', 'github-copilot', 'githubcopilot', 'github'],
  qwen: ['qwen'],
};

function normalizeProviderSpecificOAuthModelId(providerKey: string, modelId: string): string {
  if (providerKey !== 'copilot') return modelId;
  const lower = modelId.toLowerCase();
  if (/^(sonnet|opus|haiku)-/.test(lower)) {
    return `claude-${modelId}`;
  }
  return modelId;
}

const toBaseProviderKey = (providerKey: string) =>
  providerKey
    .trim()
    .toLowerCase()
    .replace(/-oauth$/i, '');

/**
 * Strip vendor prefixes from a model ID for OAuth providers.
 * OAuth providers use raw model IDs without namespace prefixes.
 * e.g. "anthropic/claude-sonnet-4" -> "claude-sonnet-4"
 */
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

/**
 * Batch-normalize OAuth model IDs, deduplicating results.
 */
export function normalizeOAuthModelIdsForProvider(providerKey: string, modelIds: string[]): string[] {
  const normalized = modelIds
    .map((modelId) => normalizeOAuthModelIdForProvider(providerKey, modelId))
    .filter((modelId) => modelId.length > 0);
  return Array.from(new Set(normalized));
}

// --- Text-generation model filtering ---

const NON_TEXT_MODEL_PATTERNS = [
  /(^|[-_/])embed(ding)?([-.]|$)/i,
  /(^|[-_/])moderation([-.]|$)/i,
  /(^|[-_/])audio([-.]|$)/i,
  /(^|[-_/])speech([-.]|$)/i,
  /(^|[-_/])transcrib(e|ing|er)?([-.]|$)/i,
  /(^|[-_/])whisper([-.]|$)/i,
  /(^|[-_/])tts([-.]|$)/i,
  /(^|[-_/])image([-.]|$)/i,
  /(^|[-_/])dall-?e([-.]|$)/i,
  /(^|[-_/])rerank([-.]|$)/i,
  /(^|[-_/])realtime([-.]|$)/i,
];

const TEXT_MODEL_PREFIX = /^(gpt|chatgpt|o\d|claude|gemini|qwen|deepseek|kimi|llama|mistral|mixtral|grok|phi|command)/i;

/**
 * Heuristic: returns true if the model ID looks like a text-generation model
 * (not embedding, moderation, audio, image, etc.).
 */
export function isLikelyTextGenerationModelId(providerKey: string, modelId: string): boolean {
  const model = String(modelId || '').trim();
  if (!model) return false;
  const lower = model.toLowerCase();
  if (NON_TEXT_MODEL_PATTERNS.some((pattern) => pattern.test(lower))) {
    return false;
  }
  if (TEXT_MODEL_PREFIX.test(lower)) return true;

  const provider = String(providerKey || '')
    .trim()
    .toLowerCase()
    .replace(/-oauth$/, '') as OAuthProviderKey;
  if (provider === 'claude') return lower.includes('claude');
  if (provider === 'qwen') return lower.includes('qwen');
  if (provider === 'codex') return /^gpt|^o\d|codex/i.test(lower);
  if (provider === 'copilot') return /(claude|gpt|gemini|o\d|qwen|deepseek|llama|mistral|grok)/i.test(lower);
  return true;
}

// --- OAuth model candidate prioritization ---

function dedupeModelIds(modelIds: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of modelIds) {
    const trimmed = String(id || '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * Prioritize OAuth model candidates by combining discovered and static model lists.
 * Known models that are available get highest priority, followed by likely text models.
 */
export function prioritizeOAuthModelCandidates(
  providerKey: string,
  discoveredModelIds: string[],
  staticModelIds: string[],
): string[] {
  const discovered = dedupeModelIds(discoveredModelIds);
  const known = dedupeModelIds(staticModelIds);
  if (discovered.length === 0) return known;

  const discoveredSet = new Set(discovered.map((id) => id.toLowerCase()));
  const knownAvailable = known.filter((id) => discoveredSet.has(id.toLowerCase()));
  const knownLikelyText = known.filter((id) => isLikelyTextGenerationModelId(providerKey, id));
  const discoveredLikelyText = discovered.filter((id) => isLikelyTextGenerationModelId(providerKey, id));

  const preferred = [
    ...knownAvailable,
    ...knownLikelyText,
    ...(discoveredLikelyText.length > 0 ? discoveredLikelyText : discovered),
  ];

  return dedupeModelIds(preferred);
}
