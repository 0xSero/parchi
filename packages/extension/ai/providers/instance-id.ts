// Provider instance ID generation utilities

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'provider';

const hashBasis = (provider: string, authType: string, endpoint: string, key: string, name: string) =>
  `${provider}|${authType}|${endpoint}|${key}|${name}`.toLowerCase();

const asString = (value: unknown) => String(value || '').trim();

export const buildProviderInstanceId = (input: {
  provider: string;
  authType: 'api-key' | 'oauth' | 'managed';
  customEndpoint?: string;
  apiKey?: string;
  oauthProviderKey?: string;
  name?: string;
}) => {
  const basis = hashBasis(
    input.provider,
    input.authType,
    asString(input.customEndpoint),
    input.authType === 'oauth' ? asString(input.oauthProviderKey) : asString(input.apiKey),
    asString(input.name),
  );
  let hash = 2166136261;
  for (let i = 0; i < basis.length; i += 1) {
    hash ^= basis.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${slugify(input.name || input.provider)}-${Math.abs(hash >>> 0).toString(36)}`;
};
