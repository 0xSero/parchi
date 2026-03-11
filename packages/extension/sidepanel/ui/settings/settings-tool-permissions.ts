import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.collectToolPermissions = function collectToolPermissions() {
  const fallback = this.toolPermissions || {
    read: true,
    interact: true,
    navigate: true,
    tabs: true,
    screenshots: true,
  };
  return {
    read: this.elements.permissionRead ? this.elements.permissionRead.checked !== false : fallback.read !== false,
    interact: this.elements.permissionInteract
      ? this.elements.permissionInteract.checked !== false
      : fallback.interact !== false,
    navigate: this.elements.permissionNavigate
      ? this.elements.permissionNavigate.checked !== false
      : fallback.navigate !== false,
    tabs: this.elements.permissionTabs ? this.elements.permissionTabs.checked !== false : fallback.tabs !== false,
    screenshots: this.elements.permissionScreenshots
      ? this.elements.permissionScreenshots.checked !== false
      : fallback.screenshots !== false,
  };
};

sidePanelProto.updateScreenshotToggleState = function updateScreenshotToggleState() {
  const activeProfile = this.configs?.[this.currentConfig] || {};
  const wantsScreens = activeProfile.enableScreenshots !== false;
  const visionProfile = this.elements.visionProfile?.value;
  const provider = activeProfile.provider;
  const hasVision = (provider && provider !== 'custom') || visionProfile;
  const controls: Array<any> = [];
  controls.forEach((ctrl) => {
    if (!ctrl) return;
    ctrl.disabled = !wantsScreens;
    ctrl.parentElement?.classList.toggle('disabled', !wantsScreens);
  });
  if (wantsScreens && !hasVision) {
    this.updateStatus('Enable a vision-capable profile before sending screenshots.', 'warning');
  }
};
