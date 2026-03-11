import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

import {
  ACCOUNT_SETUP_STORAGE_KEYS,
  PARCHI_RUNTIME_STATUS_KEY,
  setHidden,
  updateStatusCopy,
} from './account-formatters.js';
import { ACCOUNT_MODE_BYOK, ACCOUNT_MODE_KEY, ACCOUNT_MODE_PAID, hasConfiguredByokProvider } from './account-mode.js';

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
