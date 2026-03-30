type ProviderModelLike = {
  id: string;
  label?: string;
};

type ProviderLike = {
  id: string;
  provider: string;
  models: ProviderModelLike[];
};

const versionAtLeast = (major: number, minor: number, minMajor: number, minMinor: number) =>
  major > minMajor || (major === minMajor && minor >= minMinor);

const parseVersionAfterToken = (value: string, familyTokens: string[]): { major: number; minor: number } | null => {
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .split('-')
    .filter(Boolean);
  const familyIndex = tokens.findIndex((token) => familyTokens.includes(token));
  if (familyIndex === -1) return null;
  const major = Number.parseInt(tokens[familyIndex + 1] || '0', 10);
  const minorToken = tokens[familyIndex + 2] || '';
  const minor = /^\d{1,2}$/.test(minorToken) ? Number.parseInt(minorToken, 10) : 0;
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;
  return { major, minor };
};

export const isDefaultVisibleModel = (providerType: string, modelId: string, label = ''): boolean => {
  const baseProvider = String(providerType || '')
    .replace(/-oauth$/, '')
    .toLowerCase();
  const haystack = `${modelId} ${label}`.toLowerCase();

  if (baseProvider === 'openai' || baseProvider === 'codex') {
    const version = parseVersionAfterToken(haystack, ['gpt']);
    return version ? versionAtLeast(version.major, version.minor, 5, 3) : false;
  }

  if (baseProvider === 'anthropic' || baseProvider === 'claude') {
    const version = parseVersionAfterToken(haystack, ['sonnet', 'opus']);
    return version ? versionAtLeast(version.major, version.minor, 4, 6) : false;
  }

  if (baseProvider === 'copilot') {
    const openAiVersion = parseVersionAfterToken(haystack, ['gpt']);
    if (openAiVersion && versionAtLeast(openAiVersion.major, openAiVersion.minor, 5, 3)) return true;
    const claudeVersion = parseVersionAfterToken(haystack, ['sonnet', 'opus']);
    return claudeVersion ? versionAtLeast(claudeVersion.major, claudeVersion.minor, 4, 6) : false;
  }

  return false;
};

export const getEffectiveVisibleModelKeys = (
  providers: ProviderLike[],
  explicitVisibleModels: string[] | null | undefined,
): string[] => {
  if (Array.isArray(explicitVisibleModels) && explicitVisibleModels.length > 0) {
    return [...new Set(explicitVisibleModels)];
  }

  const defaults: string[] = [];
  for (const provider of providers) {
    const curated = provider.models.filter((model) =>
      isDefaultVisibleModel(provider.provider, model.id, model.label || model.id),
    );
    const selected = curated.length > 0 ? curated : provider.models;
    for (const model of selected) {
      defaults.push(`${provider.id}::${model.id}`);
    }
  }

  return [...new Set(defaults)];
};
