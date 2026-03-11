// Balance popover - displays account credits and subscription status

import { materializeProfileWithProvider } from '../../../state/provider-registry.js';
import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

/**
 * Toggle the balance popover visibility and populate with account data.
 */
sidePanelProto.toggleBalancePopover = async function toggleBalancePopover() {
  const popover = document.getElementById('balancePopover');
  if (!popover) return;

  if (!popover.classList.contains('hidden')) {
    popover.classList.add('hidden');
    return;
  }

  // Show with current data
  popover.classList.remove('hidden');

  // Populate with cached data first
  const sessionIn = this.sessionTokenTotals?.inputTokens || 0;
  const sessionOut = this.sessionTokenTotals?.outputTokens || 0;
  const sessionTokensEl = document.getElementById('balanceSessionTokens');
  if (sessionTokensEl) {
    sessionTokensEl.textContent = `${this.formatTokenCount?.(sessionIn) || sessionIn} in / ${this.formatTokenCount?.(sessionOut) || sessionOut} out`;
  }

  // Try to fetch live balance from storage
  try {
    const stored = await chrome.storage.local.get([
      'convexCreditBalanceCents',
      'convexSubscriptionPlan',
      'convexSubscriptionStatus',
    ]);
    const creditCents = Number(stored.convexCreditBalanceCents || 0);
    const plan = String(stored.convexSubscriptionPlan || '').toLowerCase();
    const status = String(stored.convexSubscriptionStatus || '').toLowerCase();
    const planLabel = plan === 'pro' && status === 'active' ? 'Pro (active)' : creditCents > 0 ? 'Credits' : 'Free';

    const creditsEl = document.getElementById('balanceCreditsValue');
    const planEl = document.getElementById('balancePlanValue');
    const spendEl = document.getElementById('balanceSpendValue');

    if (creditsEl) creditsEl.textContent = creditCents > 0 ? `$${(creditCents / 100).toFixed(2)}` : '$0.00';
    if (planEl) planEl.textContent = planLabel;

    // Get active profile info for provider context
    const activeConfig = materializeProfileWithProvider(
      { providers: this.providers, configs: this.configs },
      this.currentConfig,
      this.configs?.[this.currentConfig] || {},
    );
    const provider = String(activeConfig?.provider || '')
      .trim()
      .toLowerCase();
    if (spendEl) {
      if (provider === 'parchi' || provider === 'openrouter') {
        spendEl.textContent = 'See Account tab';
      } else {
        spendEl.textContent = 'BYOK (no billing)';
      }
    }
  } catch {
    // Ignore storage read failures
  }
};
