// Shared model-family inference used to route bare (unprefixed) model IDs to their
// OpenRouter-style namespace, e.g. for OpenRouter/Parchi-proxy routing decisions.
export function inferOpenRouterNamespace(modelId: string): string {
  const model = modelId.trim();
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

export function stripRouterPrefix(modelId: string): string {
  let model = modelId.trim();
  if (/^(parchi|openrouter)\//i.test(model)) {
    const parts = model.split('/');
    if (parts.length >= 2) model = parts.slice(1).join('/');
  }
  return model;
}
