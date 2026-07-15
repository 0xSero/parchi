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
  // Anthropic — official "A" mark (source: simpleicons / anthropic brand)
  anthropic:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.304 3.541h-3.672l6.696 16.918H24Zm-10.608 0L0 20.459h3.744l1.37-3.553h7.005l1.369 3.553h3.744L10.536 3.541Zm-.371 10.223 2.291-5.946 2.292 5.946Z"/></svg>',
  // OpenAI — official hexagonal flower mark (source: svgl / openai brand)
  openai:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.418 9.822a5.903 5.903 0 0 0-.508-4.862c-1.33-2.278-3.906-3.476-6.468-3.019A5.994 5.994 0 0 0 10.944.96a6.04 6.04 0 0 0-5.77 4.225 5.916 5.916 0 0 0-3.954 2.868 6.05 6.05 0 0 0 .735 7.025 5.903 5.903 0 0 0 .508 4.862c1.33 2.28 3.906 3.476 6.469 3.02A5.98 5.98 0 0 0 13.381 24a6.04 6.04 0 0 0 5.77-4.225 5.916 5.916 0 0 0 3.954-2.868 6.022 6.022 0 0 0-.687-7.085Zm-9.022 12.679a4.5 4.5 0 0 1-2.867-1.04l.14-.08 4.76-2.747a.776.776 0 0 0 .39-.675v-6.703l2.012 1.163a.072.072 0 0 1 .038.052v5.554a4.494 4.494 0 0 1-4.473 4.476Zm-9.616-4.11a4.47 4.47 0 0 1-.533-3.001l.14.085 4.764 2.748a.77.77 0 0 0 .776 0l5.818-3.354v2.32a.08.08 0 0 1-.033.062l-4.818 2.779c-2.137 1.233-4.873.5-6.114-1.64ZM2.844 7.87a4.486 4.486 0 0 1 2.36-1.966v5.652a.77.77 0 0 0 .387.672l5.79 3.338-2.013 1.163a.076.076 0 0 1-.071 0L4.48 13.95a4.5 4.5 0 0 1-1.636-6.08Zm16.525 3.833-5.816-3.365 2.012-1.163a.076.076 0 0 1 .07 0l4.818 2.78a4.492 4.492 0 0 1-.674 8.065v-5.656a.785.785 0 0 0-.41-.661Zm2.002-3.009-.14-.085-4.757-2.77a.772.772 0 0 0-.782 0l-5.818 3.354v-2.32a.066.066 0 0 1 .028-.061l4.818-2.78A4.496 4.496 0 0 1 21.371 8.7Zm-12.583 4.14-2.014-1.16a.08.08 0 0 1-.038-.053V6.068a4.494 4.494 0 0 1 7.34-3.436l-.14.08-4.76 2.747a.776.776 0 0 0-.39.675l-.005 6.7Zm1.093-2.354 2.592-1.493 2.596 1.494v2.988l-2.59 1.493-2.593-1.493Z"/></svg>',
  // Kimi (Moonshot) — K lettermark (source: svgl/kimi-icon, simplified to 24x24)
  kimi: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.1 8.88a21 21 0 0 1 .25-.32c.04-.05.03-.08-.002-.13a1.59 1.59 0 0 1-.185-1.51c.154-.396.493-.581.908-.62.258-.025.512.002.748.128.309.165.489.417.548.765.047.278.038.549-.04.818-.14.476-.482.723-.95.785a5.96 5.96 0 0 1-1.177.085c-.03.003-.06 0-.097 0Z"/><path d="M15.14 6.76h-2.347l-1.858 4.235H8.31V6.78H6.21v10.918h2.1v-4.6h3.703c.638 0 1.22-.372 1.489-.95V17.7h2.1v-4.6c0-1.094-.856-2.015-1.948-2.094v-.005h-1.154c.47-.27.854-.728 1.261-1.15L15.14 6.76Z"/></svg>',
  // Codex (OpenAI) — reuse OpenAI mark
  codex:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.418 9.822a5.903 5.903 0 0 0-.508-4.862c-1.33-2.278-3.906-3.476-6.468-3.019A5.994 5.994 0 0 0 10.944.96a6.04 6.04 0 0 0-5.77 4.225 5.916 5.916 0 0 0-3.954 2.868 6.05 6.05 0 0 0 .735 7.025 5.903 5.903 0 0 0 .508 4.862c1.33 2.28 3.906 3.476 6.469 3.02A5.98 5.98 0 0 0 13.381 24a6.04 6.04 0 0 0 5.77-4.225 5.916 5.916 0 0 0 3.954-2.868 6.022 6.022 0 0 0-.687-7.085Zm-9.022 12.679a4.5 4.5 0 0 1-2.867-1.04l.14-.08 4.76-2.747a.776.776 0 0 0 .39-.675v-6.703l2.012 1.163a.072.072 0 0 1 .038.052v5.554a4.494 4.494 0 0 1-4.473 4.476Zm-9.616-4.11a4.47 4.47 0 0 1-.533-3.001l.14.085 4.764 2.748a.77.77 0 0 0 .776 0l5.818-3.354v2.32a.08.08 0 0 1-.033.062l-4.818 2.779c-2.137 1.233-4.873.5-6.114-1.64ZM2.844 7.87a4.486 4.486 0 0 1 2.36-1.966v5.652a.77.77 0 0 0 .387.672l5.79 3.338-2.013 1.163a.076.076 0 0 1-.071 0L4.48 13.95a4.5 4.5 0 0 1-1.636-6.08Zm16.525 3.833-5.816-3.365 2.012-1.163a.076.076 0 0 1 .07 0l4.818 2.78a4.492 4.492 0 0 1-.674 8.065v-5.656a.785.785 0 0 0-.41-.661Zm2.002-3.009-.14-.085-4.757-2.77a.772.772 0 0 0-.782 0l-5.818 3.354v-2.32a.066.066 0 0 1 .028-.061l4.818-2.78A4.496 4.496 0 0 1 21.371 8.7Zm-12.583 4.14-2.014-1.16a.08.08 0 0 1-.038-.053V6.068a4.494 4.494 0 0 1 7.34-3.436l-.14.08-4.76 2.747a.776.776 0 0 0-.39.675l-.005 6.7Zm1.093-2.354 2.592-1.493 2.596 1.494v2.988l-2.59 1.493-2.593-1.493Z"/></svg>',
  // GitHub Copilot — octocat-copilot mark (source: svgl/copilot_dark)
  copilot:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.24 2.93c1.3 1.38 1.86 3.28 2.1 5.93.61 0 1.19.14 1.58.67l.73.99c.2.28.32.62.32.97v2.68a1.12 1.12 0 0 1-.45.89C20.12 17.45 16.06 19.38 12 19.38c-4.56 0-9.14-2.64-11.47-4.35a1.12 1.12 0 0 1-.45-.89v-2.68c0-.35.11-.69.32-.98l.72-.98c.4-.53.97-.67 1.59-.67.23-2.65.78-4.55 2.1-5.93C7.2.3 10.49 0 11.89 0h.04c1.37 0 4.7.27 7.2 2.93ZM12 7.34c-.28 0-.6.02-.96.05a2.53 2.53 0 0 1-.56 1.13 4.19 4.19 0 0 1-2.98 1.21c-.64 0-1.3-.14-1.84-.48-.51.18-1 .42-1.04 1.03-.05 1.14-.06 2.28-.06 3.43 0 .57 0 1.15-.02 1.72 0 .34.21.65.51.79C7.44 17.33 9.78 17.9 12 17.9s4.47-.56 6.94-1.69a.87.87 0 0 0 .51-.78c.03-1.72 0-3.45-.07-5.16-.04-.62-.53-.85-1.04-1.03-.54.35-1.21.48-1.84.48a4.19 4.19 0 0 1-2.98-1.2 2.53 2.53 0 0 1-.56-1.14c-.32-.03-.64-.05-.96-.05Zm-2.52 4.1c.54 0 .98.43.98.97v1.79a.97.97 0 0 1-1.94 0v-1.79c0-.54.43-.97.97-.97Zm4.98 0c.54 0 .97.43.97.97v1.79a.97.97 0 0 1-1.93 0v-1.79c0-.54.43-.97.97-.97Z"/></svg>',
  // Qwen (Alibaba) — official mark (source: svgl/qwen_dark)
  qwen: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.604 1.34c.393.69.784 1.382 1.174 2.075a.18.18 0 0 0 .157.091h5.552c.174 0 .322.11.446.327l1.454 2.57c.19.337.24.478.024.837-.26.43-.513.864-.76 1.3l-.367.658c-.106.196-.223.28-.04.512l2.652 4.637c.172.301.111.494-.043.77-.437.785-.882 1.564-1.335 2.34-.159.272-.352.375-.68.37-.777-.016-1.552-.01-2.327.016a.099.099 0 0 0-.081.05 575.097 575.097 0 0 1-2.705 4.74c-.169.293-.38.363-.725.364-.997.003-2.002.004-3.017.002a.537.537 0 0 1-.465-.271l-1.335-2.323a.09.09 0 0 0-.083-.049H4.982c-.285.03-.553-.001-.805-.092l-1.603-2.77a.543.543 0 0 1-.002-.54l1.207-2.12a.198.198 0 0 0 0-.197 550.951 550.951 0 0 1-1.875-3.272l-.79-1.395c-.16-.31-.173-.496.095-.965.465-.813.927-1.625 1.387-2.436.132-.234.304-.334.584-.335a338.3 338.3 0 0 1 2.589-.001.124.124 0 0 0 .107-.063l2.806-4.895a.488.488 0 0 1 .422-.246c.524-.001 1.053 0 1.583-.006L11.704 1c.341-.003.724.032.9.34Zm-3.432.403a.06.06 0 0 0-.052.03L6.254 6.788a.157.157 0 0 1-.135.078H3.253c-.056 0-.07.025-.041.074l5.81 10.156c.025.042.013.062-.034.063l-2.795.015a.218.218 0 0 0-.2.116l-1.32 2.31c-.044.078-.021.118.068.118l5.716.008c.046 0 .08.02.104.061l1.403 2.454c.046.081.092.082.139 0l5.006-8.76.783-1.382a.055.055 0 0 1 .096 0l1.424 2.53a.122.122 0 0 0 .107.062l2.763-.02a.04.04 0 0 0 .035-.02.041.041 0 0 0 0-.04l-2.9-5.086a.108.108 0 0 1 0-.113l.293-.507 1.12-1.977c.024-.041.012-.062-.035-.062H9.2c-.059 0-.073-.026-.043-.077l1.434-2.505a.107.107 0 0 0 0-.114L9.225 1.774a.06.06 0 0 0-.053-.031Zm6.29 8.02c.046 0 .058.02.034.06l-.832 1.465-2.613 4.585a.056.056 0 0 1-.05.029.058.058 0 0 1-.05-.029L8.498 9.841c-.02-.034-.01-.052.028-.054l.216-.012 6.722-.012Z"/></svg>',
  // GLM (z.ai) — official z.ai diagonal-Z mark
  glm: '<svg viewBox="0 0 30 30" fill="currentColor"><path d="M15.47 7.1l-1.3 1.85c-.2.29-.54.47-.9.47H6.17V7.09h9.3Z"/><polygon points="24.3 7.1 13.14 22.91 5.7 22.91 16.86 7.1"/><path d="M14.53 22.91l1.31-1.86c.2-.29.54-.47.9-.47h7.09v2.33h-9.3Z"/></svg>',
  // MiniMax — stylized "M" wave mark
  minimax:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17 6.5 5l5.5 14 5.5-14L22 17"/></svg>',
  // OpenRouter — dual-arrow routing mark (source: svgl/openrouter_dark, simplified)
  openrouter:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M.14 11.7c.7 0 3.43-.6 4.83-1.4 1.37-.78 1.37-.78 4.2-2.8 3.58-2.55 6.11-1.7 10.27-1.7" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M23.96 5.72 16.77 9.9V1.54Z"/><path d="M0 12.3c.68 0 3.33.6 4.7 1.4 1.37.78 1.37.78 4.2 2.8 3.58 2.55 6.11 1.7 10.27 1.7" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><path d="M23.82 17.73 16.63 13.55V21.9Z"/></svg>',
  // Parchi — smiley mark
  parchi:
    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 14s1.5 2 4 2 4-2 4-2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>',
  // xAI (z.ai / Grok) — official X-shaped mark (source: svgl/xai_dark)
  xai: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.88 6.02l.24 9.32h1.9l.24-12.72Zm2.37-4.43h-2.9L10.82 8.13l1.45 2.07Zm-12.52 16.5h2.9l1.45-2.07-1.45-2.07Zm0-12.12 6.53 9.32h2.9L8.61 6.02Z"/></svg>',
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

