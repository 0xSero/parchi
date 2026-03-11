import { OAUTH_PROVIDERS, fetchProviderModels, getAllProviderStates } from '../../../oauth/manager.js';
import { normalizeOAuthModelIdForProvider } from '../../../oauth/model-normalization.js';
import type { OAuthProviderKey } from '../../../oauth/types.js';
import type { OAuthProviderConfig } from '../../../oauth/types.js';
import { mergeProviderModels } from '../../../state/provider-models.js';
import { buildProviderInstanceId, ensureProviderModel } from '../../../state/provider-registry.js';
import type { SidePanelUI } from '../core/panel-ui.js';

const OAUTH_PROFILE_PREFIX = 'oauth:';

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

function providerSyncSignature(provider: Record<string, any> | null | undefined): string {
  return JSON.stringify({
    isConnected: provider?.isConnected === true,
    oauthEmail: String(provider?.oauthEmail || ''),
    oauthError: String(provider?.oauthError || ''),
    models: Array.isArray(provider?.models)
      ? provider.models.map((model: any) => ({
          id: String(model?.id || ''),
          label: String(model?.label || ''),
          contextWindow: Number(model?.contextWindow || 0),
          supportsVision: model?.supportsVision === true,
          addedManually: model?.addedManually === true,
        }))
      : [],
  });
}

/**
 * Ensures an auto-managed profile exists for each connected OAuth provider.
 * Removes profiles for disconnected providers. Preserves user model choice.
 */
export async function syncOAuthProfiles(ui: SidePanelUI): Promise<void> {
  const states = await getAllProviderStates();
  const configs = ui.configs || {};
  const providers = ui.providers || {};
  let changed = false;

  for (const config of Object.values(OAUTH_PROVIDERS)) {
    const profileName = oauthProfileName(config.key);
    const state = states?.[config.key];
    const connected = Boolean(state?.connected && state?.tokens?.accessToken);
    let discoveredModels: string[] = [];

    if (connected) {
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
    const providerId = buildProviderInstanceId({
      provider: `${config.key}-oauth`,
      authType: 'oauth',
      oauthProviderKey: config.key,
      name: config.name,
    });
    const priorProvider = providers[providerId];
    let nextProvider = ensureProviderModel(
      {
        id: providerId,
        name: config.name,
        provider: `${config.key}-oauth`,
        authType: 'oauth',
        oauthProviderKey: config.key,
        oauthEmail: state?.email,
        oauthError: state?.error,
        isConnected: connected,
        models: mergeProviderModels(
          `${config.key}-oauth`,
          config.models || [],
          priorProvider?.models || [],
          discoveredModels,
        ),
        createdAt: Number(priorProvider?.createdAt || Date.now()),
        updatedAt: Date.now(),
        source: priorProvider?.source || 'oauth-sync',
      },
      defaultModel,
    );
    for (const modelId of discoveredModels) {
      const normalizedModelId = normalizeOAuthModelIdForProvider(config.key, modelId);
      if (!normalizedModelId) continue;
      const knownModel = config.models.find((model) => model.id === normalizedModelId);
      nextProvider = ensureProviderModel(nextProvider, {
        id: normalizedModelId,
        label: knownModel?.label,
        contextWindow: knownModel?.contextWindow,
        supportsVision: knownModel?.supportsVision,
      });
    }
    providers[providerId] = nextProvider;
    if (providerSyncSignature(priorProvider) !== providerSyncSignature(nextProvider)) {
      changed = true;
    }

    if (connected && !configs[profileName]) {
      configs[profileName] = {
        providerId,
        modelId: defaultModel,
        providerLabel: config.name,
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
          200000,
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
      if (existing.providerId !== providerId) {
        existing.providerId = providerId;
        existing.providerLabel = config.name;
        changed = true;
      }
      if (nextModel && nextModel !== currentModel) {
        existing.model = nextModel;
        existing.modelId = nextModel;
        // Only set contextLimit from model metadata if the profile doesn't already
        // have a user-customized value — otherwise OAuth sync overwrites user edits
        // on every sidepanel open.
        if (!existing.contextLimit) {
          const matchedContextWindow = config.models.find((model) => model.id === nextModel)?.contextWindow;
          if (matchedContextWindow) {
            existing.contextLimit = matchedContextWindow;
          }
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
    ui.providers = providers;
    await ui.persistAllSettings?.({ silent: true });
    ui.refreshConfigDropdown?.();
    ui.populateModelSelect?.();
    ui.renderModelSelectorGrid?.();
  }
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
