import { SidePanelUI } from '../core/panel-ui.js';
import type { BooleanBinding, NumberBinding } from './profile-bindings.js';
import { SETTINGS_FORM_BOOLEAN_BINDINGS, SETTINGS_FORM_NUMBER_BINDINGS } from './profile-bindings.js';
import { formatHeadersJson } from './profile-json-editor.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

export const readControlValue = (elements: Record<string, any>, elementKey: string) => {
  const control = elements[elementKey];
  return typeof control?.value === 'string' ? control.value : '';
};

export const setControlValue = (elements: Record<string, any>, elementKey: string, value: string | number) => {
  const control = elements[elementKey];
  if (!control || typeof control !== 'object' || !('value' in control)) return;
  control.value = String(value);
};

export const setCheckboxValue = (elements: Record<string, any>, elementKey: string, value: boolean) => {
  const control = elements[elementKey] as HTMLInputElement | null;
  if (!control) return;
  control.checked = value;
};

export const parseNumeric = (raw: string, fallback: number, parseMode: 'int' | 'float') => {
  const parsed = parseMode === 'float' ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toBooleanWithDefault = (value: unknown, defaultTrue: boolean) =>
  defaultTrue ? value !== false : value === true;

export const applyBooleanBindings = (
  elements: Record<string, any>,
  config: Record<string, any>,
  bindings: BooleanBinding[],
) => {
  bindings.forEach(({ elementKey, configKey, defaultTrue }) => {
    setCheckboxValue(elements, elementKey, toBooleanWithDefault(config[configKey], defaultTrue));
  });
};

export const readBooleanBindings = (elements: Record<string, any>, bindings: BooleanBinding[]) => {
  const result: Record<string, boolean> = {};
  bindings.forEach(({ elementKey, configKey, defaultTrue }) => {
    const control = elements[elementKey] as HTMLInputElement | null;
    result[configKey] = control ? control.checked : defaultTrue;
  });
  return result;
};

export const applyNumberBindings = (
  elements: Record<string, any>,
  config: Record<string, any>,
  bindings: NumberBinding[],
) => {
  bindings.forEach(({ elementKey, configKey, fallback, parseMode }) => {
    const rawValue = config[configKey];
    const rawString =
      typeof rawValue === 'number' ? String(rawValue) : typeof rawValue === 'string' && rawValue.trim() ? rawValue : '';
    const numeric = parseNumeric(rawString, fallback, parseMode);
    setControlValue(elements, elementKey, numeric);
  });
};

export const readNumberBindings = (elements: Record<string, any>, bindings: NumberBinding[]) => {
  const result: Record<string, number> = {};
  bindings.forEach(({ elementKey, configKey, fallback, parseMode }) => {
    result[configKey] = parseNumeric(readControlValue(elements, elementKey), fallback, parseMode);
  });
  return result;
};

sidePanelProto.populateFormFromConfig = function populateFormFromConfig(config: Record<string, any> = {}) {
  if (this.elements.provider) this.elements.provider.value = config.provider || '';
  if (this.elements.apiKey) this.elements.apiKey.value = config.apiKey || '';
  if (this.elements.model) {
    const modelVal = config.model || '';
    this.elements.model.value = modelVal;
  }
  if (this.elements.customEndpoint) this.elements.customEndpoint.value = config.customEndpoint || '';
  if (this.elements.customHeaders) {
    this.elements.customHeaders.value = formatHeadersJson(config.extraHeaders) || '';
  }
  if (this.elements.systemPrompt)
    this.elements.systemPrompt.value = config.systemPrompt || this.getDefaultSystemPrompt();
  applyNumberBindings(this.elements, config, SETTINGS_FORM_NUMBER_BINDINGS);
  if (this.elements.temperatureValue) {
    this.elements.temperatureValue.textContent = readControlValue(this.elements, 'temperature');
  }
  applyBooleanBindings(this.elements, config, SETTINGS_FORM_BOOLEAN_BINDINGS);
  if (this.elements.screenshotQuality) this.elements.screenshotQuality.value = config.screenshotQuality || 'high';
};
