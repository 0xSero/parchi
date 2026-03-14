import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

export const parseHeadersJson = (raw: string): Record<string, string> => {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Headers must be a JSON object');
  }
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, value == null ? '' : String(value)]));
};

sidePanelProto.validateCustomEndpoint = function validateCustomEndpoint() {
  if (!this.elements.customEndpoint) return true;
  const url = this.elements.customEndpoint.value.trim();
  if (!url) return true;
  try {
    new URL(url);
    this.elements.customEndpoint.style.borderColor = '';
    return true;
  } catch {
    this.elements.customEndpoint.style.borderColor = 'var(--status-error)';
    return false;
  }
};

sidePanelProto.validateCustomHeaders = function validateCustomHeaders() {
  if (!this.elements.customHeaders) return true;
  const raw = this.elements.customHeaders.value || '';
  if (!raw.trim()) {
    this.elements.customHeaders.style.borderColor = '';
    return true;
  }
  try {
    parseHeadersJson(raw);
    this.elements.customHeaders.style.borderColor = '';
    return true;
  } catch {
    this.elements.customHeaders.style.borderColor = 'var(--status-error)';
    return false;
  }
};

sidePanelProto.validateProfileEditorHeaders = function validateProfileEditorHeaders() {
  if (!this.elements.profileEditorHeaders) return true;
  const raw = this.elements.profileEditorHeaders.value || '';
  if (!raw.trim()) {
    this.elements.profileEditorHeaders.style.borderColor = '';
    return true;
  }
  try {
    parseHeadersJson(raw);
    this.elements.profileEditorHeaders.style.borderColor = '';
    return true;
  } catch {
    this.elements.profileEditorHeaders.style.borderColor = 'var(--status-error)';
    return false;
  }
};

sidePanelProto.toggleCustomEndpoint = function toggleCustomEndpoint() {
  const provider = this.elements.provider?.value;
  const isCustom = provider === 'custom' || provider === 'kimi' || provider === 'openrouter';

  if (this.elements.customEndpointGroup) {
    this.elements.customEndpointGroup.classList.toggle('required', isCustom);
  }

  if (this.elements.customEndpoint) {
    if (provider === 'kimi') {
      if (
        !this.elements.customEndpoint.value ||
        this.elements.customEndpoint.value === 'https://openrouter.ai/api/v1'
      ) {
        this.elements.customEndpoint.value = 'https://api.kimi.com/coding';
      }
      this.elements.customEndpoint.placeholder = 'https://api.kimi.com/coding';
    } else if (provider === 'openrouter') {
      this.elements.customEndpoint.placeholder = 'https://openrouter.ai/api/v1';
      if (!this.elements.customEndpoint.value || this.elements.customEndpoint.value === 'https://api.kimi.com/coding') {
        this.elements.customEndpoint.value = 'https://openrouter.ai/api/v1';
      }
    } else if (isCustom) {
      this.elements.customEndpoint.placeholder = 'https://openrouter.ai/api/v1';
    } else {
      this.elements.customEndpoint.placeholder = 'Leave empty for default API URL';
    }
  }

  const modelHint = document.getElementById('modelHint');
  if (modelHint) {
    switch (provider) {
      case 'parchi':
        modelHint.textContent = 'Managed routing via Stripe billing. Default: moonshotai/kimi-k2.5.';
        break;
      case 'anthropic':
        modelHint.textContent = 'Recommended: claude-sonnet-4-20250514';
        break;
      case 'openai':
        modelHint.textContent = 'Recommended: gpt-4o or gpt-4-turbo';
        break;
      case 'kimi':
        modelHint.textContent = 'Recommended: kimi-for-coding (or your Kimi model ID)';
        break;
      case 'openrouter':
        modelHint.textContent = 'e.g. anthropic/claude-sonnet-4, openai/gpt-4o, google/gemini-2.0-flash';
        break;
      case 'custom':
        modelHint.textContent = 'Enter the model ID from your provider';
        break;
      default:
        modelHint.textContent = '';
    }
  }
};

sidePanelProto.toggleProfileEditorEndpoint = function toggleProfileEditorEndpoint() {
  if (!this.elements.profileEditorEndpointGroup) return;
  const provider = this.elements.profileEditorProvider?.value;
  this.elements.profileEditorEndpointGroup.style.display =
    provider === 'custom' || provider === 'kimi' || provider === 'openrouter' ? 'block' : 'none';
};
