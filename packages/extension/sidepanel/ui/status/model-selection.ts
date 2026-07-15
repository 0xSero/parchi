// Model selection UI - custom searchable dropdown (sitegeist-style)

import { listProviderInstances, materializeProfileWithProvider } from '../../../state/provider-registry.js';
import { SidePanelUI } from '../core/panel-ui.js';
import { encodeModelSelectValue } from './model-utils.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

interface ModelEntry {
  providerId: string;
  providerName: string;
  providerType: string;
  modelId: string;
  modelLabel: string;
  value: string;
}

let _allModels: ModelEntry[] = [];
let _selectedIndex = 0;
let _filteredCache: ModelEntry[] = [];

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isModelEnabled(ui: any, providerId: string, modelId: string): boolean {
  const enabledModels: Record<string, boolean> | undefined = ui._enabledComposerModels;
  if (!enabledModels) return true;
  const key = `${providerId}::${modelId}`;
  return enabledModels[key] !== false;
}

/** Subsequence match score — all query chars must appear in order. Higher = tighter. */
function subsequenceScore(query: string, text: string): number {
  let qi = 0;
  let ti = 0;
  let gaps = 0;
  let lastMatch = -1;
  while (qi < query.length && ti < text.length) {
    if (query[qi] === text[ti]) {
      if (lastMatch >= 0) gaps += ti - lastMatch - 1;
      lastMatch = ti;
      qi++;
    }
    ti++;
  }
  if (qi < query.length) return 0;
  return query.length / (query.length + gaps);
}

// ─── populateModelSelect ───────────────────────────────────────────────

sidePanelProto.populateModelSelect = function populateModelSelect() {
  const activeConfig = materializeProfileWithProvider(
    { providers: this.providers, configs: this.configs },
    this.currentConfig,
    this.configs?.[this.currentConfig] || {},
  );
  const activeProviderId = String(activeConfig?.providerId || '').trim();
  const activeModelId = String(activeConfig?.modelId || activeConfig?.model || '').trim();

  const providers = listProviderInstances({ providers: this.providers }).filter(
    (provider) => provider.isConnected && Array.isArray(provider.models) && provider.models.length > 0,
  );

  _allModels = [];
  for (const provider of providers) {
    for (const model of provider.models) {
      if (!isModelEnabled(this, provider.id, model.id)) continue;
      _allModels.push({
        providerId: provider.id,
        providerName: provider.name,
        providerType: provider.provider,
        modelId: model.id,
        modelLabel: model.label || model.id,
        value: encodeModelSelectValue(provider.id, model.id),
      });
    }
  }

  // Hidden select for compat
  const select = this.elements.modelSelect;
  if (select) {
    select.innerHTML = '';
    for (const m of _allModels) {
      const opt = document.createElement('option');
      opt.value = m.value;
      opt.textContent = `${m.providerName}/${m.modelLabel}`;
      if (m.providerId === activeProviderId && m.modelId === activeModelId) opt.selected = true;
      select.appendChild(opt);
    }
  }

  // Button label
  const label = this.elements.modelSelectorLabel;
  if (label) {
    const active = _allModels.find((m) => m.providerId === activeProviderId && m.modelId === activeModelId);
    label.textContent = active ? active.modelLabel : 'Select model';
  }

  this.updateModelSelectorGlow();
};

// ─── Render dropdown list ──────────────────────────────────────────────

sidePanelProto._renderModelDropdownList = function _renderModelDropdownList(query: string) {
  const list = this.elements.modelSelectorList;
  if (!list) return;
  list.innerHTML = '';

  const q = (query || '').toLowerCase().replace(/\s+/g, '');

  // Score & filter
  let filtered: ModelEntry[];
  if (q) {
    const scored: { m: ModelEntry; s: number }[] = [];
    for (const m of _allModels) {
      const text = `${m.providerName} ${m.modelId} ${m.modelLabel}`.toLowerCase();
      const s = subsequenceScore(q, text);
      if (s > 0) scored.push({ m, s });
    }
    scored.sort((a, b) => b.s - a.s);
    filtered = scored.map((x) => x.m);
  } else {
    filtered = _allModels;
  }

  _filteredCache = filtered;
  _selectedIndex = 0;

  if (!filtered.length) {
    list.innerHTML = '<div class="model-dropdown-empty">No matching models</div>';
    return;
  }

  const activeConfig = materializeProfileWithProvider(
    { providers: this.providers, configs: this.configs },
    this.currentConfig,
    this.configs?.[this.currentConfig] || {},
  );
  const activeProviderId = String(activeConfig?.providerId || '').trim();
  const activeModelId = String(activeConfig?.modelId || activeConfig?.model || '').trim();

  // Sort current model first when not searching
  if (!q) {
    filtered.sort((a, b) => {
      const aActive = a.providerId === activeProviderId && a.modelId === activeModelId;
      const bActive = b.providerId === activeProviderId && b.modelId === activeModelId;
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return 0;
    });
    _filteredCache = filtered;
  }

  let currentGroup = '';
  for (let i = 0; i < filtered.length; i++) {
    const m = filtered[i];
    const isActive = m.providerId === activeProviderId && m.modelId === activeModelId;

    if (m.providerName !== currentGroup) {
      currentGroup = m.providerName;
      const groupEl = document.createElement('div');
      groupEl.className = 'model-dropdown-group';
      groupEl.textContent = m.providerName;
      list.appendChild(groupEl);
    }

    const item = document.createElement('div');
    item.className = `model-dropdown-item${isActive ? ' active' : ''}${i === _selectedIndex ? ' selected' : ''}`;
    item.dataset.index = String(i);
    item.innerHTML = `
      <span class="model-dropdown-item-check">${isActive ? '✓' : ''}</span>
      <span class="model-dropdown-item-name">${escapeHtml(m.modelLabel)}</span>
      <span class="model-dropdown-item-badge">${escapeHtml(m.providerName)}</span>
    `;
    item.addEventListener('click', () => {
      this._selectFromModelDropdown?.(m.providerId, m.modelId);
    });
    item.addEventListener('mouseenter', () => {
      _selectedIndex = i;
      this._updateDropdownSelection?.();
    });
    list.appendChild(item);
  }
};

