// Model selection UI - populating dropdowns and handling model selection

import { listProviderInstances, materializeProfileWithProvider } from '../../../state/provider-registry.js';
import { SidePanelUI } from '../core/panel-ui.js';
import { decodeModelSelectValue, encodeModelSelectValue } from './model-utils.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

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

type ModelEntry = {
  providerId: string;
  providerName: string;
  providerType: string;
  modelId: string;
  modelLabel: string;
  indicator: string;
  value: string;
  isActive: boolean;
};

let cachedEntries: ModelEntry[] = [];
let dropdownOpen = false;

function getModelEntries(self: any): ModelEntry[] {
  const activeConfig = materializeProfileWithProvider(
    { providers: self.providers, configs: self.configs },
    self.currentConfig,
    self.configs?.[self.currentConfig] || {},
  );
  const activeProviderId = String(activeConfig?.providerId || '').trim();
  const activeModelId = String(activeConfig?.modelId || activeConfig?.model || '').trim();
  const providers = listProviderInstances({ providers: self.providers }).filter(
    (provider: any) => provider.isConnected && Array.isArray(provider.models) && provider.models.length > 0,
  );
  const visibleModels: string[] = self.visibleModels || [];

  const entries: ModelEntry[] = [];
  for (const provider of providers) {
    const indicator = providerIndicators[provider.provider.replace(/-oauth$/, '').toLowerCase()] || '◇';
    for (const model of provider.models) {
      const modelKey = `${provider.id}::${model.id}`;
      const isActive = provider.id === activeProviderId && model.id === activeModelId;
      // Only show models the user has checked, or the active one
      if (visibleModels.length > 0 && !visibleModels.includes(modelKey) && !isActive) continue;
      entries.push({
        providerId: provider.id,
        providerName: provider.name,
        providerType: provider.provider,
        modelId: model.id,
        modelLabel: model.label || model.id,
        indicator,
        value: encodeModelSelectValue(provider.id, model.id),
        isActive,
      });
    }
  }
  return entries;
}

function updateTriggerLabel(_self: any) {
  const label = document.getElementById('modelSelectorLabel');
  if (!label) return;
  const active = cachedEntries.find((e) => e.isActive);
  if (active) {
    label.textContent = `${active.indicator} ${active.providerName}/${active.modelLabel}`;
  } else {
    label.textContent = 'Profile';
  }
}

function renderDropdownList(filter = '') {
  const list = document.getElementById('modelSelectorList');
  if (!list) return;
  list.innerHTML = '';

  const query = filter.toLowerCase().trim();
  const filtered = query
    ? cachedEntries.filter(
        (e) =>
          e.modelLabel.toLowerCase().includes(query) ||
          e.modelId.toLowerCase().includes(query) ||
          e.providerName.toLowerCase().includes(query),
      )
    : cachedEntries;

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'model-selector-empty-item';
    empty.textContent = query ? 'No matching models' : 'No connected models';
    list.appendChild(empty);
    return;
  }

  let lastProvider = '';
  for (const entry of filtered) {
    if (entry.providerName !== lastProvider) {
      lastProvider = entry.providerName;
      const groupLabel = document.createElement('div');
      groupLabel.className = 'model-selector-group';
      groupLabel.textContent = entry.providerName;
      list.appendChild(groupLabel);
    }

    const item = document.createElement('div');
    item.className = `model-selector-item${entry.isActive ? ' active' : ''}`;
    item.dataset.value = entry.value;
    item.innerHTML = `<span class="model-selector-item-indicator">${entry.indicator}</span><span class="model-selector-item-label">${entry.modelLabel}</span>`;
    list.appendChild(item);
  }
}

function openDropdown(self: any) {
  const dropdown = document.getElementById('modelSelectorDropdown');
  const trigger = document.getElementById('modelSelectorTrigger');
  const search = document.getElementById('modelSelectorSearch') as HTMLInputElement | null;
  if (!dropdown || !trigger) return;
  cachedEntries = getModelEntries(self);
  renderDropdownList();
  dropdown.classList.remove('hidden');
  dropdownOpen = true;

  // Position dropdown above the trigger using fixed positioning
  const rect = trigger.getBoundingClientRect();
  const availableAbove = rect.top - 12;
  const dropdownHeight = Math.min(480, availableAbove);
  dropdown.style.left = `${Math.max(12, rect.left)}px`;
  dropdown.style.bottom = `${window.innerHeight - rect.top + 6}px`;
  dropdown.style.maxHeight = `${dropdownHeight}px`;

  if (search) {
    search.value = '';
    setTimeout(() => search.focus(), 50);
  }
}

