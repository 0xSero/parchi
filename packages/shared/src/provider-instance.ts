import type { ProviderConnectionConfig } from './connection-config.js';

export type ProviderInstanceAuthType = 'api-key' | 'oauth' | 'managed';

export interface ProviderModelEntry {
  id: string;
  label?: string;
  contextWindow?: number;
  supportsVision?: boolean;
  addedManually?: boolean;
}

/**
 * Base connection shape shared between ProviderInstance and ProfileConfig.
 * This type represents the common fields from ProviderConnectionConfig that
 * are used by both ProfileConfig (direct extension) and ProviderInstance (via ProviderInstanceBase).
 *
 * @see ProviderConnectionConfig - The full connection config with all fields required
 * @see ProfileConfig - Extends ProviderConnectionConfig directly for runtime profiles
 * @see ProviderInstanceBase - Uses this base shape for provider storage
 */
export type ProviderInstanceBase = Pick<
  ProviderConnectionConfig,
  'provider' | 'model' | 'apiKey' | 'customEndpoint' | 'extraHeaders'
>;

/**
 * A provider instance represents a configured AI provider connection.
 * Contains connection details, authentication state, and available models.
 *
 * ProviderInstance shares the same base connection shape as ProfileConfig:
 * - Both use provider/model/apiKey/customEndpoint/extraHeaders fields
 * - ProfileConfig extends ProviderConnectionConfig directly (all fields required)
 * - ProviderInstance makes model/apiKey/customEndpoint/extraHeaders optional to support OAuth/managed auth
 * - The 'provider' field is authoritative (canonical) for the provider type
 */
export interface ProviderInstance extends Omit<Partial<ProviderInstanceBase>, 'provider'> {
  /** Unique identifier for this provider instance */
  id: string;
  /** Human-readable name for this provider */
  name: string;
  /**
   * Provider type identifier (e.g., 'openai', 'anthropic', 'openrouter').
   * This is the authoritative (canonical) field for the provider type.
   */
  provider: string;
  /** Authentication method used */
  authType: ProviderInstanceAuthType;
  /** OAuth provider key (for OAuth auth type) */
  oauthProviderKey?: string;
  /** OAuth account email (for OAuth auth type) */
  oauthEmail?: string;
  /** OAuth error message if connection failed */
  oauthError?: string;
  /** Whether the provider is currently connected/authenticated */
  isConnected: boolean;
  /** Available models for this provider */
  models: ProviderModelEntry[];
  /** Whether this provider supports image inputs */
  supportsImages?: boolean;
  /** Timestamp when this instance was created */
  createdAt: number;
  /** Timestamp when this instance was last updated */
  updatedAt: number;
  /** Source of this provider instance */
  source?: 'migration' | 'manual' | 'oauth-sync' | 'factory';
}

/**
 * Gets the provider type from a ProviderInstance.
 * Returns the canonical 'provider' field (alias for backward compatibility).
 */
export const getProviderType = (provider: ProviderInstance): string => provider.provider;

/**
 * Extracts connection config fields from a ProviderInstance.
 * Useful for creating a ProviderConnectionConfig from a provider instance.
 *
 * Uses the authoritative 'provider' field directly.
 */
export function extractConnectionFromProvider(
  provider: ProviderInstance,
  modelId?: string,
): Partial<ProviderConnectionConfig> {
  return {
    provider: provider.provider,
    model: modelId ?? provider.model ?? '',
    apiKey: provider.apiKey ?? '',
    customEndpoint: provider.customEndpoint ?? '',
    extraHeaders: provider.extraHeaders ?? {},
  };
}
