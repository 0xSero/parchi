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

import {
  formatCreditBalance,
  setHidden,
  toReadableTransactionType,
  toUsageLabel,
  updateStatusCopy,
} from './account-formatters.js';
import { ACCOUNT_MODE_KEY, ACCOUNT_MODE_PAID } from './account-mode.js';
import { renderLedgerRows, renderUsageCharts } from './account-rendering.js';

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

  // Credit buy buttons (delegated from the row)
  this.elements.accountBuyCreditsRow?.addEventListener('click', (e: Event) => {
    const btn = (e.target as HTMLElement)?.closest('.credit-buy-btn') as HTMLElement | null;
    if (!btn) return;
    const cents = Number(btn.dataset.cents || 0);
    if (cents > 0) void this.startCreditCheckout(cents);
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
