import { DEFAULT_CONNECTION_CONFIG, type ProviderConnectionConfig } from './connection-config.js';

export type { ProviderConnectionConfig } from './connection-config.js';
export {
  DEFAULT_CONNECTION_CONFIG,
  CONNECTION_CONFIG_FIELDS,
  isProviderConnectionConfig,
} from './connection-config.js';

export type {
  ProviderInstance,
  ProviderInstanceAuthType,
  ProviderInstanceBase,
  ProviderModelEntry,
} from './provider-instance.js';
export { extractConnectionFromProvider } from './provider-instance.js';

/**
 * Full profile configuration extending connection config with runtime settings.
 * Used for agent execution and session management.
 */
export interface ProfileConfig extends ProviderConnectionConfig {
  /** Provider instance ID (references ProviderInstance.id) */
  providerId?: string;
  /** Model instance ID (references ProviderModelEntry.id) */
  modelId?: string;
  /** System prompt to prepend to conversations */
  systemPrompt: string;
  /** Temperature for response generation (0.0-2.0) */
  temperature: number;
  /** Maximum tokens in response */
  maxTokens: number;
  /** Maximum context window size */
  contextLimit: number;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Enable automatic screenshot capture */
  enableScreenshots: boolean;
  /** Send screenshots as images instead of base64 */
  sendScreenshotsAsImages: boolean;
  /** Screenshot quality setting */
  screenshotQuality: 'high' | 'low';
  /** Show thinking/reasoning in responses */
  showThinking: boolean;
  /** Stream responses in real-time */
  streamResponses: boolean;
  /** Auto-scroll to new content */
  autoScroll: boolean;
  /** Require confirmation before actions */
  confirmActions: boolean;
  /** Save conversation history */
  saveHistory: boolean;
}

export const DEFAULT_PROFILE: ProfileConfig = {
  ...DEFAULT_CONNECTION_CONFIG,
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: 4096,
  contextLimit: 200000,
  timeout: 30000,
  enableScreenshots: true,
  sendScreenshotsAsImages: false,
  screenshotQuality: 'high',
  showThinking: true,
  streamResponses: true,
  autoScroll: true,
  confirmActions: true,
  saveHistory: true,
};

/**
 * Creates a profile with defaults, applying overrides on top.
 */
export function createProfile(overrides: Partial<ProfileConfig> = {}): ProfileConfig {
  return { ...DEFAULT_PROFILE, ...overrides };
}

/**
 * Resolves a named profile from configs, with optional fallback.
 * Merges: DEFAULT_PROFILE <- fallback <- named profile
 */
export function resolveProfile(
  configs: Record<string, Partial<ProfileConfig>>,
  name: string,
  fallback?: Partial<ProfileConfig>,
): ProfileConfig {
  const base = fallback || {};
  const profile = configs[name] || {};
  return { ...DEFAULT_PROFILE, ...base, ...profile };
}

/**
 * Extracts the connection config portion from a profile.
 * Useful when passing connection details to provider clients.
 */
export function extractConnectionConfig(profile: ProfileConfig): ProviderConnectionConfig {
  return {
    provider: profile.provider,
    model: profile.model,
    apiKey: profile.apiKey,
    customEndpoint: profile.customEndpoint,
    extraHeaders: profile.extraHeaders,
  };
}
