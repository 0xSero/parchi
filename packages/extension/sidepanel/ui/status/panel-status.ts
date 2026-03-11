import { fetchProviderModels } from '../../../oauth/manager.js';
import { getAllProviderStates } from '../../../oauth/store.js';
import type { OAuthProviderKey } from '../../../oauth/types.js';
import {
  ensureProviderModel,
  getProviderInstance,
  listProviderInstances,
  materializeProfileWithProvider,
} from '../../../state/provider-registry.js';
import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

const MODEL_CATALOG_TTL_MS = 3 * 60 * 1000;
const MODEL_FETCH_TIMEOUT_MS = 9000;
const MAX_MODELS_PER_PROVIDER = 250;
const MAX_MODELS_TOTAL = 600;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MODEL_SELECT_VALUE_SEPARATOR = '::';

type ModelCatalogTarget = {
  key: string;
  provider: string;
  endpointBase: string;
  headers: Record<string, string>;
};

const normalizeProvider = (provider: unknown) =>
  String(provider || '')
    .trim()
    .toLowerCase();

const normalizeHeaders = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key.length > 0)
      .map(([key, headerValue]) => [key, headerValue == null ? '' : String(headerValue)]),
  );
};

const normalizeEndpointBase = (provider: string, customEndpoint: string) => {
  const raw = String(customEndpoint || '').trim();
  const fallback =
    provider === 'openrouter' || provider === 'parchi'
      ? OPENROUTER_BASE_URL
      : provider === 'glm'
        ? 'https://api.z.ai/api/anthropic'
        : provider === 'minimax'
          ? 'https://api.minimax.io/anthropic'
          : provider === 'openai'
            ? 'https://api.openai.com/v1'
            : provider === 'anthropic'
              ? 'https://api.anthropic.com/v1'
              : provider === 'kimi'
                ? 'https://api.kimi.com/coding/v1'
                : '';

  const base = (raw || fallback)
    .replace(/\/chat\/completions\/?$/i, '')
    .replace(/\/completions\/?$/i, '')
    .replace(/\/v1\/messages\/?$/i, '')
    .replace(/\/messages\/?$/i, '')
    .replace(/\/+$/, '');
  return base;
};

const buildModelEndpointCandidates = (base: string): string[] => {
  const normalized = String(base || '')
    .trim()
    .replace(/\/+$/, '');
  if (!normalized) return [];
  if (/\/v1$/i.test(normalized) || /\/api\/v1$/i.test(normalized)) {
    return [`${normalized}/models`];
  }
  return [`${normalized}/models`, `${normalized}/v1/models`];
};

const encodeModelSelectValue = (providerId: string, modelId: string) =>
  `${encodeURIComponent(providerId)}${MODEL_SELECT_VALUE_SEPARATOR}${encodeURIComponent(modelId)}`;

const decodeModelSelectValue = (value: string): { providerId: string; modelId: string } | null => {
  const [providerId, modelId] = String(value || '').split(MODEL_SELECT_VALUE_SEPARATOR);
  if (!providerId || !modelId) return null;
  return {
    providerId: decodeURIComponent(providerId),
    modelId: decodeURIComponent(modelId),
  };
};

const extractModelIds = (payload: any): string[] => {
  if (!payload) return [];
  const source = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : Array.isArray(payload)
        ? payload
        : [];

  const ids = source
    .map((entry: any) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry.id === 'string') return entry.id;
      if (entry && typeof entry.name === 'string') return entry.name;
      return '';
    })
    .map((id: string) => id.trim())
    .filter((id: string) => id.length > 0);

  return Array.from(new Set(ids));
};

