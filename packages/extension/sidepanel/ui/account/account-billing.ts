import { createCheckoutSession, getAuthState, manageSubscription } from '../../../convex/client.js';
import { SidePanelUI } from '../core/panel-ui.js';
import { updateStatusCopy } from './account-formatters.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.startAccountCheckout = async function startAccountCheckout() {
  this.setAccountUiBusy(true);
  try {
    const currentState = await getAuthState();
    if (!currentState.authenticated) {
      throw new Error('Sign in first, then start billing for Parchi managed access.');
    }
    const result = await createCheckoutSession();
    if (result?.url) {
      await chrome.tabs.create({ url: String(result.url) });
      updateStatusCopy(this, 'Stripe checkout opened in a new tab. Finish billing, then click Refresh.');
      this.updateStatus('Billing checkout opened', 'active');
      return;
    }
    throw new Error('Checkout URL was not returned.');
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
