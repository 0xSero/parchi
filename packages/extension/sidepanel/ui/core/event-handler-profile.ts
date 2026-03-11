/**
 * Event Handler - Profile Module
 * Profile editor event handlers
 */

import { debounce } from './dom-utils.js';
import { SidePanelUI } from './panel-ui.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Set up profile editor event listeners
 */
export const setupProfileListeners = function setupProfileListeners(this: SidePanelUI & Record<string, unknown>) {
  // Profile editor controls
  this.elements.profileEditorProvider?.addEventListener('change', () => {
    // Clear model fields whenever the provider changes so a stale model from a
    // previously-cloned or previously-edited profile never gets saved against
    // the wrong provider (e.g. gpt-4o saved under anthropic).
    const modelInput = this.elements.profileEditorModelInput as HTMLInputElement | null;
    const modelSelect = this.elements.profileEditorModel as HTMLSelectElement | null;
    if (modelInput) modelInput.value = '';
    if (modelSelect) modelSelect.value = '';
    this.toggleProfileEditorEndpoint();
    this.refreshModelCatalogForProfileEditor?.();
  });

  // Sync model text input to hidden select
  this.elements.profileEditorModelInput?.addEventListener('input', () => {
    const val = (this.elements.profileEditorModelInput?.value || '').trim();
    const select = this.elements.profileEditorModel as HTMLSelectElement | null;
    if (select) {
      if (val && !Array.from(select.options).some((o: HTMLOptionElement) => o.value === val)) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = val;
        select.insertBefore(opt, select.options[1] || null);
      }
      select.value = val;
    }
  });

  // Also refetch models when endpoint or API key changes (debounced)
  const debouncedModelRefresh = debounce(() => this.refreshModelCatalogForProfileEditor?.(), 800);
  this.elements.profileEditorEndpoint?.addEventListener('input', debouncedModelRefresh);
  this.elements.profileEditorApiKey?.addEventListener('input', debouncedModelRefresh);

  this.elements.profileEditorHeaders?.addEventListener('input', () => this.validateProfileEditorHeaders());
  this.elements.profileEditorTemperature?.addEventListener('input', () => {
    if (this.elements.profileEditorTemperatureValue) {
      this.elements.profileEditorTemperatureValue.textContent = this.elements.profileEditorTemperature.value;
    }
  });
  this.elements.saveProfileBtn?.addEventListener('click', () => this.saveProfileEdits());
  this.elements.profileEditorCancelBtn?.addEventListener('click', () =>
    this.editProfile(this.profileEditorTarget || this.currentConfig, true),
  );
  this.elements.refreshProfileJsonBtn?.addEventListener('click', () => this.refreshProfileJsonEditor());
  this.elements.copyProfileJsonBtn?.addEventListener('click', () => this.copyProfileJsonEditor());
  this.elements.applyProfileJsonBtn?.addEventListener('click', () => this.applyProfileJsonEditor());
};

sidePanelProto.setupProfileListeners = setupProfileListeners;
