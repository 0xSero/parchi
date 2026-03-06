import { OAUTH_PROVIDERS, fetchProviderModels, getAllProviderStates } from '../../../oauth/manager.js';
import { normalizeOAuthModelIdForProvider } from '../../../oauth/model-normalization.js';
import type { OAuthProviderKey } from '../../../oauth/types.js';
import type { OAuthProviderConfig } from '../../../oauth/types.js';
import type { SidePanelUI } from '../core/panel-ui.js';

const OAUTH_PROFILE_PREFIX = 'oauth:';
const DEFAULT_CONTEXT_LIMIT = 200000;

type SyncOAuthProfilesOptions = {
  fetchModels?: boolean;
  persist?: boolean;
  refreshUi?: boolean;
};

function oauthProfileName(key: string): string {
  return `${OAUTH_PROFILE_PREFIX}${key}`;
}

function isOAuthProfile(name: string): boolean {
  return name.startsWith(OAUTH_PROFILE_PREFIX);
}

function oauthKeyFromProfile(name: string): string | null {
  if (!isOAuthProfile(name)) return null;
  return name.slice(OAUTH_PROFILE_PREFIX.length);
}

export function isRunnableProfileConfig(profile: Record<string, any> | null | undefined): boolean {
  const provider = String(profile?.provider || '').trim();
  const model = String(profile?.model || '').trim();
  return provider.length > 0 && model.length > 0;
}

export function getPreferredConnectedOAuthProfileName(configs: Record<string, any> | null | undefined): string | null {
  const names = Object.keys(configs || {}).filter((name) => {
    if (!isOAuthProfile(name)) return false;
    const profile = (configs || {})[name] as Record<string, any> | null | undefined;
    return isRunnableProfileConfig(profile);
  });
  if (names.length === 0) return null;
  return names.includes('oauth:codex') ? 'oauth:codex' : names[0];
}

export function getPreferredRunnableProfileName(configs: Record<string, any> | null | undefined): string | null {
  const names = Object.keys(configs || {}).filter((name) => {
    const profile = (configs || {})[name] as Record<string, any> | null | undefined;
    return isRunnableProfileConfig(profile);
  });
  if (names.length === 0) return null;
  if (names.includes('oauth:codex')) return 'oauth:codex';
  return names[0];
}

/**
 * Ensures an auto-managed profile exists for each connected OAuth provider.
 * Removes profiles for disconnected providers. Preserves user model choice.
 */
export async function syncOAuthProfiles(ui: SidePanelUI, options: SyncOAuthProfilesOptions = {}): Promise<boolean> {
  const fetchModels = options.fetchModels !== false;
  const persist = options.persist !== false;
  const refreshUi = options.refreshUi !== false;
  const states = await getAllProviderStates();
  const configs = ui.configs || {};
  let changed = false;

  for (const config of Object.values(OAUTH_PROVIDERS)) {
    const profileName = oauthProfileName(config.key);
    const state = states?.[config.key];
    const connected = Boolean(state?.connected && state?.tokens?.accessToken);
    let discoveredModels: string[] = [];

    if (connected && fetchModels) {
      try {
        discoveredModels = await fetchProviderModels(config.key as OAuthProviderKey);
      } catch {
        discoveredModels = [];
      }
    }

    const defaultModel = normalizeOAuthModelIdForProvider(
      config.key,
      discoveredModels[0] || config.models[0]?.id || '',
    );

    if (connected && !configs[profileName]) {
      configs[profileName] = {
        provider: `${config.key}-oauth`,
        apiKey: '',
        model: defaultModel,
        customEndpoint: '',
        extraHeaders: {},
        systemPrompt: ui.getDefaultSystemPrompt?.() || '',
        temperature: 0.7,
        maxTokens: 4096,
        contextLimit:
          config.models.find((model) => model.id === defaultModel)?.contextWindow ||
          config.models[0]?.contextWindow ||
          DEFAULT_CONTEXT_LIMIT,
        timeout: 30000,
      };
      changed = true;
    } else if (connected && configs[profileName]) {
      const existing = configs[profileName] as Record<string, any>;
      const currentModel = String(existing?.model || '').trim();
      const normalizedModel = normalizeOAuthModelIdForProvider(config.key, currentModel);
      const nextModel = normalizedModel || defaultModel;
      if (String(existing?.apiKey || '').trim()) {
        existing.apiKey = '';
        changed = true;
      }
      if (nextModel && nextModel !== currentModel) {
        existing.model = nextModel;
        const matchedContextWindow = config.models.find((model) => model.id === nextModel)?.contextWindow;
        if (matchedContextWindow) {
          existing.contextLimit = matchedContextWindow;
        }
        changed = true;
      }
    } else if (!connected && configs[profileName]) {
      delete configs[profileName];
      if (ui.currentConfig === profileName) {
        ui.currentConfig = 'default';
      }
      changed = true;
    }
  }

  if (changed) {
    ui.configs = configs;
    if (persist) {
      await ui.persistAllSettings?.({ silent: true });
    }
    if (refreshUi) {
      ui.refreshConfigDropdown?.();
      ui.populateModelSelect?.();
    }
  }
  return changed;
}

export function getOAuthConfigForProfile(profileName: string): OAuthProviderConfig | null {
  const key = oauthKeyFromProfile(profileName);
  if (!key) return null;
  return (OAUTH_PROVIDERS as any)[key] || null;
}

export function getOAuthModelsForProvider(providerKey: string): Array<{ id: string; label: string }> {
  const baseKey = providerKey.replace(/-oauth$/, '');
  const config = (OAUTH_PROVIDERS as any)[baseKey];
  if (!config) return [];
  return config.models.map((m: any) => ({ id: m.id, label: m.label }));
}

export function getOAuthProfileNameForProvider(key: string): string {
  return oauthProfileName(key);
}
