import { CONVEX_DEPLOYMENT_URL, getAuthState, hasActiveSubscription, isUsableRuntimeJwt } from '../../../convex/client.js';
import { buildProviderInstanceId } from '../../../state/provider-registry.js';
import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

import { ACCOUNT_MODE_BYOK, ACCOUNT_MODE_KEY, ACCOUNT_MODE_PAID, hasConfiguredByokProvider } from './account-mode.js';
import {
  ACCOUNT_SETUP_STORAGE_KEYS,
  collectCandidateProfiles,
  formatCreditBalance,
  hasConfiguredModel,
  isManagedProvider,
  isRecord,
  MANAGED_PROFILE_NAME,
  normalizeManagedModelId,
  PARCHI_PAID_DEFAULT_MODEL,
  PARCHI_RUNTIME_STATUS_KEY,
  PARCHI_RUNTIME_STATUS_TTL_MS,
  setHidden,
  updateStatusCopy,
} from './account-utils.js';

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

sidePanelProto.getSetupFlowState = async function getSetupFlowState() {
  const stored = await chrome.storage.local.get(ACCOUNT_SETUP_STORAGE_KEYS as unknown as string[]);
  const mode = String(stored[ACCOUNT_MODE_KEY] || '').toLowerCase();
  const hasChoice = mode === ACCOUNT_MODE_BYOK || mode === ACCOUNT_MODE_PAID;
  const hasConfiguredProvider = hasConfiguredByokProvider(stored);
  const profiles = collectCandidateProfiles(stored);
  const hasAnyModel = profiles.some((profile) => hasConfiguredModel(profile));
  const byokReady = profiles.some((profile) => {
    if (!hasConfiguredModel(profile)) return false;
    const provider = String(profile?.provider || '').trim().toLowerCase();
    if (!provider || isManagedProvider(provider)) return false;
    const isOAuth = provider.endsWith('-oauth');
    return isOAuth || Boolean(String(profile?.apiKey || '').trim());
  });
  const activeConfig = String(stored.activeConfig || 'default');
  const configs = isRecord(stored.configs) ? stored.configs : {};
  const activeProfile = isRecord(configs[activeConfig]) ? configs[activeConfig] : {};
  const activeProvider = String(activeProfile.provider || stored.provider || '')
    .trim()
    .toLowerCase();
  const activeModel = String(activeProfile.model || stored.model || '').trim();
  const paidProfiles = profiles.filter((profile) => isManagedProvider(profile?.provider));
  const hasPaidModelConfigured =
    (isManagedProvider(activeProvider) && activeModel.length > 0) ||
    paidProfiles.some((profile) => hasConfiguredModel(profile));

  const hasConvexUrl = Boolean(String(stored.convexUrl || CONVEX_DEPLOYMENT_URL || '').trim());
  const signedInPaid = isUsableRuntimeJwt(stored.convexAccessToken, stored.convexTokenExpiresAt, { minRemainingMs: 0 });
  const creditCents = Number(stored.convexCreditBalanceCents || 0);
  const hasCredits = Number.isFinite(creditCents) && creditCents > 0;
  const subscriptionPlan = String(stored.convexSubscriptionPlan || '').toLowerCase();
  const subscriptionStatus = String(stored.convexSubscriptionStatus || '').toLowerCase();
  const paidActive = subscriptionPlan === 'pro' && subscriptionStatus === 'active';
  const paidAccess = hasCredits || paidActive;
  const runtimeStatusRaw = isRecord(stored[PARCHI_RUNTIME_STATUS_KEY]) ? stored[PARCHI_RUNTIME_STATUS_KEY] : null;
  const runtimeStatusAt = Number(runtimeStatusRaw?.at ?? 0);
  const runtimeStatusFresh =
    Number.isFinite(runtimeStatusAt) &&
    runtimeStatusAt > 0 &&
    Date.now() - runtimeStatusAt <= PARCHI_RUNTIME_STATUS_TTL_MS;
  const runtimeStatus = runtimeStatusFresh
    ? {
        level: String(runtimeStatusRaw?.level || '').toLowerCase(),
        summary: String(runtimeStatusRaw?.summary || '').trim(),
        detail: String(runtimeStatusRaw?.detail || '').trim(),
      }
    : null;

  const paidSetupComplete = hasPaidModelConfigured && hasConvexUrl && signedInPaid && paidAccess;
  let setupComplete = byokReady;
  if (!setupComplete && mode === ACCOUNT_MODE_PAID) {
    setupComplete = paidSetupComplete;
  }

  let setupButtonLabel = 'Pay or add your own key';
  if (mode === ACCOUNT_MODE_BYOK && !setupComplete) {
    setupButtonLabel = 'Finish provider setup';
  } else if (mode === ACCOUNT_MODE_BYOK) {
    setupButtonLabel = 'Provider ready';
  } else if (mode === ACCOUNT_MODE_PAID && !setupComplete) {
    if (!hasConvexUrl) {
      setupButtonLabel = 'Reconnect paid backend';
    } else if (!signedInPaid) {
      setupButtonLabel = 'Sign in to paid mode';
    } else if (!hasPaidModelConfigured) {
      setupButtonLabel = 'Set paid model';
    } else if (!paidAccess) {
      setupButtonLabel = 'Buy credits';
    } else {
      setupButtonLabel = 'Finish paid setup';
    }
  } else if (mode === ACCOUNT_MODE_PAID) {
    setupButtonLabel = runtimeStatus?.level === 'error' ? 'Review paid runtime issue' : 'Parchi managed ready';
  }

  let paidStatusLabel = 'Paid: unavailable';
  let paidStatusDetail = '';
  let paidStatusTone: 'active' | 'warning' | 'error' = 'warning';
  if (!hasConvexUrl) {
    paidStatusLabel = 'Paid: backend unavailable';
    paidStatusDetail = 'CONVEX_URL is missing in this build. Managed routing cannot run.';
    paidStatusTone = 'error';
  } else if (!signedInPaid) {
    paidStatusLabel = 'Paid: sign in required';
    paidStatusDetail = 'Sign in from Account & Billing to enable managed routing.';
    paidStatusTone = 'warning';
  } else if (!hasPaidModelConfigured) {
    paidStatusLabel = 'Paid: model missing';
    paidStatusDetail = 'Choose a model in your active paid profile (Parchi/OpenRouter).';
    paidStatusTone = 'warning';
  } else if (!paidAccess) {
    paidStatusLabel = 'Paid: no credits';
    paidStatusDetail = 'Buy credits to continue using managed routing.';
    paidStatusTone = 'warning';
  } else if (runtimeStatus?.level === 'error') {
    paidStatusLabel = 'Paid: runtime error';
    paidStatusDetail = runtimeStatus.summary || runtimeStatus.detail || 'Latest paid run failed.';
    paidStatusTone = 'error';
  } else if (runtimeStatus?.level === 'warning') {
    paidStatusLabel = 'Paid: degraded';
    paidStatusDetail = runtimeStatus.summary || runtimeStatus.detail || 'Latest paid run had warnings.';
    paidStatusTone = 'warning';
  } else if (paidActive) {
    paidStatusLabel = 'Paid: active';
    paidStatusDetail = 'Managed routing is online via your paid plan.';
    paidStatusTone = 'active';
  } else if (hasCredits) {
    paidStatusLabel = `Paid: ${formatCreditBalance(creditCents)} credits`;
    paidStatusDetail = 'Managed routing is online via prepaid credits.';
    paidStatusTone = 'active';
  }

  return {
    mode,
    hasChoice,
    hasConfiguredProvider,
    hasAnyModel,
    byokReady,
    paidAccess,
    paidActive,
    hasConvexUrl,
    signedInPaid,
    paidSetupComplete,
    setupComplete,
    setupButtonLabel,
    paidStatusLabel,
    paidStatusDetail,
    paidStatusTone,
  };
};

