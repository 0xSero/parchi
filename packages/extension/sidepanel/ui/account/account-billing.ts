import { createCreditCheckout, getAuthState, manageSubscription } from '../../../convex/client.js';
import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

import {
  CREDIT_REFRESH_ATTEMPTS,
  CREDIT_REFRESH_POLL_MS,
  delay,
  formatCreditBalance,
  updateStatusCopy,
} from './account-utils.js';

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
