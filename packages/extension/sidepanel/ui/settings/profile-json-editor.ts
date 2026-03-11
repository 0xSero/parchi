import { SidePanelUI } from '../core/panel-ui.js';
import { parseHeadersJson } from './settings-validation.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

export const formatHeadersJson = (headers: Record<string, any> | undefined) => {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return '';
  const entries = Object.entries(headers).filter(([_, value]) => value != null && String(value).length > 0);
  if (!entries.length) return '';
  const normalized = Object.fromEntries(entries.map(([key, value]) => [key, String(value)]));
  return JSON.stringify(normalized, null, 2);
};

export const resizeProfilePromptInput = (textarea: HTMLTextAreaElement | null) => {
  if (!textarea) return;
  textarea.style.height = 'auto';
  const nextHeight = Math.min(textarea.scrollHeight, 500);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > 500 ? 'auto' : 'hidden';
};

sidePanelProto.refreshProfileJsonEditor = function refreshProfileJsonEditor() {
  if (!this.elements.profileJsonEditor) return;
  const target = this.profileEditorTarget || this.currentConfig;
  const config = this.configs[target] || {};
  this.elements.profileJsonEditor.value = JSON.stringify(config, null, 2);
};

sidePanelProto.copyProfileJsonEditor = async function copyProfileJsonEditor() {
  if (!this.elements.profileJsonEditor) return;
  const text = this.elements.profileJsonEditor.value || '';
  if (!text.trim()) {
    this.updateStatus('Profile JSON is empty', 'warning');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    this.updateStatus('Profile JSON copied', 'success');
  } catch {
    this.updateStatus('Unable to copy profile JSON', 'error');
  }
};

sidePanelProto.applyProfileJsonEditor = async function applyProfileJsonEditor() {
  if (!this.elements.profileJsonEditor) return;
  const target = this.profileEditorTarget || this.currentConfig;
  if (!target || !this.configs[target]) {
    this.updateStatus('Select a profile to edit', 'warning');
    return;
  }
  const raw = this.elements.profileJsonEditor.value || '';
  if (!raw.trim()) {
    this.updateStatus('Paste profile JSON first', 'warning');
    return;
  }
  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    this.updateStatus('Invalid JSON format', 'error');
    return;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    this.updateStatus('Profile JSON must be an object', 'error');
    return;
  }
  const existing = this.configs[target] || {};
  if (parsed.extraHeaders && typeof parsed.extraHeaders === 'string') {
    try {
      parsed.extraHeaders = parseHeadersJson(parsed.extraHeaders);
    } catch {
      parsed.extraHeaders = existing.extraHeaders || {};
    }
  }
  this.configs[target] = { ...existing, ...parsed };
  await this.persistAllSettings({ silent: true });
  this.editProfile(target, true);
  if (target === this.currentConfig) {
    this.populateFormFromConfig(this.configs[target]);
  }
  this.updateStatus(`Profile "${target}" updated`, 'success');
};