function closeDropdown() {
  const dropdown = document.getElementById('modelSelectorDropdown');
  if (!dropdown) return;
  dropdown.classList.add('hidden');
  dropdownOpen = false;
}

/**
 * Populate the model selection dropdown with available models.
 */
sidePanelProto.populateModelSelect = function populateModelSelect() {
  // Keep the hidden <select> in sync for any code that reads its value
  let select = this.elements.modelSelect;
  if (!select) {
    select = document.getElementById('modelSelect') as HTMLSelectElement;
    if (select) this.elements.modelSelect = select;
  }

  cachedEntries = getModelEntries(this);

  if (select) {
    select.innerHTML = '';
    for (const entry of cachedEntries) {
      const option = document.createElement('option');
      option.value = entry.value;
      option.textContent = `${entry.indicator} ${entry.providerName}/${entry.modelLabel}`;
      if (entry.isActive) option.selected = true;
      select.appendChild(option);
    }
  }

  updateTriggerLabel(this);
  if (dropdownOpen) renderDropdownList();
  this.updateModelSelectorGlow();
};

/**
 * Update the model selector glow effect based on active provider.
 */
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

/**
 * Shorten a model name for display.
 */
sidePanelProto.shortenModelName = function shortenModelName(model: string): string {
  if (!model) return 'unknown';
  const clean = model
    .replace(/^claude-/, '')
    .replace(/^gpt-/, '')
    .replace(/^kimi-/, '');
  if (clean.length <= 20) return clean;
  return clean.slice(0, 19) + '…';
};

/**
 * Handle model selection change from dropdown.
 */
sidePanelProto.handleModelSelectChange = async function handleModelSelectChange() {
  const select = this.elements.modelSelect;
  if (!select) return;

  const { decodeModelSelectValue } = await import('./model-utils.js');
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

/**
 * Initialize the searchable model selector dropdown.
 */
sidePanelProto.initSearchableModelSelector = function initSearchableModelSelector() {
  const trigger = document.getElementById('modelSelectorTrigger');
  if (!trigger) return;

  // Create the dropdown DOM and append to body (escapes overflow:hidden ancestors)
  let dropdown = document.getElementById('modelSelectorDropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.id = 'modelSelectorDropdown';
    dropdown.className = 'model-selector-dropdown hidden';
    dropdown.innerHTML = `
      <div class="model-selector-search-wrap">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input id="modelSelectorSearch" class="model-selector-search" type="text" placeholder="Search models..." autocomplete="off" />
      </div>
      <div id="modelSelectorList" class="model-selector-list"></div>
    `;
    document.body.appendChild(dropdown);
  }

  const search = document.getElementById('modelSelectorSearch') as HTMLInputElement | null;
  const list = document.getElementById('modelSelectorList');

  trigger.addEventListener('click', (e: Event) => {
    e.stopPropagation();
    if (dropdownOpen) {
      closeDropdown();
    } else {
      openDropdown(this);
    }
  });

  if (search) {
    search.addEventListener('input', () => {
      renderDropdownList(search.value);
    });
    search.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDropdown();
      } else if (e.key === 'Enter') {
        const first = list?.querySelector('.model-selector-item:not(.active)') as HTMLElement | null;
        if (first) first.click();
      }
    });
  }

  if (list) {
    list.addEventListener('click', (e: Event) => {
      const item = (e.target as HTMLElement).closest('.model-selector-item') as HTMLElement | null;
      if (!item) return;
      const value = item.dataset.value || '';
      const decoded = decodeModelSelectValue(value);
      if (decoded) {
        this.selectModelFromGrid?.(decoded.providerId, decoded.modelId);
      }
      closeDropdown();
    });
  }

  // Close on outside click
  document.addEventListener('click', (e: Event) => {
    if (!dropdownOpen) return;
    const wrap = document.getElementById('modelSelectorWrap');
    if (wrap && !wrap.contains(e.target as Node) && dropdown && !dropdown.contains(e.target as Node)) {
      closeDropdown();
    }
  });
};
