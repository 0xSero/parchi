// Account panel module entry point - imports all account submodules
import { CONVEX_DEPLOYMENT_URL, getAuthState, hasActiveSubscription } from '../../../convex/client.js';
import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

// Import submodules (side-effect registration)
import './account-auth.js';
import './account-billing.js';
import './account-managed.js';
import './account-profile.js';
import './account-setup-state.js';

import { setHidden, toUsageLabel, updateStatusCopy } from './account-formatters.js';
import { ACCOUNT_MODE_KEY, ACCOUNT_MODE_PAID } from './account-mode.js';

const formatDateTime = (value: unknown) => {
  const timestamp = Number(value || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '-';
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return '-';
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
    void this.chooseAccountMode('byok');
  });
  this.elements.accountChoosePaidBtn?.addEventListener('click', () => {
    void this.chooseAccountMode('paid');
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
    const state = await getAuthState();
    if (!state.authenticated) {
      setHidden(this.elements.accountAuthSignedOut, false);
      setHidden(this.elements.accountAuthSignedIn, true);
      updateStatusCopy(this, 'Not signed in. Sign in and start billing, or use BYOK in Setup.');
      this.syncAccountAvatar?.();
      if (!silent) this.updateStatus('Account: signed out', 'warning');
      return;
    }

    setHidden(this.elements.accountAuthSignedOut, true);
    setHidden(this.elements.accountAuthSignedIn, false);

    const userEmail = String(state.user?.email || 'Unknown user');
    const sub = state.subscription || null;
    const paidActive = hasActiveSubscription(sub);
    const hasAccess = paidActive;
    const usageLabel = toUsageLabel(sub?.usage);
    const currentPeriodEnd = formatDateTime(sub?.currentPeriodEnd);

    if (this.elements.accountUserValue) this.elements.accountUserValue.textContent = userEmail;
    if (this.elements.accountBillingValue) {
      this.elements.accountBillingValue.textContent = paidActive ? 'Active' : String(sub?.status || 'Inactive');
    }
    if (this.elements.accountPlanValue) {
      this.elements.accountPlanValue.textContent = paidActive ? 'Metered' : 'Free';
    }
    if (this.elements.accountUsageValue) this.elements.accountUsageValue.textContent = usageLabel;
    if (this.elements.accountPeriodEndValue) this.elements.accountPeriodEndValue.textContent = currentPeriodEnd;
    if (this.elements.accountRuntimeValue) {
      this.elements.accountRuntimeValue.textContent = hasAccess ? 'Managed route ready' : 'Billing required';
    }

    if (hasAccess) {
      const stored = await chrome.storage.local.get([ACCOUNT_MODE_KEY]);
      if (stored[ACCOUNT_MODE_KEY] !== ACCOUNT_MODE_PAID) {
        await chrome.storage.local.set({ [ACCOUNT_MODE_KEY]: ACCOUNT_MODE_PAID });
      }
      await this.ensureManagedProviderDefaults();
    }

    setHidden(this.elements.accountUpgradeBtn, hasAccess);
    setHidden(this.elements.accountManageBtn, !state.subscription?.stripeCustomerId);

    const statusMsg = hasAccess
      ? 'Billing is active. Parchi managed routing is available.'
      : 'Billing is inactive. Start billing or use BYOK to continue.';
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