/** Exact model IDs or prefixes to enable by default. */
const DEFAULT_ENABLED_PREFIXES = [
  'gpt-5.4', // gpt-5.4, gpt-5.4-mini, etc.
  'claude-sonnet-4.6',
  'claude-sonnet-4-6',
  'claude-opus-4.6',
  'claude-opus-4-6',
  'kimi', // kimi-for-coding, kimi-k2, etc.
  'grok', // grok-code-fast-1, etc.
  'minimax',
  'MiniMax',
  'glm-5', // glm-5.1, glm-5v-turbo
];

function isDefaultEnabled(modelId: string, providerType: string): boolean {
  // All custom provider models enabled
  if (providerType === 'custom') return true;
  const lower = modelId.toLowerCase();
  return DEFAULT_ENABLED_PREFIXES.some((p) => lower.startsWith(p.toLowerCase()));
}

function modelKey(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`;
}

function isModelChecked(ui: any, providerId: string, modelId: string): boolean {
  const map: Record<string, boolean> | undefined = ui._enabledComposerModels;
  if (!map) return false; // will be initialized in renderModelSelectorGrid
  const key = modelKey(providerId, modelId);
  return map[key] === true;
}

sidePanelProto.renderModelSelectorGrid = function renderModelSelectorGrid() {
  const grid = this.elements.modelSelectorGrid as HTMLElement | null;
  if (!grid) return;

  if (!(this as any)._oauthSyncedForModelGrid) {
    (this as any)._oauthSyncedForModelGrid = true;
    void syncOAuthProfiles(this)
      .then(() => {
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

  // Initialize enabledComposerModels from defaults if not yet set
  if (!this._enabledComposerModels) {
    const map: Record<string, boolean> = {};
    for (const p of providers) {
      for (const m of p.models) {
        map[modelKey(p.id, m.id)] = isDefaultEnabled(m.id, p.provider);
      }
    }
    this._enabledComposerModels = map;
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
      const checked = isModelChecked(this, provider.id, model.id);
      const row = document.createElement('div');
      row.className = `model-option${isActive ? ' active' : ''}`;
      row.dataset.providerId = provider.id;
      row.dataset.modelId = model.id;

      const ctxStr = formatContextWindow(model.contextWindow);
      row.innerHTML = `
        <input type="checkbox" class="model-checkbox" ${checked ? 'checked' : ''} />
        <span class="model-name">${this.escapeHtml(model.label || model.id)}</span>
        ${ctxStr ? `<span class="model-ctx">${ctxStr}</span>` : ''}
      `;

      const checkbox = row.querySelector('.model-checkbox') as HTMLInputElement;
      checkbox.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        const key = modelKey(provider.id, model.id);
        if (!this._enabledComposerModels) this._enabledComposerModels = {};
        this._enabledComposerModels[key] = checkbox.checked;
        void this.persistAllSettings?.({ silent: true });
        this.populateModelSelect?.();
      });

      row.addEventListener('click', (e: Event) => {
        if ((e.target as HTMLElement).classList.contains('model-checkbox')) return;
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
