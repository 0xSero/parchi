import { PROVIDER_REGISTRY, getAllProviders, getApiKeyProviders } from '../../../ai/providers/registry.js';
import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

const PROVIDER_ICONS: Record<string, string> = {
  anthropic: '\u{1F7E3}',
  openai: '\u{1F7E2}',
  kimi: '\u{1F535}',
  'ollama-cloud': '\u{26C5}',
  openrouter: '\u{1F7E0}',
  parchi: '\u{1F7E1}',
  custom: '\u{26AA}',
};

function getProviderIcon(key: string): string {
  const base = key.replace(/-oauth$/, '');
  return PROVIDER_ICONS[base] || '\u{26AA}';
}

sidePanelProto.renderApiProviderGrid = function renderApiProviderGrid() {
  const grid = this.elements.apiProviderGrid;
  if (!grid) return;
  grid.innerHTML = '';

  const apiProviders = getApiKeyProviders().filter((p) => p.key !== 'parchi');
  const configs = this.configs || {};

  for (const def of apiProviders) {
    const hasKey = this.providerHasApiKey(def.key, configs);
    const card = document.createElement('div');
    card.className = `provider-card${hasKey ? ' connected' : ''}`;
    card.dataset.providerKey = def.key;

    const statusText = hasKey ? 'Connected' : 'Not configured';
    const statusClass = hasKey ? 'status-connected' : 'status-none';
    const actionLabel = hasKey ? 'Edit' : 'Add Key';

    card.innerHTML = `
      <div class="provider-card-row">
        <span class="provider-card-icon">${getProviderIcon(def.key)}</span>
        <span class="provider-card-name">${def.name}</span>
        <span class="provider-card-status ${statusClass}">${statusText}</span>
      </div>
      <div class="provider-card-actions">
        <button class="btn btn-secondary provider-card-action" data-action="configure">${actionLabel}</button>
        ${hasKey ? '<button class="btn btn-secondary provider-card-action" data-action="remove">Remove</button>' : ''}
      </div>
    `;

    card.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === 'configure') {
        this.openProviderEditor(def.key);
      } else if (action === 'remove') {
        this.removeProviderKey(def.key);
      }
    });

    grid.appendChild(card);
  }
};

sidePanelProto.providerHasApiKey = function providerHasApiKey(providerKey: string, configs: Record<string, any>) {
  for (const name of Object.keys(configs)) {
    const cfg = configs[name];
    if (cfg?.provider === providerKey && String(cfg.apiKey || '').trim()) {
      return true;
    }
  }
  return false;
};

sidePanelProto.openProviderEditor = function openProviderEditor(providerKey: string) {
  const editor = this.elements.apiProviderEditor;
  if (!editor) return;

  const def = PROVIDER_REGISTRY[providerKey];
  if (!def) return;

  this._editingProviderKey = providerKey;
  editor.classList.remove('hidden');

  const configs = this.configs || {};
  let existingKey = '';
  let existingEndpoint = '';
  for (const name of Object.keys(configs)) {
    const cfg = configs[name];
    if (cfg?.provider === providerKey) {
      existingKey = cfg.apiKey || '';
      existingEndpoint = cfg.customEndpoint || '';
      break;
    }
  }

  if (this.elements.providerEditorKey) {
    this.elements.providerEditorKey.value = existingKey;
  }
  if (this.elements.providerEditorEndpoint) {
    this.elements.providerEditorEndpoint.value = existingEndpoint || '';
    this.elements.providerEditorEndpoint.placeholder = def.defaultBaseUrl || 'https://...';
  }
  const showEndpoint =
    providerKey === 'custom' ||
    providerKey === 'kimi' ||
    providerKey === 'openrouter' ||
    providerKey === 'ollama-cloud';
  if (this.elements.providerEditorEndpointGroup) {
    this.elements.providerEditorEndpointGroup.style.display = showEndpoint ? '' : 'none';
  }
};

sidePanelProto.saveProviderEditorConfig = function saveProviderEditorConfig() {
  const providerKey = this._editingProviderKey;
  if (!providerKey) return;

  const apiKey = this.elements.providerEditorKey?.value?.trim() || '';
  const endpoint = this.elements.providerEditorEndpoint?.value?.trim() || '';

  if (!apiKey) {
    this.updateStatus('API key is required', 'warning');
    return;
  }

  const configs = this.configs || {};
  let profileName = '';
  for (const name of Object.keys(configs)) {
    if (configs[name]?.provider === providerKey) {
      profileName = name;
      break;
    }
  }

  if (!profileName) {
    const def = PROVIDER_REGISTRY[providerKey];
    profileName = def?.name?.toLowerCase() || providerKey;
    if (configs[profileName]) profileName = `${profileName}-1`;
  }

  configs[profileName] = {
    ...(configs[profileName] || {}),
    provider: providerKey,
    apiKey,
    customEndpoint: endpoint,
  };

  this.configs = configs;
  this.closeProviderEditor();
  void this.persistAllSettings();
  this.renderApiProviderGrid();
  this.renderProfileGrid?.();
  this.refreshConfigDropdown?.();
  this.updateStatus(`${PROVIDER_REGISTRY[providerKey]?.name || providerKey} configured`, 'success');
};

sidePanelProto.removeProviderKey = function removeProviderKey(providerKey: string) {
  const configs = this.configs || {};
  for (const name of Object.keys(configs)) {
    if (configs[name]?.provider === providerKey) {
      configs[name].apiKey = '';
      break;
    }
  }
  this.configs = configs;
  void this.persistAllSettings();
  this.renderApiProviderGrid();
  this.updateStatus('Provider key removed', 'success');
};

sidePanelProto.closeProviderEditor = function closeProviderEditor() {
  this._editingProviderKey = null;
  this.elements.apiProviderEditor?.classList.add('hidden');
};

sidePanelProto.populateProviderDropdown = function populateProviderDropdown() {
  const select = this.elements.profileEditorProvider as HTMLSelectElement | null;
  if (!select) return;

  select.innerHTML = '';
  const emptyOpt = document.createElement('option');
  emptyOpt.value = '';
  emptyOpt.textContent = 'Select provider...';
  select.appendChild(emptyOpt);

  const allProviders = getAllProviders();
  const apiKeyGroup = document.createElement('optgroup');
  apiKeyGroup.label = 'API Key';
  const oauthGroup = document.createElement('optgroup');
  oauthGroup.label = 'OAuth';
  const managedGroup = document.createElement('optgroup');
  managedGroup.label = 'Managed';

  for (const def of allProviders) {
    const opt = document.createElement('option');
    opt.value = def.key;
    opt.textContent = def.name;
    if (def.type === 'oauth') {
      oauthGroup.appendChild(opt);
    } else if (def.type === 'managed') {
      managedGroup.appendChild(opt);
    } else {
      apiKeyGroup.appendChild(opt);
    }
  }

  if (apiKeyGroup.children.length > 0) select.appendChild(apiKeyGroup);
  if (oauthGroup.children.length > 0) select.appendChild(oauthGroup);
  if (managedGroup.children.length > 0) select.appendChild(managedGroup);
};

sidePanelProto.initProviderCardListeners = function initProviderCardListeners() {
  this.elements.providerEditorSaveBtn?.addEventListener('click', () => this.saveProviderEditorConfig());
  this.elements.providerEditorCancelBtn?.addEventListener('click', () => this.closeProviderEditor());
};
