// SDK provider settings types
export type SDKModelSettings = {
  provider: string;
  apiKey: string;
  model: string;
  customEndpoint?: string;
  extraHeaders?: Record<string, string>;
  useProxy?: boolean;
  proxyBaseUrl?: string;
  proxyAuthToken?: string;
  proxyProvider?: 'openai' | 'anthropic' | 'kimi' | 'openrouter';
  oauthAccessToken?: string;
  oauthApiBaseUrl?: string;
  oauthApiHeaders?: Record<string, string>;
};
