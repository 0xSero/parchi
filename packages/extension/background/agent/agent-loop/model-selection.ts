import type { OAuthProviderKey } from '../../../oauth/types.js';

export const OAUTH_PROVIDER_MAP: Record<string, OAuthProviderKey> = {
  'claude-oauth': 'claude',
  'codex-oauth': 'codex',
  'copilot-oauth': 'copilot',
  'qwen-oauth': 'qwen',
};

export function inferModelFamily(modelId: string) {
  const lower = String(modelId || '')
    .trim()
    .toLowerCase();
  if (!lower) return '';
  if (lower.startsWith('claude')) return 'claude';
  if (lower.startsWith('gpt') || /^o\d/.test(lower)) return 'openai';
  if (lower.startsWith('gemini')) return 'gemini';
  if (lower.startsWith('qwen')) return 'qwen';
  if (lower.startsWith('deepseek')) return 'deepseek';
  if (lower.startsWith('grok')) return 'grok';
  return lower.split(/[-_/]/)[0] || '';
}
