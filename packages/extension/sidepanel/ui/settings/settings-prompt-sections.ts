import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.updatePromptSections = function updatePromptSections() {
  const orchSection = this.elements.orchestratorPromptSection || document.getElementById('orchestratorPromptSection');
  const orchTextarea =
    this.elements.orchestratorPromptTextarea ||
    (document.getElementById('orchestratorPromptTextarea') as HTMLTextAreaElement | null);
  const visSection = this.elements.visionPromptSection || document.getElementById('visionPromptSection');
  const visTextarea =
    this.elements.visionPromptTextarea ||
    (document.getElementById('visionPromptTextarea') as HTMLTextAreaElement | null);

  if (orchSection) this.elements.orchestratorPromptSection = orchSection;
  if (orchTextarea) this.elements.orchestratorPromptTextarea = orchTextarea;
  if (visSection) this.elements.visionPromptSection = visSection;
  if (visTextarea) this.elements.visionPromptTextarea = visTextarea;

  const orchEnabled = this.elements.orchestratorToggle?.checked === true;
  const orchProfileName = this.elements.orchestratorProfile?.value || this.currentConfig;
  if (orchSection) {
    orchSection.classList.toggle('hidden', !orchEnabled);
  }
  if (orchEnabled && orchTextarea) {
    const orchProfile = this.configs[orchProfileName] || {};
    orchTextarea.value = orchProfile.systemPrompt || '';
  }

  const visProfileName = this.elements.visionProfile?.value;
  const visEnabled = !!visProfileName && visProfileName !== '' && visProfileName !== this.currentConfig;
  if (visSection) {
    visSection.classList.toggle('hidden', !visEnabled);
  }
  if (visEnabled && visTextarea) {
    const visProfile = this.configs[visProfileName] || {};
    visTextarea.value = visProfile.systemPrompt || '';
  }
};

sidePanelProto.savePromptSections = function savePromptSections() {
  const orchEnabled = this.elements.orchestratorToggle?.checked === true;
  if (orchEnabled && this.elements.orchestratorPromptTextarea) {
    const orchProfileName = this.elements.orchestratorProfile?.value || this.currentConfig;
    if (this.configs[orchProfileName]) {
      this.configs[orchProfileName].systemPrompt = this.elements.orchestratorPromptTextarea.value || '';
    }
  }

  const visProfileName = this.elements.visionProfile?.value;
  if (visProfileName && visProfileName !== this.currentConfig && this.elements.visionPromptTextarea) {
    if (this.configs[visProfileName]) {
      this.configs[visProfileName].systemPrompt = this.elements.visionPromptTextarea.value || '';
    }
  }
};
