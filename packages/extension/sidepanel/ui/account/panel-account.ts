import {
  CONVEX_DEPLOYMENT_URL,
  createCreditCheckout,
  getAuthState,
  hasActiveSubscription,
  isUsableRuntimeJwt,
  manageSubscription,
  signInWithOAuth,
  signInWithPassword,
  signOutAccount,
  signUpWithPassword,
} from '../../../convex/client.js';
import { buildProviderInstanceId } from '../../../state/provider-registry.js';
import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

import { ACCOUNT_MODE_BYOK, ACCOUNT_MODE_KEY, ACCOUNT_MODE_PAID, hasConfiguredByokProvider } from './account-mode.js';

const setHidden = (element: Element | null | undefined, hidden: boolean) => {
  if (!element) return;
  element.classList.toggle('hidden', hidden);
};

const toUsageLabel = (usage: unknown) => {
  const u = usage as { requestCount?: unknown; tokensUsed?: unknown };
  const requestCount = Number(u?.requestCount || 0);
  const tokensUsed = Number(u?.tokensUsed || 0);
  return `${requestCount} req · ${tokensUsed} tokens`;
};

const formatCreditBalance = (cents: number) => {
  const dollars = (cents / 100).toFixed(2);
  return `$${dollars}`;
};

const formatSignedCurrency = (cents: number, direction: 'credit' | 'debit') => {
  const sign = direction === 'credit' ? '+' : '-';
  return `${sign}${formatCreditBalance(cents)}`;
};

