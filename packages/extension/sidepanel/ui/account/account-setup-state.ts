import { CONVEX_DEPLOYMENT_URL, isUsableRuntimeJwt } from '../../../convex/client.js';
import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

import {
  ACCOUNT_SETUP_STORAGE_KEYS,
  PARCHI_RUNTIME_STATUS_KEY,
  PARCHI_RUNTIME_STATUS_TTL_MS,
  formatCreditBalance,
  hasConfiguredModel,
  isManagedProvider,
  isRecord,
} from './account-formatters.js';
import { ACCOUNT_MODE_BYOK, ACCOUNT_MODE_KEY, ACCOUNT_MODE_PAID, hasConfiguredByokProvider } from './account-mode.js';

sidePanelProto.getSetupFlowState = async function getSetupFlowState() {
  const stored = await chrome.storage.local.get(ACCOUNT_SETUP_STORAGE_KEYS as unknown as string[]);
  const mode = String(stored[ACCOUNT_MODE_KEY] || '').toLowerCase();
  const hasChoice = mode === ACCOUNT_MODE_BYOK || mode === ACCOUNT_MODE_PAID;
  const hasConfiguredProvider = hasConfiguredByokProvider(stored);
  const profiles = collectCandidateProfiles(stored);
  const hasAnyModel = profiles.some((profile) => hasConfiguredModel(profile));
  const byokReady = profiles.some((profile) => {
    if (!hasConfiguredModel(profile)) return false;
    const provider = String(profile?.provider || '')
      .trim()
      .toLowerCase();
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