sidePanelProto.refreshSetupFlowUi = async function refreshSetupFlowUi() {
  const setupState = await this.getSetupFlowState();
  const showSetupButton = !setupState.setupComplete;
  setHidden(this.elements.setupAccessBtn, !showSetupButton);
  setHidden(this.elements.modelSelectorWrap, showSetupButton);

  if (this.elements.setupAccessBtn) {
    this.elements.setupAccessBtn.textContent = setupState.setupButtonLabel;
    this.elements.setupAccessBtn.title = setupState.setupButtonLabel;
  }

  await this.renderPaidModeProviderGrid?.();
  this.updateActivityState?.();
};

sidePanelProto.renderPaidModeProviderGrid = async function renderPaidModeProviderGrid() {
  const grid = this.elements.paidModeProviderGrid || document.getElementById('paidModeProviderGrid');
  if (!grid) return;

  const setupState = await this.getSetupFlowState();
  const row = document.createElement('div');
  const connected = setupState.signedInPaid === true && setupState.paidAccess === true;
  row.className = `provider-row${connected ? ' connected' : ' dim'}`;
  row.innerHTML = `
    <span class="provider-logo">☻</span>
    <div class="provider-info">
      <div class="provider-name">Parchi Managed <span class="optional-badge">Optional</span></div>
      <div class="provider-meta">${this.escapeHtml(setupState.paidStatusLabel || 'Paid mode')}</div>
    </div>
    <span class="provider-status-dot${connected ? '' : ' off'}"></span>
    <button class="connect-btn" data-action="open-account">${connected ? 'Manage' : 'Open billing'}</button>
  `;

  grid.innerHTML = '';
  grid.appendChild(row);
  row.addEventListener('click', async (event: Event) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
    if (action !== 'open-account') return;
    this.openAccountPanel?.();
    if (!setupState.signedInPaid || !setupState.paidSetupComplete) {
      this.updateStatus(
        'Paid mode is optional. Sign in or buy credits from Account & Billing if you want managed routing.',
        'active',
      );
    }
  });
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

