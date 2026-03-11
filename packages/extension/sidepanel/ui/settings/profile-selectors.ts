import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.refreshConfigDropdown = function refreshConfigDropdown() {
  if (this.elements.activeConfig) {
    this.elements.activeConfig.innerHTML = '';
    Object.keys(this.configs).forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      if (name === this.currentConfig) {
        option.selected = true;
      }
      this.elements.activeConfig.appendChild(option);
    });
  }
  this.refreshProfileSelectors();
  this.updateModelDisplay();
  this.renderTeamProfileList?.();
  this.updateContextUsage();
};

sidePanelProto.refreshProfileSelectors = function refreshProfileSelectors() {
  const names = Object.keys(this.configs);
  const selects = [
    this.elements.orchestratorProfile,
    this.elements.visionProfile,
    this.elements.orchestratorProfileVisible,
  ];
  selects.forEach((select) => {
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">Use active config</option>';
    names.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });

    if (!currentValue) return;
    if (!names.includes(currentValue)) {
      select.value = '';
      return;
    }
    select.value = currentValue;
  });
};

sidePanelProto.toggleProfileRole = function toggleProfileRole(elementId: string, profileName: string) {
  const element = this.elements[elementId];
  if (!element) return;
  const isSelecting = element.value !== profileName;
  element.value = isSelecting ? profileName : '';
  if (elementId === 'orchestratorProfile') {
    if (this.elements.orchestratorToggle) {
      this.elements.orchestratorToggle.checked = isSelecting;
    }
    if (this.elements.orchestratorProfileSelectGroup) {
      this.elements.orchestratorProfileSelectGroup.style.display = isSelecting ? '' : 'none';
    }
  }
  this.renderProfileGrid();
  this.renderTeamProfileList?.();
};

sidePanelProto.toggleAuxProfile = function toggleAuxProfile(profileName: string) {
  const idx = this.auxAgentProfiles.indexOf(profileName);
  if (idx === -1) {
    this.auxAgentProfiles.push(profileName);
  } else {
    this.auxAgentProfiles.splice(idx, 1);
  }
  this.auxAgentProfiles = Array.from(new Set(this.auxAgentProfiles));
  this.renderProfileGrid();
};

sidePanelProto.getRoleLabel = function getRoleLabel(role: string) {
  switch (role) {
    case 'main':
      return 'Main';
    case 'vision':
      return 'Vision';
    case 'orchestrator':
      return 'Orchestrator';
    default:
      return 'Team';
  }
};

sidePanelProto.isProfileActiveForRole = function isProfileActiveForRole(
  name: string,
  role: string,
  visionName?: string,
  orchestratorName?: string,
) {
  if (role === 'main') return name === this.currentConfig;
  if (role === 'vision') return name && visionName === name;
  if (role === 'orchestrator') return name && orchestratorName === name;
  if (role === 'aux') return this.auxAgentProfiles.includes(name);
  return false;
};

sidePanelProto.assignProfileRole = function assignProfileRole(profileName: string, role: string) {
  if (!profileName) return;
  if (role === 'main') {
    this.setActiveConfig(profileName);
    return;
  }
  if (role === 'vision') {
    this.toggleProfileRole('visionProfile', profileName);
  } else if (role === 'orchestrator') {
    this.toggleProfileRole('orchestratorProfile', profileName);
  } else if (role === 'aux') {
    this.toggleAuxProfile(profileName);
  }
};
