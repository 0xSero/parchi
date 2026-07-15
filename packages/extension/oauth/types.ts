export type OAuthProviderKey = 'claude' | 'codex' | 'copilot' | 'qwen' | 'xai';

export type OAuthFlowType = 'authorization_code_pkce' | 'device_code' | 'device_code_pkce';

export interface OAuthProviderConfig {
  key: OAuthProviderKey;
  name: string;
  flowType: OAuthFlowType;
  clientId: string;
  authorizeUrl?: string;
  tokenUrl: string;
  scopes: string;
  redirectUri?: string;
  deviceCodeUrl?: string;
  extraAuthorizeParams?: Record<string, string>;
  models: OAuthProviderModel[];
  apiBaseUrl: string;
  apiHeaders?: Record<string, string>;
}

export interface OAuthProviderModel {
  id: string;
  label: string;
  contextWindow?: number;
  supportsVision?: boolean;
}

export interface OAuthTokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  idToken?: string;
  email?: string;
  accountId?: string;
  resourceUrl?: string;
  raw?: Record<string, unknown>;
}

export interface OAuthProviderState {
  provider: OAuthProviderKey;
  connected: boolean;
  tokens?: OAuthTokenSet;
  email?: string;
  lastRefreshedAt?: number;
  error?: string;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
  code_verifier?: string;
}

export type OAuthEventType = 'connected' | 'disconnected' | 'refreshed' | 'error' | 'device_code';

export interface OAuthEvent {
  type: OAuthEventType;
  provider: OAuthProviderKey;
  data?: DeviceCodeResponse | string;
}