sidePanelProto.handleSetupAccessClick = async function handleSetupAccessClick() {
  const setupState = await this.getSetupFlowState();
  if (!setupState.hasChoice && !setupState.hasConfiguredProvider) {
    setHidden(this.elements.accountOnboardingModal, false);
    this.updateStatus('Choose paid access or add your own API key to continue.', 'warning');
    updateStatusCopy(this, 'Choose paid access or add your own API key to continue.');
    return;
  }

  if (setupState.mode === ACCOUNT_MODE_PAID) {
    this.openAccountPanel?.();
    this.updateStatus('Finish paid setup in Account & Billing to unlock Parchi managed access.', 'active');
    return;
  }

  this.openSettingsPanel?.();
  this.switchSettingsTab?.('setup');
  this.updateStatus('Finish provider setup by adding your API key and model.', 'active');
};

sidePanelProto.showAccountOnboardingIfNeeded = async function showAccountOnboardingIfNeeded() {
  const stored = await chrome.storage.local.get(ACCOUNT_SETUP_STORAGE_KEYS as unknown as string[]);
  const hasChoice = stored[ACCOUNT_MODE_KEY] === ACCOUNT_MODE_BYOK || stored[ACCOUNT_MODE_KEY] === ACCOUNT_MODE_PAID;
  if (hasChoice) {
    setHidden(this.elements.accountOnboardingModal, true);
    await this.refreshSetupFlowUi();
    return;
  }

  const hasConfiguredProvider = hasConfiguredByokProvider(stored);
  if (hasConfiguredProvider) {
    await chrome.storage.local.set({ [ACCOUNT_MODE_KEY]: ACCOUNT_MODE_BYOK });
    setHidden(this.elements.accountOnboardingModal, true);
    await this.refreshSetupFlowUi();
    return;
  }

  updateStatusCopy(this, 'Choose paid access or add your own API key to continue.');
  this.updateStatus('Pay or add your own API key to continue.', 'warning');
  // Keep onboarding non-blocking by default; setup button opens guided flow when needed.
  setHidden(this.elements.accountOnboardingModal, true);
  await this.refreshSetupFlowUi();
};

sidePanelProto.chooseAccountMode = async function chooseAccountMode(mode: 'byok' | 'paid') {
  await chrome.storage.local.set({ [ACCOUNT_MODE_KEY]: mode });
  if (mode === ACCOUNT_MODE_BYOK) {
    await chrome.storage.local.remove([PARCHI_RUNTIME_STATUS_KEY]);
  }
  setHidden(this.elements.accountOnboardingModal, true);
  if (mode === ACCOUNT_MODE_BYOK) {
    this.openSettingsPanel?.();
    this.switchSettingsTab?.('setup');
    this.updateStatus('Provider setup selected. Add your API key and model in Setup.', 'success');
    updateStatusCopy(this, 'Add provider mode selected. Enter API key + model to finish setup.');
    await this.refreshSetupFlowUi();
    return;
  }
  this.openSettingsPanel?.();
  this.switchSettingsTab?.('oauth');
  await this.ensureManagedProviderDefaults({ forceActivate: true });
  this.updateStatus('Parchi managed mode selected. Sign in, then buy credits to continue.', 'active');
  updateStatusCopy(this, 'Sign in, then buy credits to activate Parchi managed access.');
  await this.refreshSetupFlowUi();
};

sidePanelProto.initAccountPanel = async function initAccountPanel() {
  this.bindAccountEventListeners();
  await this.refreshAccountPanel({ silent: true });
  await this.showAccountOnboardingIfNeeded();
  await this.refreshSetupFlowUi();
  this.renderOAuthProviderGrid?.();
};
