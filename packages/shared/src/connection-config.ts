/**
 * Base connection configuration shared by ProfileConfig and ProviderInstance.
 * Contains the fields needed to establish a connection to an AI provider.
 */
export interface ProviderConnectionConfig {
  /** Provider type identifier (e.g., 'openai', 'anthropic', 'openrouter') */
  provider: string;
  /** Model identifier to use */
  model: string;
  /** API key for authentication (required for api-key auth type) */
  apiKey: string;
  /** Custom API endpoint URL (for self-hosted or proxy servers) */
  customEndpoint: string;
  /** Additional HTTP headers to include in requests */
  extraHeaders: Record<string, string>;
}

/**
 * Default connection configuration values.
 */
export const DEFAULT_CONNECTION_CONFIG: ProviderConnectionConfig = {
  provider: '',
  model: '',
  apiKey: '',
  customEndpoint: '',
  extraHeaders: {},
};

/**
 * Connection config fields that are common between ProfileConfig and ProviderInstance.
 * Used for migration and normalization logic.
 */
export const CONNECTION_CONFIG_FIELDS = [
  'provider',
  'model',
  'apiKey',
  'customEndpoint',
  'extraHeaders',
] as const satisfies (keyof ProviderConnectionConfig)[];

/**
 * Type guard to check if an object has ProviderConnectionConfig shape.
 */
export function isProviderConnectionConfig(value: unknown): value is ProviderConnectionConfig {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.provider === 'string' &&
    typeof obj.model === 'string' &&
    typeof obj.apiKey === 'string' &&
    typeof obj.customEndpoint === 'string' &&
    (obj.extraHeaders === undefined || typeof obj.extraHeaders === 'object')
  );
}