const toReadableTransactionType = (type: string) =>
  String(type || '')
    .replace(/^proxy_/, 'proxy ')
    .replace(/^stripe_/, 'stripe ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

const toTimestampLabel = (timestamp: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '-';
  try {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } catch {
    return '-';
  }
};

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const CREDIT_REFRESH_POLL_MS = 5000;
const CREDIT_REFRESH_ATTEMPTS = 24;
const MANAGED_PROFILE_NAME = 'parchi-managed';
const PARCHI_PAID_DEFAULT_MODEL = 'moonshotai/kimi-k2.5';
const LEGACY_MANAGED_DEFAULT_MODEL = 'openai/gpt-4o-mini';
const PARCHI_RUNTIME_STATUS_KEY = 'parchiRuntimeStatus';
const PARCHI_RUNTIME_STATUS_TTL_MS = 30 * 60 * 1000;
const ACCOUNT_SETUP_STORAGE_KEYS = [
  ACCOUNT_MODE_KEY,
  'configs',
  'activeConfig',
  'provider',
  'apiKey',
  'model',
  'customEndpoint',
  'convexUrl',
  'convexAccessToken',
  'convexCreditBalanceCents',
  'convexSubscriptionPlan',
  'convexSubscriptionStatus',
  PARCHI_RUNTIME_STATUS_KEY,
] as const;

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

const normalizeManagedModelId = (modelId: string) => {
  let model = String(modelId || '').trim();
  if (/^(parchi|openrouter)\//i.test(model)) {
    const parts = model.split('/');
    if (parts.length >= 2) {
      model = parts.slice(1).join('/');
    }
  }
  if (!model) return PARCHI_PAID_DEFAULT_MODEL;
  if (model.includes('/')) return model;
  const lower = model.toLowerCase();
  if (lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('o4')) {
    return `openai/${model}`;
  }
  if (lower.startsWith('claude')) return `anthropic/${model}`;
  if (lower.startsWith('gemini')) return `google/${model}`;
  if (lower.startsWith('deepseek')) return `deepseek/${model}`;
  if (lower.startsWith('qwen')) return `qwen/${model}`;
  if (lower.includes('llama')) return `meta-llama/${model}`;
  return model;
};

const hasConfiguredModel = (profile: Record<string, any> | null | undefined) =>
  Boolean(String(profile?.model || '').trim());

const hasConfiguredApiKey = (profile: Record<string, any> | null | undefined) =>
  Boolean(String(profile?.apiKey || '').trim());

const isOAuthProvider = (provider: unknown) =>
  String(provider || '')
    .trim()
    .toLowerCase()
    .endsWith('-oauth');

const hasRunnableExternalProfile = (profile: Record<string, any> | null | undefined) => {
  if (!hasConfiguredModel(profile)) return false;
  const provider = String(profile?.provider || '')
    .trim()
    .toLowerCase();
  if (!provider || isManagedProvider(provider)) return false;
  if (isOAuthProvider(provider)) return true;
  return hasConfiguredApiKey(profile);
};

const hasRunnableByokProfile = (profiles: Array<Record<string, any>>) =>
  profiles.some((profile) => hasRunnableExternalProfile(profile));

const collectCandidateProfiles = (stored: Record<string, any>) => {
  const configs = isRecord(stored.configs) ? stored.configs : {};
  const configProfiles = Object.values(configs).filter((profile) => isRecord(profile)) as Array<Record<string, any>>;
  const topLevelProfile = {
    provider: stored.provider,
    apiKey: stored.apiKey,
    model: stored.model,
    customEndpoint: stored.customEndpoint,
  };
  return [...configProfiles, topLevelProfile];
};

const isManagedProvider = (provider: unknown) => {
  const normalized = String(provider || '')
    .trim()
    .toLowerCase();
  return normalized === 'parchi' || normalized === 'openrouter';
};

const updateStatusCopy = (ui: any, text: string) => {
  if (ui.elements.accountStatusText) {
    ui.elements.accountStatusText.textContent = text;
  }
  const signedInStatus = document.getElementById('accountStatusTextSignedIn');
  if (signedInStatus) {
    signedInStatus.textContent = text;
  }
};

const renderLedgerRows = (container: HTMLElement | null | undefined, transactions: any[]) => {
  if (!container) return;
  container.innerHTML = '';
  if (!Array.isArray(transactions) || transactions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'account-ledger-empty';
    empty.textContent = 'No transactions yet.';
    container.appendChild(empty);
    return;
  }

  transactions.slice(0, 12).forEach((transaction) => {
    const amountCents = Number(transaction?.amountCents ?? 0);
    const direction = String(transaction?.direction || 'debit') === 'credit' ? 'credit' : 'debit';
    const row = document.createElement('div');
    row.className = 'account-ledger-row';

    const time = document.createElement('div');
    time.className = 'account-ledger-time';
    time.textContent = toTimestampLabel(Number(transaction?.createdAt ?? 0));

    const main = document.createElement('div');
    main.className = 'account-ledger-main';
    const type = document.createElement('div');
    type.className = 'account-ledger-type';
    type.textContent = toReadableTransactionType(String(transaction?.type || 'unknown'));
    const status = String(transaction?.status || '').toUpperCase();
    const provider = String(transaction?.provider || '').trim();
    const tokenActual = Number(transaction?.tokenActual ?? 0);
    const tokenEstimate = Number(transaction?.tokenEstimate ?? 0);
    const tokenPart = tokenActual > 0 ? `${tokenActual} tokens` : tokenEstimate > 0 ? `~${tokenEstimate} tokens` : '';
    const providerPart = provider ? provider : '';
    const meta = [status, providerPart, tokenPart].filter((part) => part.length > 0).join(' · ');
    const metaRow = document.createElement('div');
    metaRow.className = 'account-ledger-meta';
    metaRow.textContent = meta || ' ';
    main.appendChild(type);
    main.appendChild(metaRow);

    const amount = document.createElement('div');
    amount.className = `account-ledger-amount ${direction}`;
    amount.textContent = formatSignedCurrency(amountCents, direction);

    row.appendChild(time);
    row.appendChild(main);
    row.appendChild(amount);
    container.appendChild(row);
  });
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

const normalizeTimestampMs = (value: unknown) => {
  const raw = Number(value || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw > 10_000_000_000 ? raw : raw * 1000;
};

const dayStartMs = (value: number) => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const buildSpendSeries = (transactions: any[], days = 7) => {
  const now = Date.now();
  const points: Array<{ key: number; label: string; cents: number }> = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now - offset * 24 * 60 * 60 * 1000);
    const key = dayStartMs(date.getTime());
    const label = date.toLocaleDateString([], { weekday: 'short' }).slice(0, 1);
    points.push({ key, label, cents: 0 });
  }

  const byDay = new Map(points.map((point) => [point.key, point]));
  for (const transaction of Array.isArray(transactions) ? transactions : []) {
    const direction = String(transaction?.direction || '').toLowerCase();
    const status = String(transaction?.status || '').toLowerCase();
    if (direction !== 'debit' || status === 'denied') continue;
    const amountCents = Math.max(0, Number(transaction?.amountCents ?? 0));
    const createdAtMs = normalizeTimestampMs(transaction?.createdAt);
    if (!amountCents || !createdAtMs) continue;
    const dayKey = dayStartMs(createdAtMs);
    const point = byDay.get(dayKey);
    if (point) point.cents += amountCents;
  }

  return points;
};

const renderSpendBars = (
  container: HTMLElement | null | undefined,
  points: Array<{ key: number; label: string; cents: number }>,
) => {
  if (!container) return;
  container.innerHTML = '';
  const maxCents = points.reduce((max, point) => Math.max(max, point.cents), 0);
  points.forEach((point) => {
    const bar = document.createElement('div');
    bar.className = 'account-spend-bar';
    const fill = document.createElement('span');
    fill.className = 'account-spend-bar-fill';
    const ratio = maxCents > 0 ? point.cents / maxCents : 0;
    const heightPercent = point.cents > 0 ? Math.max(8, Math.round(ratio * 100)) : 4;
    fill.style.height = `${heightPercent}%`;
    fill.title = `${new Date(point.key).toLocaleDateString()}: ${formatCreditBalance(point.cents)}`;
    const label = document.createElement('span');
    label.className = 'account-spend-bar-label';
    label.textContent = point.label;
    bar.appendChild(fill);
    bar.appendChild(label);
    container.appendChild(bar);
  });
};

const renderUsageCharts = (
  ui: any,
  options: {
    transactions: any[];
    usage: any;
  },
) => {
  const transactions = Array.isArray(options.transactions) ? options.transactions : [];
  const usage = options.usage || {};

  const cutoff30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let debit30d = 0;
  let credit30d = 0;
  for (const transaction of transactions) {
    const createdAtMs = normalizeTimestampMs(transaction?.createdAt);
    if (!createdAtMs || createdAtMs < cutoff30d) continue;
    const amountCents = Math.max(0, Number(transaction?.amountCents ?? 0));
    if (!amountCents) continue;
    const direction = String(transaction?.direction || '').toLowerCase();
    const status = String(transaction?.status || '').toLowerCase();
    if (direction === 'credit') {
      credit30d += amountCents;
    } else if (direction === 'debit' && status !== 'denied') {
      debit30d += amountCents;
    }
  }

  const flowTotal = Math.max(1, debit30d + credit30d);
  const debitWidth = clampPercent((debit30d / flowTotal) * 100);
  const creditWidth = clampPercent((credit30d / flowTotal) * 100);
  if (ui.elements.accountCreditDebitFill) {
    ui.elements.accountCreditDebitFill.style.width = `${debitWidth}%`;
  }
  if (ui.elements.accountCreditCreditFill) {
    ui.elements.accountCreditCreditFill.style.width = `${creditWidth}%`;
  }
  if (ui.elements.accountCreditFlowLabel) {
    ui.elements.accountCreditFlowLabel.textContent = `${formatCreditBalance(debit30d)} / ${formatCreditBalance(credit30d)}`;
  }

  const spendSeries = buildSpendSeries(transactions, 7);
  const spendTotal = spendSeries.reduce((sum, point) => sum + point.cents, 0);
  renderSpendBars(ui.elements.accountSpend7dChart, spendSeries);
  if (ui.elements.accountSpend7dTotal) {
    ui.elements.accountSpend7dTotal.textContent = formatCreditBalance(spendTotal);
  }

  const requestCount = Math.max(0, Number(usage?.requestCount || 0));
  const tokensUsed = Math.max(0, Number(usage?.tokensUsed || 0));
  const requestDensity = clampPercent((Math.log10(requestCount + 1) / 3) * 100);
  const tokenDensity = clampPercent((Math.log10(tokensUsed + 1) / 6) * 100);

  if (ui.elements.accountRequestDensityFill) {
    ui.elements.accountRequestDensityFill.style.width = `${requestCount > 0 ? Math.max(6, requestDensity) : 0}%`;
  }
  if (ui.elements.accountTokenDensityFill) {
    ui.elements.accountTokenDensityFill.style.width = `${tokensUsed > 0 ? Math.max(6, tokenDensity) : 0}%`;
  }
  if (ui.elements.accountDensityLabel) {
    ui.elements.accountDensityLabel.textContent = `${requestCount} req / ${tokensUsed} tok`;
  }
};

sidePanelProto.setAccountUiBusy = function setAccountUiBusy(busy: boolean) {
  const buttonIds = [
    'accountSignInBtn',
    'accountSignUpBtn',
    'accountGoogleBtn',
    'accountGithubBtn',
    'accountUpgradeBtn',
    'accountManageBtn',
    'accountRefreshBtn',
    'accountSignOutBtn',
    'accountChooseByokBtn',
    'accountChoosePaidBtn',
    'setupAccessBtn',
  ];
  buttonIds.forEach((id) => {
    const button = this.elements[id] as HTMLButtonElement | null;
    if (button) {
      button.disabled = busy;
    }
  });
};

sidePanelProto.bindAccountEventListeners = function bindAccountEventListeners() {
  if (this._accountListenersBound) return;
  this._accountListenersBound = true;

  this.elements.accountChooseByokBtn?.addEventListener('click', () => {
    void this.chooseAccountMode(ACCOUNT_MODE_BYOK);
  });
  this.elements.accountChoosePaidBtn?.addEventListener('click', () => {
    void this.chooseAccountMode(ACCOUNT_MODE_PAID);
  });
  this.elements.accountSignInBtn?.addEventListener('click', () => {
    void this.handleAccountPasswordAuth('signIn');
  });
  this.elements.accountSignUpBtn?.addEventListener('click', () => {
    void this.handleAccountPasswordAuth('signUp');
  });
  this.elements.accountGoogleBtn?.addEventListener('click', () => {
    void this.handleAccountOAuth('google');
  });
  this.elements.accountGithubBtn?.addEventListener('click', () => {
    void this.handleAccountOAuth('github');
  });
  this.elements.accountUpgradeBtn?.addEventListener('click', () => {
    void this.startAccountCheckout();
  });
  this.elements.accountManageBtn?.addEventListener('click', () => {
    void this.openAccountBillingPortal();
  });
  this.elements.accountRefreshBtn?.addEventListener('click', () => {
    void this.refreshAccountPanel();
  });
  this.elements.accountSignOutBtn?.addEventListener('click', () => {
    void this.signOutFromAccount();
  });

  // Credit buy buttons (delegated from the row)
  this.elements.accountBuyCreditsRow?.addEventListener('click', (e: Event) => {
    const btn = (e.target as HTMLElement)?.closest('.credit-buy-btn') as HTMLElement | null;
    if (!btn) return;
    const cents = Number(btn.dataset.cents || 0);
    if (cents > 0) void this.startCreditCheckout(cents);
  });
};

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
  const prefersLegacyManagedDefault = existingManagedModel === LEGACY_MANAGED_DEFAULT_MODEL;
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
  const byokReady = hasRunnableByokProfile(profiles);
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

sidePanelProto.initAccountPanel = async function initAccountPanel() {
  this.bindAccountEventListeners();
  await this.refreshAccountPanel({ silent: true });
  await this.showAccountOnboardingIfNeeded();
  await this.refreshSetupFlowUi();
  this.renderOAuthProviderGrid?.();
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

sidePanelProto.handleAccountPasswordAuth = async function handleAccountPasswordAuth(mode: 'signIn' | 'signUp') {
  const email = String(this.elements.accountEmailInput?.value || '').trim();
  const password = String(this.elements.accountPasswordInput?.value || '').trim();
  if (!email || !password) {
    updateStatusCopy(this, 'Email and password are required.');
    return;
  }

  this.setAccountUiBusy(true);
  try {
    if (mode === 'signIn') {
      await signInWithPassword(email, password);
    } else {
      await signUpWithPassword(email, password);
    }
    await chrome.storage.local.set({ [ACCOUNT_MODE_KEY]: ACCOUNT_MODE_PAID });
    await this.refreshAccountPanel();
    this.updateStatus(mode === 'signIn' ? 'Signed in' : 'Account created', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'Unknown auth error');
    updateStatusCopy(this, message);
    this.updateStatus('Authentication failed', 'error');
  } finally {
    this.setAccountUiBusy(false);
    await this.refreshSetupFlowUi();
  }
};

sidePanelProto.handleAccountOAuth = async function handleAccountOAuth(provider: 'google' | 'github') {
  this.setAccountUiBusy(true);
  const previousStoredMode = await chrome.storage.local.get([ACCOUNT_MODE_KEY]);
  const previousMode = String(previousStoredMode[ACCOUNT_MODE_KEY] || '').toLowerCase();
  let keepPaidMode = false;
  try {
    // OAuth is the paid/proxy path.
    await chrome.storage.local.set({ [ACCOUNT_MODE_KEY]: ACCOUNT_MODE_PAID });
    const result = await signInWithOAuth(provider);

    if (result?.completed) {
      keepPaidMode = true;
      await this.refreshAccountPanel({ silent: true });
      updateStatusCopy(this, `${provider} sign-in complete. Buy credits to enable Parchi managed access.`);
      this.updateStatus('Signed in with OAuth', 'success');
      return;
    }

    keepPaidMode = true;
    const redirect = String(result?.redirect || '');
    if (redirect) {
      await chrome.tabs.create({ url: redirect });
      updateStatusCopy(this, `Opened ${provider} sign-in. Complete login in the new tab, then click Refresh.`);
    } else {
      updateStatusCopy(this, `Started ${provider} sign-in flow.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'OAuth failed');
    updateStatusCopy(this, message);
    this.updateStatus('OAuth failed', 'error');
  } finally {
    if (!keepPaidMode) {
      if (previousMode === ACCOUNT_MODE_BYOK || previousMode === ACCOUNT_MODE_PAID) {
        await chrome.storage.local.set({ [ACCOUNT_MODE_KEY]: previousMode });
      } else {
        await chrome.storage.local.remove([ACCOUNT_MODE_KEY]);
      }
    }
    this.setAccountUiBusy(false);
    await this.refreshSetupFlowUi();
  }
};

sidePanelProto.startAccountCheckout = async function startAccountCheckout() {
  // Default upgrade goes to $15 credit pack
  return this.startCreditCheckout(1500);
};

sidePanelProto.pollForCreditBalanceIncrease = async function pollForCreditBalanceIncrease(initialCreditCents: number) {
  const runId = Number(this._creditRefreshRunId || 0) + 1;
  this._creditRefreshRunId = runId;

  for (let attempt = 0; attempt < CREDIT_REFRESH_ATTEMPTS; attempt += 1) {
    await delay(CREDIT_REFRESH_POLL_MS);
    if (this._creditRefreshRunId !== runId) return;

    try {
      const state = await getAuthState({
        reconcileCredits: true,
        forceCreditReconcile: attempt === 0 || attempt === CREDIT_REFRESH_ATTEMPTS - 1,
      });
      const currentCredits = Number(state.subscription?.creditBalanceCents ?? 0);
      if (currentCredits > initialCreditCents) {
        await this.refreshAccountPanel({ silent: true });
        updateStatusCopy(this, `Credits applied. New balance: ${formatCreditBalance(currentCredits)}.`);
        this.updateStatus('Credits synced', 'success');
        return;
      }
    } catch {
      // Ignore polling failures and continue attempts.
    }
  }

  if (this._creditRefreshRunId === runId) {
    updateStatusCopy(this, 'Checkout completed. If balance is unchanged, click Refresh to sync credits.');
  }
};

sidePanelProto.startCreditCheckout = async function startCreditCheckout(packageCents: number) {
  this.setAccountUiBusy(true);
  try {
    const currentState = await getAuthState({ reconcileCredits: true });
    if (!currentState.authenticated) {
      throw new Error('Sign in first, then buy credits for Parchi managed access.');
    }
    const initialCreditCents = Number(currentState.subscription?.creditBalanceCents ?? 0);
    const result = await createCreditCheckout(packageCents);
    if (result?.url) {
      await chrome.tabs.create({ url: String(result.url) });
      updateStatusCopy(this, 'Stripe checkout opened. Waiting for payment confirmation...');
      void this.pollForCreditBalanceIncrease(initialCreditCents);
    } else {
      throw new Error('Checkout URL was not returned.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'Checkout failed');
    updateStatusCopy(this, message);
    this.updateStatus('Unable to open checkout', 'error');
  } finally {
    this.setAccountUiBusy(false);
  }
};

sidePanelProto.openAccountBillingPortal = async function openAccountBillingPortal() {
  this.setAccountUiBusy(true);
  try {
    const result = await manageSubscription();
    if (result?.url) {
      await chrome.tabs.create({ url: String(result.url) });
      updateStatusCopy(this, 'Billing portal opened in a new tab.');
    } else {
      throw new Error('Billing portal URL was not returned.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'Billing portal failed');
    updateStatusCopy(this, message);
    this.updateStatus('Unable to open billing portal', 'error');
  } finally {
    this.setAccountUiBusy(false);
  }
};

sidePanelProto.signOutFromAccount = async function signOutFromAccount() {
  this.setAccountUiBusy(true);
  try {
    this._creditRefreshRunId = Number(this._creditRefreshRunId || 0) + 1;
    await signOutAccount();
    const stored = await chrome.storage.local.get(ACCOUNT_SETUP_STORAGE_KEYS as unknown as string[]);
    if (hasConfiguredByokProvider(stored)) {
      await chrome.storage.local.set({ [ACCOUNT_MODE_KEY]: ACCOUNT_MODE_BYOK });
    } else {
      await chrome.storage.local.remove([ACCOUNT_MODE_KEY]);
    }
    await this.refreshAccountPanel({ silent: true });
    await this.showAccountOnboardingIfNeeded();
    updateStatusCopy(this, 'Signed out.');
    this.updateStatus('Signed out', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'Sign-out failed');
    updateStatusCopy(this, message);
    this.updateStatus('Sign out failed', 'error');
  } finally {
    this.setAccountUiBusy(false);
    await this.refreshSetupFlowUi();
  }
};

sidePanelProto.refreshAccountPanel = async function refreshAccountPanel({ silent = false } = {}) {
  if (!CONVEX_DEPLOYMENT_URL) {
    setHidden(this.elements.accountAuthUnavailable, false);
    setHidden(this.elements.accountAuthSignedOut, true);
    setHidden(this.elements.accountAuthSignedIn, true);
    updateStatusCopy(this, 'Paid mode unavailable in this build. Use BYOK or set CONVEX_URL and rebuild.');
    this.syncAccountAvatar?.();
    await this.refreshSetupFlowUi();
    return;
  }

  setHidden(this.elements.accountAuthUnavailable, true);
  this.setAccountUiBusy(true);

  try {
    const state = await getAuthState({ reconcileCredits: true, forceCreditReconcile: !silent });
    if (!state.authenticated) {
      setHidden(this.elements.accountAuthSignedOut, false);
      setHidden(this.elements.accountAuthSignedIn, true);
      updateStatusCopy(this, 'Not signed in. Sign in and buy credits, or use BYOK in Setup.');
      this.syncAccountAvatar?.();
      if (!silent) this.updateStatus('Account: signed out', 'warning');
      return;
    }

    setHidden(this.elements.accountAuthSignedOut, true);
    setHidden(this.elements.accountAuthSignedIn, false);

    const userEmail = String(state.user?.email || 'Unknown user');
    const sub = state.subscription || null;
    const creditCents = Number(sub?.creditBalanceCents ?? 0);
    const hasCredits = creditCents > 0;
    const paidActive = hasActiveSubscription(sub);
    const hasAccess = hasCredits || paidActive;
    const planLabel = paidActive ? 'Pro (active)' : hasCredits ? 'Credits' : `Free (${sub?.status || 'inactive'})`;
    const monthSpendCents = Number(sub?.cost?.netSpendCents ?? 0);
    const recentTransactions = Array.isArray(sub?.recentTransactions) ? sub.recentTransactions : [];
    const lastDebitTx = recentTransactions.find(
      (transaction) =>
        String(transaction?.direction || '').toLowerCase() === 'debit' && transaction?.status !== 'denied',
    );

    if (this.elements.accountUserValue) this.elements.accountUserValue.textContent = userEmail;
    if (this.elements.accountCreditBalance)
      this.elements.accountCreditBalance.textContent = formatCreditBalance(creditCents);
    if (this.elements.accountPlanValue) this.elements.accountPlanValue.textContent = planLabel;
    if (this.elements.accountUsageValue) this.elements.accountUsageValue.textContent = toUsageLabel(sub?.usage);
    if (this.elements.accountCostMonthValue)
      this.elements.accountCostMonthValue.textContent = formatCreditBalance(monthSpendCents);
    if (this.elements.accountLastChargeValue) {
      this.elements.accountLastChargeValue.textContent = lastDebitTx
        ? `${formatCreditBalance(Number(lastDebitTx?.amountCents ?? 0))} · ${toReadableTransactionType(String(lastDebitTx?.type || 'charge'))}`
        : '-';
    }
    renderLedgerRows(this.elements.accountLedgerList, recentTransactions);
    renderUsageCharts(this, { transactions: recentTransactions, usage: sub?.usage });

    if (hasAccess) {
      const stored = await chrome.storage.local.get([ACCOUNT_MODE_KEY]);
      if (stored[ACCOUNT_MODE_KEY] !== ACCOUNT_MODE_PAID) {
        await chrome.storage.local.set({ [ACCOUNT_MODE_KEY]: ACCOUNT_MODE_PAID });
      }
      // Only ensure the managed profile exists; don't force-switch if user picked another profile
      await this.ensureManagedProviderDefaults();
    }

    // Show "Buy Credits" row always; hide legacy upgrade if user has credits or a subscription
    setHidden(this.elements.accountUpgradeBtn, hasAccess);
    setHidden(this.elements.accountManageBtn, !paidActive);
    const statusMsg = hasCredits
      ? `${formatCreditBalance(creditCents)} remaining. Parchi managed route available.`
      : paidActive
        ? 'Paid plan active. Parchi managed route available.'
        : 'No credits. Buy credits or use BYOK to continue.';
    updateStatusCopy(this, statusMsg);
    if (!silent) this.updateStatus('Account refreshed', 'success');
    this.syncAccountAvatar?.();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'Failed to refresh account');
    updateStatusCopy(this, message);
    if (!silent) this.updateStatus('Unable to load account state', 'error');
  } finally {
    this.setAccountUiBusy(false);
    await this.refreshSetupFlowUi();
  }
};
