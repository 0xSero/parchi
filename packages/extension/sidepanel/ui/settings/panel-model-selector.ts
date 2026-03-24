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
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.304 3.541h-3.672l6.696 16.918H24Zm-10.608 0L0 20.459h3.744l1.37-3.553h7.005l1.37 3.553h3.744L10.536 3.541Zm-.371 10.223 2.291-5.946 2.292 5.946Z"/></svg>',
  claude:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.304 3.541h-3.672l6.696 16.918H24Zm-10.608 0L0 20.459h3.744l1.37-3.553h7.005l1.37 3.553h3.744L10.536 3.541Zm-.371 10.223 2.291-5.946 2.292 5.946Z"/></svg>',
  openai:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.14-.08 4.778-2.759a.795.795 0 0 0 .393-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.677l5.815 3.354-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.12 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zM8.306 12.863l-2.02-1.164a.08.08 0 0 1-.038-.057V6.074a4.5 4.5 0 0 1 7.376-3.454l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.098-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>',
  codex:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.14-.08 4.778-2.759a.795.795 0 0 0 .393-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.677l5.815 3.354-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.12 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zM8.306 12.863l-2.02-1.164a.08.08 0 0 1-.038-.057V6.074a4.5 4.5 0 0 1 7.376-3.454l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.098-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>',
  kimi: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 1.5a8.5 8.5 0 0 1 0 17c-3.07 0-5.75-1.63-7.24-4.07A8.49 8.49 0 0 0 12 3.5z"/></svg>',
  copilot:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>',
  qwen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M15 15l3 3" stroke-linecap="round"/></svg>',
  glm: '<svg viewBox="0 0 30 30" fill="currentColor"><rect x="1.5" y="1.5" width="27" height="27" rx="4" fill="currentColor"/><path d="M15.47 7.1l-1.3 1.85a1.14 1.14 0 0 1-.9.47H6.16V7.1h9.31zM24.3 7.1L13.14 22.91H5.7L16.86 7.1H24.3zM14.53 22.91l1.31-1.86c.2-.29.54-.47.9-.47h7.09v2.33h-9.3z" fill="var(--background, #0a0a0c)"/></svg>',
  minimax:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18l3-12 5 8 5-8 3 12"/></svg>',
  openrouter:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.778 1.844v1.919q-.569-.026-1.138-.032-.708-.008-1.415.037c-1.93.126-4.023.728-6.149 2.237-2.911 2.066-2.731 1.95-4.14 2.75-.396.223-1.342.574-2.185.798-.841.225-1.753.333-1.751.333v4.229s.768.108 1.61.333c.842.224 1.789.575 2.185.799 1.41.798 1.228.683 4.14 2.75 2.126 1.509 4.22 2.11 6.148 2.236.88.058 1.716.041 2.555.005v1.918l7.222-4.168-7.222-4.17v2.176c-.86.038-1.611.065-2.278.021-1.364-.09-2.417-.357-3.979-1.465-2.244-1.593-2.866-2.027-3.68-2.508.889-.518 1.449-.906 3.822-2.59 1.56-1.109 2.614-1.377 3.978-1.466.667-.044 1.418-.017 2.278.02v2.176L24 6.014Z"/></svg>',
  parchi:
    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 14s1.5 2 4 2 4-2 4-2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>',
  custom:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8M12 8v8" stroke-linecap="round"/></svg>',
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
