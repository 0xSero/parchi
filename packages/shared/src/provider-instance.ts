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
 * Connection fields shared between ProviderInstance and ProviderConnectionConfig.
 * ProviderInstance uses optional fields since not all auth types require all fields.
 *
 * Note: This extends ProviderConnectionConfig but makes all fields optional
 * to support OAuth and managed auth types that don't require explicit configuration.
 */
export interface ProviderInstanceConnection extends Partial<ProviderConnectionConfig> {
  /** Model identifier (optional for provider instances) */
  model?: string;
  /** API key for authentication (optional, required for api-key auth type) */
  apiKey?: string;
  /** Custom API endpoint URL (optional) */
  customEndpoint?: string;
  /** Additional HTTP headers to include in requests */
  extraHeaders?: Record<string, string>;
}

/**
 * A provider instance represents a configured AI provider connection.
 * Contains connection details, authentication state, and available models.
 *
 * The connection fields (model, apiKey, customEndpoint, extraHeaders) correspond
 * to ProviderConnectionConfig but are optional since different auth types
 * require different fields.
 *
 * Note: providerType maps to ProviderConnectionConfig.provider for storage compatibility.
 */
export interface ProviderInstance extends ProviderInstanceConnection {
  /** Unique identifier for this provider instance */
  id: string;
  /** Human-readable name for this provider */
  name: string;
  /** Provider type identifier (e.g., 'openai', 'anthropic', 'openrouter') - maps to ProviderConnectionConfig.provider */
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
 * Note: providerType is mapped to provider for compatibility with ProviderConnectionConfig.
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