const populateModelSelectElement = (
  select: HTMLSelectElement,
  models: string[],
  currentValue: string,
  placeholder = 'Select model...',
  datalist?: HTMLDataListElement | null,
) => {
  const prevValue = select.value || currentValue;
  select.innerHTML = '';

  const placeholderOpt = document.createElement('option');
  placeholderOpt.value = '';
  placeholderOpt.textContent = placeholder;
  select.appendChild(placeholderOpt);

  // Always include current value even if not in fetched list
  if (prevValue && !models.includes(prevValue)) {
    const opt = document.createElement('option');
    opt.value = prevValue;
    opt.textContent = prevValue;
    select.appendChild(opt);
  }

  for (const model of models) {
    const opt = document.createElement('option');
    opt.value = model;
    opt.textContent = model;
    select.appendChild(opt);
  }

  if (prevValue) {
    select.value = prevValue;
  }

  if (datalist) {
    datalist.innerHTML = '';
    for (const model of models) {
      const option = document.createElement('option');
      option.value = model;
      datalist.appendChild(option);
    }
  }
};

const populateModelSuggestionList = (list: HTMLDataListElement, models: string[]) => {
  list.innerHTML = '';
  for (const model of models) {
    const option = document.createElement('option');
    option.value = model;
    list.appendChild(option);
  }
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timerId: number | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timerId = window.setTimeout(() => reject(new Error('Timed out')), timeoutMs);
      }),
    ]);
  } finally {
    if (timerId !== null) {
      window.clearTimeout(timerId);
    }
  }
};

sidePanelProto.updateStatus = function updateStatus(text: string, type = 'default') {
  if (this.elements.statusText) {
    this.elements.statusText.textContent = text;
  }
  const statusDot = document.getElementById('statusDot');
  if (statusDot) {
    statusDot.className = 'status-dot';
    if (type === 'error') statusDot.classList.add('error');
    else if (type === 'warning') statusDot.classList.add('warning');
    else if (type === 'active') statusDot.classList.add('active');
  }
  this.updateActivityState();
};

sidePanelProto.startRunTimer = function startRunTimer() {
  if (this.runTimerId) {
    window.clearInterval(this.runTimerId);
  }
  this.runStartedAt = Date.now();
  const tick = () => {
    this.updateActivityState?.();
  };
  tick();
  this.runTimerId = window.setInterval(tick, 1000);
};

sidePanelProto.stopRunTimer = function stopRunTimer() {
  if (this.runTimerId) {
    window.clearInterval(this.runTimerId);
    this.runTimerId = null;
  }
  this.runStartedAt = null;
  this.updateActivityState?.();
};

sidePanelProto.updateModelDisplay = function updateModelDisplay() {
  const select = this.elements.modelSelect;
  if (!select) return;
  const activeConfig = materializeProfileWithProvider(
    { providers: this.providers, configs: this.configs },
    this.currentConfig,
    this.configs?.[this.currentConfig] || {},
  );
  const providerId = String(activeConfig?.providerId || '').trim();
  const modelId = String(activeConfig?.modelId || activeConfig?.model || '').trim();
  if (!providerId || !modelId) return;
  select.value = encodeModelSelectValue(providerId, modelId);
};

sidePanelProto.fetchAvailableModels = async function fetchAvailableModels() {
  this.populateModelSelect();
  this.updateModelDisplay();
  await this.refreshModelCatalog();
};

sidePanelProto.collectConfiguredModelFallbacks = function collectConfiguredModelFallbacks() {
  const fallbacks: Array<{ provider: string; model: string }> = [];
  const configs = this.configs && typeof this.configs === 'object' ? this.configs : {};
  for (const [name, rawProfile] of Object.entries(configs)) {
    const profile = materializeProfileWithProvider(
      { providers: this.providers, configs: this.configs },
      name,
      rawProfile,
    );
    if (!profile || typeof profile !== 'object') continue;
    const provider = normalizeProvider((profile as any).provider);
    const model = String((profile as any).modelId || (profile as any).model || '').trim();
    if (!provider || !model) continue;
    fallbacks.push({ provider, model });
  }
  return fallbacks;
};

