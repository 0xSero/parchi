// Per-provider model capability rules (vision support, etc.), used as a fallback
// when a model isn't in a provider's static `models` list with an explicit flag.
import { getProviderDefinition } from './definitions.js';

type VisionRule = true | RegExp;

// Seeded from the provider/model-name heuristics that used to live inline in
// `isVisionModelProfile` (background/model-profiles.ts).
const VISION_RULES: Record<string, VisionRule> = {
  anthropic: true,
  'claude-oauth': true,
  kimi: true,
  glm: /4\.6v|vision/,
  minimax: /vision/,
  'codex-oauth': /gpt-4o|vision/i,
  'copilot-oauth': /gpt-4o|vision/i,
  openrouter: /(claude|gpt-4o|gpt-4-turbo|gemini|vision)/i,
  parchi: /(claude|gpt-4o|gpt-4-turbo|gemini|vision)/i,
  openai: /gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-4-vision|vision/,
  // Not a registered ProviderDefinition, but kept for callers that still pass
  // a bare 'google' provider string.
  google: /(gemini|imagen)/,
};

const DEFAULT_VISION_PATTERN = /vision/;

export interface ModelCapabilities {
  supportsVision: boolean;
}

export function resolveModelCapabilities(provider: string, modelId: string): ModelCapabilities {
  const providerKey = String(provider || '')
    .trim()
    .toLowerCase();
  const model = String(modelId || '')
    .trim()
    .toLowerCase();
  if (!providerKey) return { supportsVision: false };

  const def = getProviderDefinition(providerKey);
  const staticEntry = def?.models?.find((m) => m.id.toLowerCase() === model);
  if (staticEntry && typeof staticEntry.supportsVision === 'boolean') {
    return { supportsVision: staticEntry.supportsVision };
  }

  const rule = VISION_RULES[providerKey];
  if (rule === true) return { supportsVision: true };
  if (rule instanceof RegExp) return { supportsVision: rule.test(model) };

  return { supportsVision: DEFAULT_VISION_PATTERN.test(model) };
}
