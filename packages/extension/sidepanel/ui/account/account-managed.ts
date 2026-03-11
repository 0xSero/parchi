import { buildProviderInstanceId } from '../../../state/provider-registry.js';
import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

import {
  PARCHI_PAID_DEFAULT_MODEL,
  PARCHI_RUNTIME_STATUS_KEY,
  isManagedProvider,
  isRecord,
  normalizeManagedModelId,
} from './account-formatters.js';
import { ACCOUNT_MODE_KEY, ACCOUNT_MODE_PAID } from './account-mode.js';

const MANAGED_PROFILE_NAME = 'parchi-managed';
export { MANAGED_PROFILE_NAME };

sidePanelProto.ensureManagedProviderDefaults = async function ensureManagedProviderDefaults(
  options: { forceActivate?: boolean } = {},
) {
  const stored = await chrome.storage.local.get([
    'activeConfig',
    'configs',
    'providers',
    'provider',
    'apiKey',
    'model',
    ACCOUNT_MODE_KEY,
    'convexCreditBalanceCents',
    'convexSubscriptionPlan',
    'convexSubscriptionStatus',
  ]);
  const activeConfig = String(stored.activeConfig || 'default');
  const configs = isRecord(stored.configs) ? { ...stored.configs } : {};
  const providers = isRecord(stored.providers) ? { ...stored.providers } : {};
  const mode = String(stored[ACCOUNT_MODE_KEY] || '').toLowerCase();
  const shouldActivateManaged = Boolean(options.forceActivate);
  if (mode !== ACCOUNT_MODE_PAID && !options.forceActivate) return;

  const existingManaged = isRecord(configs[MANAGED_PROFILE_NAME]) ? { ...configs[MANAGED_PROFILE_NAME] } : {};
  const activeProfile = isRecord(configs[activeConfig]) ? { ...configs[activeConfig] } : {};
  const activeProvider = String(activeProfile.provider || '')
    .trim()
    .toLowerCase();
  const activeModelCandidate =
    activeProvider === 'openrouter' || activeProvider === 'parchi' ? String(activeProfile.model || '').trim() : '';
  const existingManagedModel = String(existingManaged.model || '').trim();
  const prefersLegacyManagedDefault = existingManagedModel === 'openai/gpt-4o-mini';
  const resolvedModel = String(
    (existingManagedModel && !prefersLegacyManagedDefault ? existingManagedModel : '') ||
      activeModelCandidate ||
      PARCHI_PAID_DEFAULT_MODEL,
  ).trim();

  const managedProviderId =
    String(existingManaged.providerId || '') ||
    buildProviderInstanceId({
      provider: 'parchi',
      authType: 'managed',
      name: 'Parchi Managed',
    });
  providers[managedProviderId] = {
    id: managedProviderId,
    name: 'Parchi Managed',
    provider: 'parchi',
    authType: 'managed',
    isConnected: true,
    models: [{ id: normalizeManagedModelId(resolvedModel), label: normalizeManagedModelId(resolvedModel) }],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    source: 'manual',
  };

  const managedProfile = {
    ...existingManaged,
    providerId: managedProviderId,
    modelId: normalizeManagedModelId(resolvedModel),
    providerLabel: 'Parchi Managed',
    provider: 'parchi',
    apiKey: '',
    model: normalizeManagedModelId(resolvedModel),
  };
  configs[MANAGED_PROFILE_NAME] = managedProfile;

  const nextActiveConfig = shouldActivateManaged ? MANAGED_PROFILE_NAME : activeConfig;
  const nextActiveProfile = isRecord(configs[nextActiveConfig]) ? configs[nextActiveConfig] : managedProfile;

  await chrome.storage.local.set({
    activeConfig: nextActiveConfig,
    providers,
    configs,
    provider: String(nextActiveProfile.provider || ''),
    apiKey: String(nextActiveProfile.apiKey || ''),
    model: String(nextActiveProfile.model || ''),
  });

  if (!this.configs || typeof this.configs !== 'object') {
    this.configs = {};
  }
  this.configs = {
    ...this.configs,
    ...configs,
  };
  this.providers = {
    ...(this.providers || {}),
    ...providers,
  };
  if (this.configs[MANAGED_PROFILE_NAME]) {
    this.configs[MANAGED_PROFILE_NAME].provider = 'parchi';
    this.configs[MANAGED_PROFILE_NAME].apiKey = '';
    this.configs[MANAGED_PROFILE_NAME].model = managedProfile.model;
  }

  if (shouldActivateManaged && this.currentConfig !== MANAGED_PROFILE_NAME) {
    this.setActiveConfig(MANAGED_PROFILE_NAME, true);
    await this.persistAllSettings({ silent: true });
  } else {
    this.fetchAvailableModels?.();
  }
};

sidePanelProto.setParchiRuntimeHealth = async function setParchiRuntimeHealth(input: {
  level: 'warning' | 'error';
  summary?: string;
  detail?: string;
  category?: string;
}) {
  try {
    const profile = isRecord(this.configs?.[this.currentConfig]) ? this.configs[this.currentConfig] : {};
    const provider = String(profile?.provider || '')
      .trim()
      .toLowerCase();
    if (!isManagedProvider(provider)) return;

    const stored = await chrome.storage.local.get([ACCOUNT_MODE_KEY]);
    const mode = String(stored[ACCOUNT_MODE_KEY] || '')
      .trim()
      .toLowerCase();
    if (mode !== ACCOUNT_MODE_PAID) return;

    const summary = String(input.summary || '').trim();
    const detail = String(input.detail || '').trim();
    await chrome.storage.local.set({
      [PARCHI_RUNTIME_STATUS_KEY]: {
        level: input.level === 'error' ? 'error' : 'warning',
        summary: summary || detail || 'Paid runtime issue detected.',
        detail: detail || summary,
        category: String(input.category || '').trim(),
        at: Date.now(),
      },
    });
    await this.refreshSetupFlowUi?.();
  } catch {
    // Ignore status persistence failures.
  }
};

sidePanelProto.clearParchiRuntimeHealth = async function clearParchiRuntimeHealth() {
  try {
    await chrome.storage.local.remove([PARCHI_RUNTIME_STATUS_KEY]);
    await this.refreshSetupFlowUi?.();
  } catch {
    // Ignore status cleanup failures.
  }
};
