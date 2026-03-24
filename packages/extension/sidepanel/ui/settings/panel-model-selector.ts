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
  claude:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.83 2 21 22h-4.2l-7.17-20h4.2ZM7.37 2 3 14.1 7.91 22H3L7.37 2Z"/></svg>',
  openai:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M22.28 9.37a5.98 5.98 0 0 0-.51-4.92 6.05 6.05 0 0 0-6.52-2.91A5.98 5.98 0 0 0 10.74 0a6.06 6.06 0 0 0-5.78 4.18 5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .75 7.09 5.98 5.98 0 0 0 .51 4.92 6.05 6.05 0 0 0 6.52 2.91A5.98 5.98 0 0 0 13.26 24a6.06 6.06 0 0 0 5.78-4.18 5.98 5.98 0 0 0 4-2.9 6.05 6.05 0 0 0-.76-7.09v-.46ZM13.26 22.43a4.48 4.48 0 0 1-2.88-1.05l.14-.08 4.78-2.76a.78.78 0 0 0 .39-.67v-6.74l2.02 1.17a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.49 4.5ZM3.6 18.31a4.47 4.47 0 0 1-.54-3.01l.14.09 4.78 2.76a.77.77 0 0 0 .78 0l5.83-3.37v2.33a.07.07 0 0 1-.03.06l-4.83 2.79a4.5 4.5 0 0 1-6.13-1.65ZM2.34 7.89A4.47 4.47 0 0 1 4.7 5.92l-.01.17v5.52a.77.77 0 0 0 .39.67l5.83 3.37-2.02 1.17a.07.07 0 0 1-.07 0L4 14.03a4.5 4.5 0 0 1-1.66-6.14Zm17.05 3.97-5.83-3.37L15.58 7.32a.07.07 0 0 1 .07 0l4.83 2.79a4.5 4.5 0 0 1-.7 8.12v-5.7a.77.77 0 0 0-.39-.67Zm2.01-3.02-.14-.09-4.78-2.76a.77.77 0 0 0-.78 0l-5.83 3.37V7.03a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.67 4.66ZM8.43 13.38l-2.02-1.17a.07.07 0 0 1-.04-.05V6.58a4.5 4.5 0 0 1 7.37-3.45l-.14.08-4.78 2.76a.78.78 0 0 0-.39.67v6.74Zm1.1-2.37 2.59-1.5 2.59 1.5v2.99l-2.59 1.5-2.59-1.5V11Z" fill="currentColor"/></svg>',
  codex:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M22.28 9.37a5.98 5.98 0 0 0-.51-4.92 6.05 6.05 0 0 0-6.52-2.91A5.98 5.98 0 0 0 10.74 0a6.06 6.06 0 0 0-5.78 4.18 5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .75 7.09 5.98 5.98 0 0 0 .51 4.92 6.05 6.05 0 0 0 6.52 2.91A5.98 5.98 0 0 0 13.26 24a6.06 6.06 0 0 0 5.78-4.18 5.98 5.98 0 0 0 4-2.9 6.05 6.05 0 0 0-.76-7.09v-.46ZM13.26 22.43a4.48 4.48 0 0 1-2.88-1.05l.14-.08 4.78-2.76a.78.78 0 0 0 .39-.67v-6.74l2.02 1.17a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.49 4.5ZM3.6 18.31a4.47 4.47 0 0 1-.54-3.01l.14.09 4.78 2.76a.77.77 0 0 0 .78 0l5.83-3.37v2.33a.07.07 0 0 1-.03.06l-4.83 2.79a4.5 4.5 0 0 1-6.13-1.65ZM2.34 7.89A4.47 4.47 0 0 1 4.7 5.92l-.01.17v5.52a.77.77 0 0 0 .39.67l5.83 3.37-2.02 1.17a.07.07 0 0 1-.07 0L4 14.03a4.5 4.5 0 0 1-1.66-6.14Zm17.05 3.97-5.83-3.37L15.58 7.32a.07.07 0 0 1 .07 0l4.83 2.79a4.5 4.5 0 0 1-.7 8.12v-5.7a.77.77 0 0 0-.39-.67Zm2.01-3.02-.14-.09-4.78-2.76a.77.77 0 0 0-.78 0l-5.83 3.37V7.03a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.67 4.66ZM8.43 13.38l-2.02-1.17a.07.07 0 0 1-.04-.05V6.58a4.5 4.5 0 0 1 7.37-3.45l-.14.08-4.78 2.76a.78.78 0 0 0-.39.67v6.74Zm1.1-2.37 2.59-1.5 2.59 1.5v2.99l-2.59 1.5-2.59-1.5V11Z" fill="currentColor"/></svg>',
  kimi: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 1.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17Zm-2.5 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm5 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-5.5 5.5s1.5 2.5 5 2.5 5-2.5 5-2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  copilot:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49.5.09.66-.22.66-.48v-1.69c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.56 9.56 0 0 1 12 6.8c.85 0 1.71.11 2.51.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.75c0 .27.16.58.67.48A10.01 10.01 0 0 0 22 12c0-5.52-4.48-10-10-10Z"/></svg>',
  qwen: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm-1-11h2v4h-2V9Zm0 6h2v2h-2v-2Z"/></svg>',
  glm: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v18H3V3Zm2 2v14h14V5H5Zm3 3h8v2H8V8Zm0 4h8v2H8v-2Z"/></svg>',
  minimax:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 17h4l3-8 2 12 2-12 3 8h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  openrouter:
    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="5" cy="19" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="19" cy="19" r="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M12 7.5v4M7 17.5l3.5-5M17 17.5l-3.5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
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
  const hiddenModels: string[] = this.hiddenModels || [];

  // Header
  const header = document.createElement('div');
  header.className = 'model-grid-header';
  header.innerHTML = '<span class="settings-section-desc">Check the models you want in the dropdown. Click a model name to activate it.</span>';
  grid.appendChild(header);

  for (const provider of providers) {
    const svg = getProviderSvg(provider.provider);
    const label = document.createElement('div');
    label.className = 'model-group-label';
    label.innerHTML = `<span class="provider-logo" style="width:14px;height:14px">${svg}</span> ${this.escapeHtml(provider.name)}`;
    grid.appendChild(label);

    for (const model of provider.models) {
      const isActive = model.id === activeModelId && provider.id === activeProviderId;
      const modelKey = `${provider.id}::${model.id}`;
      const isVisible = !hiddenModels.includes(modelKey);
      const row = document.createElement('div');
      row.className = `model-option${isActive ? ' active' : ''}`;
      row.dataset.providerId = provider.id;
      row.dataset.modelId = model.id;

      const ctxStr = formatContextWindow(model.contextWindow);
      row.innerHTML = `
        <label class="model-visibility-check" title="Show in dropdown">
          <input type="checkbox" class="model-visibility-input" data-model-key="${modelKey}" ${isVisible ? 'checked' : ''} />
          <span class="model-visibility-box"></span>
        </label>
        <span class="model-name">${this.escapeHtml(model.label || model.id)}</span>
        ${ctxStr ? `<span class="model-ctx">${ctxStr}</span>` : ''}
        <span class="model-check"></span>
      `;

      // Click on model name => select as active
      row.querySelector('.model-name')?.addEventListener('click', () => {
        this.selectModelFromGrid(provider.id, model.id);
      });

      // Checkbox => toggle visibility
      const checkbox = row.querySelector('.model-visibility-input') as HTMLInputElement;
      checkbox?.addEventListener('change', (e: Event) => {
        e.stopPropagation();
        this.toggleModelVisibility(modelKey, checkbox.checked);
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

sidePanelProto.toggleModelVisibility = function toggleModelVisibility(modelKey: string, visible: boolean) {
  if (!Array.isArray(this.hiddenModels)) this.hiddenModels = [];
  if (visible) {
    this.hiddenModels = this.hiddenModels.filter((k: string) => k !== modelKey);
  } else {
    if (!this.hiddenModels.includes(modelKey)) {
      this.hiddenModels = [...this.hiddenModels, modelKey];
    }
  }
  this.populateModelSelect?.();
  void import('../../../state/stores/settings-store.js').then(({ patchSettingsStoreSnapshot }) =>
    patchSettingsStoreSnapshot({ hiddenModels: this.hiddenModels }).catch(() => {}),
  );
};
