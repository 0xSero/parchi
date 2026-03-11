import {
  signInWithOAuth,
  signInWithPassword,
  signOutAccount,
  signUpWithPassword,
} from '../../../convex/client.js';
import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

import { ACCOUNT_MODE_BYOK, ACCOUNT_MODE_KEY, ACCOUNT_MODE_PAID, hasConfiguredByokProvider } from './account-mode.js';
import { ACCOUNT_SETUP_STORAGE_KEYS, updateStatusCopy } from './account-utils.js';

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
