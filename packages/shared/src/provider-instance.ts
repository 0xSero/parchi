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
 * - ProviderInstance makes these fields optional to support OAuth/managed auth
 *
 * Note: The 'provider' field in the base maps to 'providerType' conceptually,
 * but is stored as 'providerType' for historical compatibility.
 */
export interface ProviderInstance extends Partial<ProviderInstanceBase> {
  /** Unique identifier for this provider instance */
  id: string;
  /** Human-readable name for this provider */
  name: string;
  /**
   * Provider type identifier (e.g., 'openai', 'anthropic', 'openrouter').
   * Conceptually maps to ProviderInstanceBase.provider / ProviderConnectionConfig.provider.
   * Stored as 'providerType' for historical storage compatibility.
   */
  providerType: string;
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
 * Extracts connection config fields from a ProviderInstance.
 * Useful for creating a ProviderConnectionConfig from a provider instance.
 *
 * Maps ProviderInstance fields to ProviderConnectionConfig:
 * - providerType → provider (conceptual mapping for storage compatibility)
 * - model, apiKey, customEndpoint, extraHeaders → passed through
 */
export function extractConnectionFromProvider(
  provider: ProviderInstance,
  modelId?: string,
): Partial<ProviderConnectionConfig> {
  return {
    provider: provider.providerType,
    model: modelId ?? provider.model ?? '',
    apiKey: provider.apiKey ?? '',
    customEndpoint: provider.customEndpoint ?? '',
    extraHeaders: provider.extraHeaders ?? {},
  };
}
