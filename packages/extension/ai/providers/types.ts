import type { OAuthProviderConfig, OAuthProviderModel } from '../../oauth/types.js';

export type AuthHeaderStyle = 'x-api-key' | 'bearer';
export type SdkType = 'anthropic' | 'openai' | 'openai-compatible';
export type ProviderConnectionType = 'api-key' | 'oauth' | 'managed';

export interface ProviderDefinition {
  key: string;
  name: string;
  type: ProviderConnectionType;
  sdkType: SdkType;
  defaultBaseUrl: string;
  authHeaderStyle: AuthHeaderStyle;
  supportsModelListing: boolean;
  modelsEndpoint?: string;
  modelListingBaseUrlMode?: 'base' | 'origin';
  defaultHeaders?: Record<string, string>;
  oauth?: OAuthProviderConfig;
  models?: OAuthProviderModel[];
  proxyProvider?: 'openai' | 'anthropic' | 'kimi' | 'openrouter';
  normalizeBaseUrl?: (url: string) => string;
}

export interface ProviderCredentials {
  type: ProviderConnectionType;
  apiKey?: string;
  oauthAccessToken?: string;
  customEndpoint?: string;
  extraHeaders?: Record<string, string>;
}

export interface ModelEntry {
  id: string;
  label?: string;
  contextWindow?: number;
  supportsVision?: boolean;
}
