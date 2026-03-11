import { getProviderDefinition } from '../../../ai/providers/registry.js';
import {
  ensureProviderModel,
  listProviderInstances,
  materializeProfileWithProvider,
} from '../../../state/provider-registry.js';
import { SidePanelUI } from '../core/panel-ui.js';
import { syncOAuthProfiles } from './oauth-profiles.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;
const OAUTH_PROFILE_PREFIX = 'oauth:';

const PROVIDER_SVGS: Record<string, string> = {
  anthropic:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.83 2 21 22h-4.2l-7.17-20h4.2ZM7.37 2 3 14.1 7.91 22H3L7.37 2Z"/></svg>',
  openai:
    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 6v6l4 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  kimi: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
  codex:
    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 6v6l4 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  copilot:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  qwen: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>',
  glm: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v16H4z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  minimax:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 12h4l3-9 6 18 3-9h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  openrouter:
    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="5" cy="19" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="19" cy="19" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 8v3M7 17l3-4M17 17l-3-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  parchi:
    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 14s1.5 2 4 2 4-2 4-2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>',
  custom:
    '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};

export function getProviderSvg(providerType: string): string {
  const base = providerType.replace(/-oauth$/, '');
  return PROVIDER_SVGS[base] || PROVIDER_SVGS.custom;
}

function formatContextWindow(value?: number): string {
  if (!value || !Number.isFinite(value)) return '';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

sidePanelProto.renderModelSelectorGrid = function renderModelSelectorGrid() {
  const grid = this.elements.modelSelectorGrid as HTMLElement | null;
  if (!grid) return;

  // Ensure OAuth providers are synced into this.providers on first render.
  if (!(this as any)._oauthSyncedForModelGrid) {
    (this as any)._oauthSyncedForModelGrid = true;
    void syncOAuthProfiles(this)
      .then(() => {
        // Re-render now that OAuth providers are in this.providers
        const g = this.elements.modelSelectorGrid as HTMLElement | null;
        if (g) this.renderModelSelectorGrid?.();
      })
      .catch(() => {});
  }

  grid.innerHTML = '';

  const providers = listProviderInstances({ providers: this.providers }).filter(
    (p) => p.isConnected && p.models.length > 0,
  );

  if (!providers.length) {
    grid.innerHTML =
      '<div class="model-selector-empty">Connect a provider in the Providers tab to see available models.</div>';
    return;
  }

  const activeConfig = this.configs?.[this.currentConfig] || {};
  const activeModelId = activeConfig.modelId || activeConfig.model || '';
  const activeProviderId = activeConfig.providerId || '';

  for (const provider of providers) {
    const svg = getProviderSvg(provider.provider);
    const label = document.createElement('div');
    label.className = 'model-group-label';
    label.innerHTML = `<span class="provider-logo" style="width:14px;height:14px">${svg}</span> ${this.escapeHtml(provider.name)}`;
    grid.appendChild(label);

    for (const model of provider.models) {
      const isActive = model.id === activeModelId && provider.id === activeProviderId;
      const row = document.createElement('div');
      row.className = `model-option${isActive ? ' active' : ''}`;
      row.dataset.providerId = provider.id;
      row.dataset.modelId = model.id;

      const ctxStr = formatContextWindow(model.contextWindow);
      row.innerHTML = `
        <span class="model-check"></span>
        <span class="model-name">${this.escapeHtml(model.label || model.id)}</span>
        ${ctxStr ? `<span class="model-ctx">${ctxStr}</span>` : ''}
      `;
      row.addEventListener('click', () => {
        this.selectModelFromGrid(provider.id, model.id);
      });
      grid.appendChild(row);
    }
  }
};

sidePanelProto.selectModelFromGrid = function selectModelFromGrid(providerId: string, modelId: string) {
  const provider = this.providers?.[providerId];
  if (!provider) return;

  const def = getProviderDefinition(provider.provider);
  const modelInfo = provider.models?.find((m: any) => m.id === modelId);
  const activeProfile = materializeProfileWithProvider(
    { providers: this.providers, configs: this.configs },
    this.currentConfig,
    this.configs?.[this.currentConfig] || {},
  );
  const shouldRerouteFromOAuthProfile =
    String(this.currentConfig || '').startsWith(OAUTH_PROFILE_PREFIX) &&
    String(activeProfile?.provider || '').trim() !== provider.provider;
  const targetConfigName = shouldRerouteFromOAuthProfile ? 'default' : this.currentConfig;
  if (!this.configs?.[targetConfigName]) {
    this.configs[targetConfigName] = {};
  }

  // Update active config with selected provider + model
  const config = this.configs?.[targetConfigName] || {};
  config.providerId = providerId;
  config.provider = provider.provider;
  config.providerLabel = provider.name;
  config.apiKey = provider.authType === 'api-key' ? provider.apiKey || '' : '';
  config.modelId = modelId;
  config.model = modelId;
  config.customEndpoint = provider.customEndpoint || def?.defaultBaseUrl || '';
  config.extraHeaders = provider.extraHeaders || {};
  if (modelInfo?.contextWindow) {
    config.contextLimit = modelInfo.contextWindow;
  }
  this.configs[targetConfigName] = config;

  // Ensure model is in provider's model list
  const nextProvider = ensureProviderModel(provider, {
    id: modelId,
    label: modelInfo?.label,
    contextWindow: modelInfo?.contextWindow,
    supportsVision: modelInfo?.supportsVision,
  });
  this.providers = { ...(this.providers || {}), [nextProvider.id]: nextProvider };

  // Persist and update UI
  if (targetConfigName !== this.currentConfig) {
    this.currentConfig = targetConfigName;
    if (this.elements.activeConfig) {
      this.elements.activeConfig.value = targetConfigName;
    }
    this.populateFormFromConfig?.(this.configs[targetConfigName]);
    this.editProfile?.(targetConfigName, true);
    this.updateScreenshotToggleState?.();
  }
  void this.persistAllSettings?.({ silent: true });
  this.populateModelSelect?.();
  this.updateModelDisplay?.();
  this.populateGenerationTab?.();
  this.renderModelSelectorGrid();
  this.updateStatus(`Model set to ${modelId}`, 'success');
};