sidePanelProto._updateDropdownSelection = function _updateDropdownSelection() {
  const list = this.elements.modelSelectorList;
  if (!list) return;
  const items = list.querySelectorAll('.model-dropdown-item');
  items.forEach((el: Element, idx: number) => {
    el.classList.toggle('selected', idx === _selectedIndex);
  });
};

sidePanelProto._scrollDropdownToSelected = function _scrollDropdownToSelected() {
  const list = this.elements.modelSelectorList;
  if (!list) return;
  const items = list.querySelectorAll('.model-dropdown-item');
  const sel = items[_selectedIndex] as HTMLElement | undefined;
  sel?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};

// ─── Select ────────────────────────────────────────────────────────────

sidePanelProto._selectFromModelDropdown = function _selectFromModelDropdown(providerId: string, modelId: string) {
  this._closeModelDropdown?.();
  try {
    this.selectModelFromGrid?.(providerId, modelId);
  } catch (error) {
    console.error('[Parchi] Failed to apply selected model:', error);
    this.updateStatus('Failed to switch model', 'error');
  }
};

// ─── Open / Close / Position ───────────────────────────────────────────

sidePanelProto._openModelDropdown = function _openModelDropdown() {
  const dropdown = this.elements.modelSelectorDropdown;
  const search = this.elements.modelSelectorSearch;
  const trigger = this.elements.modelSelectorBtn || this.elements.modelSelectorWrap;

  if (!dropdown) return;

  // Portal to body if still inside the model-selector
  if (dropdown.parentElement !== document.body) {
    dropdown.parentElement?.removeChild(dropdown);
    document.body.appendChild(dropdown);
  }

  dropdown.classList.remove('hidden');

  // Position above the trigger
  if (trigger) {
    const rect = trigger.getBoundingClientRect();
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    dropdown.style.top = 'auto';
  }

  if (search) {
    search.value = '';
    search.focus();
  }
  this._renderModelDropdownList?.('');

  // Keyboard handler
  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      this._closeModelDropdown?.();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      _selectedIndex = Math.min(_selectedIndex + 1, _filteredCache.length - 1);
      this._updateDropdownSelection?.();
      this._scrollDropdownToSelected?.();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      _selectedIndex = Math.max(_selectedIndex - 1, 0);
      this._updateDropdownSelection?.();
      this._scrollDropdownToSelected?.();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const m = _filteredCache[_selectedIndex];
      if (m) this._selectFromModelDropdown?.(m.providerId, m.modelId);
      return;
    }
  };
  (this as any)._modelDropdownKeyHandler = keyHandler;
  document.addEventListener('keydown', keyHandler);

  // Outside click
  const clickHandler = (e: MouseEvent) => {
    if (dropdown && !dropdown.contains(e.target as Node) && !trigger?.contains(e.target as Node)) {
      this._closeModelDropdown?.();
    }
  };
  (this as any)._modelDropdownOutsideHandler = clickHandler;
  setTimeout(() => document.addEventListener('mousedown', clickHandler), 0);
};

sidePanelProto._closeModelDropdown = function _closeModelDropdown() {
  const dropdown = this.elements.modelSelectorDropdown;
  if (dropdown) dropdown.classList.add('hidden');
  if ((this as any)._modelDropdownOutsideHandler) {
    document.removeEventListener('mousedown', (this as any)._modelDropdownOutsideHandler);
    (this as any)._modelDropdownOutsideHandler = null;
  }
  if ((this as any)._modelDropdownKeyHandler) {
    document.removeEventListener('keydown', (this as any)._modelDropdownKeyHandler);
    (this as any)._modelDropdownKeyHandler = null;
  }
};

// ─── Glow / utility ────────────────────────────────────────────────────

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
  const clean = model
    .replace(/^claude-/, '')
    .replace(/^gpt-/, '')
    .replace(/^kimi-/, '');
  if (clean.length <= 20) return clean;
  return clean.slice(0, 19) + '\u2026';
};

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
