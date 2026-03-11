// Model selection UI - populating dropdowns and handling model selection

import { listProviderInstances, materializeProfileWithProvider } from '../../../state/provider-registry.js';
import { SidePanelUI } from '../core/panel-ui.js';
import { encodeModelSelectValue } from './model-utils.js';

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

/**
 * Populate the model selection dropdown with available models.
 */
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
  // Remove common prefixes
  const clean = model
    .replace(/^claude-/, '')
    .replace(/^gpt-/, '')
    .replace(/^kimi-/, '');
  // Truncate if still long
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