sidePanelProto.collectModelCatalogTargets = async function collectModelCatalogTargets() {
  const targets: ModelCatalogTarget[] = [];
  const seen = new Set<string>();
  const configs = this.configs && typeof this.configs === 'object' ? this.configs : {};

  for (const [name, rawProfile] of Object.entries(configs)) {
    const profile = materializeProfileWithProvider(
      { providers: this.providers, configs: this.configs },
      name,
      rawProfile,
    );
    if (!profile || typeof profile !== 'object') continue;
    const provider = normalizeProvider((profile as any).provider);
    if (!provider) continue;

    const apiKey = String((profile as any).apiKey || '').trim();
    const extraHeaders = normalizeHeaders((profile as any).extraHeaders);
    const endpointBase = normalizeEndpointBase(provider, String((profile as any).customEndpoint || ''));
    if (!endpointBase) continue;

    const allowsUnauthedList = provider === 'openrouter' || provider === 'parchi';
    if (!apiKey && !allowsUnauthedList) continue;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...extraHeaders,
    };

    if (provider === 'anthropic' || provider === 'kimi') {
      if (apiKey) {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      }
    } else if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    if (provider === 'openrouter' || provider === 'parchi') {
      headers['HTTP-Referer'] = headers['HTTP-Referer'] || 'https://parchi.ai';
      headers['X-Title'] = headers['X-Title'] || 'Parchi';
    }

    const key = `${provider}|${endpointBase}|${Boolean(apiKey)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push({
      key,
      provider,
      endpointBase,
      headers,
    });
  }

  return targets;
};

sidePanelProto.fetchModelIdsForTarget = async function fetchModelIdsForTarget(target: ModelCatalogTarget) {
  const urls = buildModelEndpointCandidates(target.endpointBase);
  for (const url of urls) {
    try {
      const response = await withTimeout(
        fetch(url, {
          method: 'GET',
          headers: target.headers,
        }),
        MODEL_FETCH_TIMEOUT_MS,
      );
      if (!response.ok) continue;
      const payload = await response.json().catch(() => null);
      const modelIds = extractModelIds(payload).slice(0, MAX_MODELS_PER_PROVIDER);
      if (modelIds.length > 0) {
        return modelIds;
      }
    } catch {}
  }
  return [];
};

sidePanelProto.applyModelSuggestions = function applyModelSuggestions() {
  const entries = Array.isArray(this.modelCatalogEntries) ? this.modelCatalogEntries : [];
  const deduped = new Map<string, string>();
  for (const entry of entries) {
    const model = String(entry?.model || '').trim();
    const provider = normalizeProvider(entry?.provider);
    if (!model || !provider) continue;
    if (!deduped.has(model)) {
      deduped.set(model, provider);
    }
  }

  const ordered = Array.from(deduped.entries())
    .map(([model, provider]) => ({ model, provider }))
    .sort((a, b) => a.model.localeCompare(b.model));

  // Populate Setup tab model suggestions for the active provider only.
  const modelInput = this.elements.model as HTMLInputElement | null;
  const modelSuggestions =
    this.elements.modelSuggestions || (document.getElementById('modelSuggestions') as HTMLDataListElement | null);
  const activeProfile = materializeProfileWithProvider(
    { providers: this.providers, configs: this.configs },
    this.currentConfig,
    this.configs?.[this.currentConfig] || {},
  );
  const activeProvider = normalizeProvider(activeProfile.provider);
  const providerScoped = activeProvider ? ordered.filter((item) => item.provider === activeProvider) : ordered;
  const providerModels = providerScoped.slice(0, MAX_MODELS_TOTAL).map((item) => item.model);

  if (modelSuggestions) {
    populateModelSuggestionList(modelSuggestions, providerModels);
  }

  if (modelInput) {
    const currentModel = String(modelInput.value || activeProfile.model || '').trim();
    modelInput.value = currentModel;
  }

  if (!this.elements.modelHint) return;
  if (activeProvider === 'custom') {
    this.elements.modelHint.textContent =
      providerModels.length > 0
        ? `Discovered ${providerModels.length} custom model${providerModels.length === 1 ? '' : 's'} from your endpoint.`
        : 'Type a model ID. Suggestions appear when your endpoint responds to /models or /v1/models.';
    return;
  }
  if (providerModels.length > 0) {
    this.elements.modelHint.textContent = `Discovered ${providerModels.length} models for ${activeProvider}.`;
  }
};

sidePanelProto.refreshModelCatalog = async function refreshModelCatalog({ force = false } = {}) {
  const now = Date.now();
  const hasFreshCatalog =
    !force &&
    Array.isArray(this.modelCatalogEntries) &&
    this.modelCatalogEntries.length > 0 &&
    now - Number(this.modelCatalogUpdatedAt || 0) < MODEL_CATALOG_TTL_MS;

  if (hasFreshCatalog) {
    this.applyModelSuggestions();
    return;
  }

  if (this.modelCatalogRefreshPromise) {
    await this.modelCatalogRefreshPromise;
    return;
  }

  this.modelCatalogRefreshPromise = (async () => {
    const discovered: Array<{ provider: string; model: string }> = this.collectConfiguredModelFallbacks();

    // Fetch models from connected OAuth providers via their APIs
    try {
      const oauthStates = await getAllProviderStates();
      const oauthFetches = Object.entries(oauthStates)
        .filter(([, state]) => state?.connected && state?.tokens?.accessToken)
        .map(async ([key]) => {
          const providerKey = `${key}-oauth`;
          const models = await fetchProviderModels(key as OAuthProviderKey);
          return { providerKey, models };
        });
      const oauthResults = await Promise.all(oauthFetches);
      for (const { providerKey, models } of oauthResults) {
        for (const modelId of models) {
          discovered.push({ provider: providerKey, model: modelId });
        }
      }
    } catch {}

    const targets = await this.collectModelCatalogTargets();
    const results = await Promise.all(
      targets.map(async (target) => {
        const modelIds = await this.fetchModelIdsForTarget(target);
        return {
          provider: target.provider,
          modelIds,
        };
      }),
    );

    for (const result of results) {
      for (const model of result.modelIds) {
        discovered.push({ provider: result.provider, model });
      }
    }

    const seen = new Set<string>();
    const normalized: Array<{ provider: string; model: string }> = [];
    for (const entry of discovered) {
      const provider = normalizeProvider(entry.provider);
      const model = String(entry.model || '').trim();
      if (!provider || !model) continue;
      const key = `${provider}|${model}`;
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push({ provider, model });
    }

    this.modelCatalogEntries = normalized.slice(0, MAX_MODELS_TOTAL);
    this.modelCatalogUpdatedAt = Date.now();
    this.applyModelSuggestions();
  })();

  try {
    await this.modelCatalogRefreshPromise;
  } finally {
    this.modelCatalogRefreshPromise = null;
  }
};

sidePanelProto.populateModelSelect = function populateModelSelect() {
  // Try to get the select element - it might not be in this.elements if loaded dynamically
  let select = this.elements.modelSelect;
  if (!select) {
    select = document.getElementById('modelSelect') as HTMLSelectElement;
    if (select) {
      this.elements.modelSelect = select;
    }
  }

  if (!select) {
    console.error('[Parchi] modelSelect element not found!');
    return;
  }

  // Populate with connected provider/model pairs
  select.innerHTML = '';

  const activeConfig = materializeProfileWithProvider(
    { providers: this.providers, configs: this.configs },
    this.currentConfig,
    this.configs?.[this.currentConfig] || {},
  );
  const activeProviderId = String(activeConfig?.providerId || '').trim();
  const activeProvider = String(activeConfig?.provider || '').trim();
  const activeModelId = String(activeConfig?.modelId || activeConfig?.model || '').trim();
  const providers = listProviderInstances({ providers: this.providers }).filter(
    (provider) => provider.isConnected && Array.isArray(provider.models) && provider.models.length > 0,
  );

  if (providers.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'No connected models';
    select.appendChild(option);
    this.updateModelSelectorGlow();
    return;
  }

  const providerIndicators: Record<string, string> = {
    anthropic: '◉',
    openai: '○',
    kimi: '◈',
    codex: '◆',
    copilot: '✓',
    qwen: '◇',
    glm: '□',
    minimax: '△',
    openrouter: '◎',
    parchi: '☻',
    custom: '◇',
  };

  let matchedActiveOption = false;
  for (const provider of providers) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = provider.name;
    const indicator = providerIndicators[provider.provider.replace(/-oauth$/, '').toLowerCase()] || '◇';
    for (const model of provider.models) {
      const option = document.createElement('option');
      option.value = encodeModelSelectValue(provider.id, model.id);
      option.textContent = `${indicator} ${provider.name}/${model.label || model.id}`;
      const isSelected = provider.id === activeProviderId && model.id === activeModelId;
      if (isSelected) {
        option.selected = true;
        matchedActiveOption = true;
      }
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }

  if (!matchedActiveOption && activeModelId) {
    const fallbackOption = document.createElement('option');
    fallbackOption.value =
      activeProviderId && activeModelId ? encodeModelSelectValue(activeProviderId, activeModelId) : '';
    fallbackOption.textContent = `${activeProvider || 'current'}/${activeModelId}`;
    fallbackOption.selected = true;
    select.insertBefore(fallbackOption, select.firstChild);
  }

  this.updateModelSelectorGlow();
};

sidePanelProto.refreshModelCatalogForProfileEditor = async function refreshModelCatalogForProfileEditor() {
  const providerEl = this.elements.profileEditorProvider;
  const modelSelect = this.elements.profileEditorModel as HTMLSelectElement | null;
  const modelDatalist = this.elements.profileEditorModelList as HTMLDataListElement | null;
  const modelInput = this.elements.profileEditorModelInput as HTMLInputElement | null;
  if (!providerEl) return;

  const providerId = String(providerEl.value || '').trim();
  const providerInstance = getProviderInstance({ providers: this.providers }, providerId);
  const provider = String(providerInstance?.provider || '')
    .trim()
    .toLowerCase();
  const currentModel = String(modelInput?.value || modelSelect?.value || '').trim();

  if (!provider) {
    this._profileEditorModels = [];
    if (modelSelect) populateModelSelectElement(modelSelect, [], currentModel, 'Select model...', modelDatalist);
    return;
  }

  // OAuth providers - fetch models from their APIs
  if (provider.endsWith('-oauth')) {
    const baseKey = provider.replace(/-oauth$/, '') as OAuthProviderKey;
    if (modelSelect) {
      const loadingOpt = document.createElement('option');
      loadingOpt.value = currentModel;
      loadingOpt.textContent = 'Fetching models...';
      modelSelect.innerHTML = '';
      modelSelect.appendChild(loadingOpt);
    }
    try {
      const modelIds = await fetchProviderModels(baseKey);
      this._profileEditorModels = modelIds.sort((a: string, b: string) => a.localeCompare(b));
      if (providerInstance && modelIds.length > 0) {
        let nextProvider = providerInstance;
        for (const modelId of modelIds) nextProvider = ensureProviderModel(nextProvider, modelId);
        this.providers = { ...(this.providers || {}), [nextProvider.id]: nextProvider };
      }
    } catch {
      this._profileEditorModels = [];
    }
    if (modelSelect) {
      populateModelSelectElement(
        modelSelect,
        this._profileEditorModels,
        currentModel,
        'Select model...',
        modelDatalist,
      );
    }
    return;
  }

  const apiKey = String(providerInstance?.apiKey || '').trim();
  const customEndpoint = String(providerInstance?.customEndpoint || '').trim();

  const endpointBase = normalizeEndpointBase(provider, customEndpoint);
  if (!endpointBase) {
    this._profileEditorModels = [];
    if (modelSelect) populateModelSelectElement(modelSelect, [], currentModel, 'Select model...', modelDatalist);
    return;
  }

  const allowsUnauthedList = provider === 'openrouter' || provider === 'parchi';
  if (!apiKey && !allowsUnauthedList) {
    this._profileEditorModels = [];
    if (modelSelect) populateModelSelectElement(modelSelect, [], currentModel, 'Select model...', modelDatalist);
    return;
  }

  // Show loading state
  if (modelSelect) {
    const loadingOpt = document.createElement('option');
    loadingOpt.value = currentModel;
    loadingOpt.textContent = 'Fetching models...';
    modelSelect.innerHTML = '';
    modelSelect.appendChild(loadingOpt);
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (provider === 'anthropic' || provider === 'kimi') {
    if (apiKey) {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    }
  } else if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (provider === 'openrouter' || provider === 'parchi') {
    headers['HTTP-Referer'] = 'https://parchi.ai';
    headers['X-Title'] = 'Parchi';
  }

  const target = { key: `editor|${provider}`, provider, endpointBase, headers };
  try {
    const modelIds = await this.fetchModelIdsForTarget(target);
    this._profileEditorModels = modelIds.sort((a: string, b: string) => a.localeCompare(b));
    if (providerInstance && modelIds.length > 0) {
      let nextProvider = providerInstance;
      for (const modelId of modelIds) nextProvider = ensureProviderModel(nextProvider, modelId);
      this.providers = { ...(this.providers || {}), [nextProvider.id]: nextProvider };
    }
  } catch {
    this._profileEditorModels = [];
  }
  if (modelSelect) {
    populateModelSelectElement(modelSelect, this._profileEditorModels, currentModel, 'Select model...', modelDatalist);
  }
};

sidePanelProto.updateModelSelectorGlow = function updateModelSelectorGlow() {
  const wrap = this.elements.modelSelectorWrap || document.getElementById('modelSelectorWrap');
  if (!wrap) return;
  const activeConfig = materializeProfileWithProvider(
    { providers: this.providers, configs: this.configs },
    this.currentConfig,
    this.configs?.[this.currentConfig] || {},
  );
  const provider = String(activeConfig?.provider || '')
    .trim()
    .toLowerCase();
  const isParchi = provider === 'parchi' || provider === 'openrouter';
  wrap.classList.toggle('parchi-glow', isParchi);
};

sidePanelProto.shortenModelName = function shortenModelName(model: string): string {
  if (!model) return 'unknown';
  // Remove common prefixes
  const clean = model
    .replace(/^claude-/, '')
    .replace(/^gpt-/, '')
    .replace(/^kimi-/, '');
  // Truncate if still long
  if (clean.length <= 20) return clean;
  return clean.slice(0, 19) + '…';
};

sidePanelProto.handleModelSelectChange = async function handleModelSelectChange() {
  const select = this.elements.modelSelect;
  if (!select) return;

  const selected = decodeModelSelectValue(select.value);
  if (!selected) return;
  const activeConfig = materializeProfileWithProvider(
    { providers: this.providers, configs: this.configs },
    this.currentConfig,
    this.configs?.[this.currentConfig] || {},
  );
  const activeProviderId = String(activeConfig?.providerId || '').trim();
  const activeModelId = String(activeConfig?.modelId || activeConfig?.model || '').trim();
  if (selected.providerId === activeProviderId && selected.modelId === activeModelId) return;

  try {
    this.selectModelFromGrid?.(selected.providerId, selected.modelId);
  } catch (error) {
    console.error('[Parchi] Failed to apply selected model:', error);
    this.updateStatus('Failed to switch model', 'error');
  }
};

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
