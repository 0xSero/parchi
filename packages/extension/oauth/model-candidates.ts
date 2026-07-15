import type { OAuthProviderKey } from './types.js';

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
  if (provider === 'xai') return /grok/i.test(lower);
  return true; // permissive for unknown providers or unlisted models (tests and future)
}

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
    ...(discoveredLikelyText.length > 0 ? discoveredLikelyText : discovered),
    ...knownLikelyText,
  ];

  return dedupeModelIds(preferred);
}
