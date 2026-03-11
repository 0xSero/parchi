import { materializeProfileWithProvider } from '../../../state/provider-registry.js';
import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.renderTeamProfileList = function renderTeamProfileList() {
  const list = this.elements.teamProfileList as HTMLElement | null;
  if (!list) return;
  const names = Object.keys(this.configs || {}).filter((name) => name !== this.currentConfig);
  if (!names.length) {
    list.innerHTML = '<div class="history-empty">Create more profiles to assign team roles.</div>';
    return;
  }
  list.innerHTML = names
    .map((name) => {
      const checked = this.auxAgentProfiles.includes(name) ? 'checked' : '';
      const config = materializeProfileWithProvider(
        { providers: this.providers, configs: this.configs },
        name,
        this.configs[name] || {},
      );
      return `<label class="team-profile-item">
        <input type="checkbox" data-team-profile="${this.escapeHtml(name)}" ${checked} />
        <span class="team-profile-copy">
          <span class="team-profile-name">${this.escapeHtml(name)}</span>
          <span class="team-profile-meta">${this.escapeHtml(config.providerLabel || config.provider || 'Provider')} · ${this.escapeHtml(config.model || 'No model')}</span>
        </span>
      </label>`;
    })
    .join('');
};

sidePanelProto.createProfileFromInput = function createProfileFromInput() {
  const name = (this.elements.newProfileNameInput?.value || '').trim();
  if (!name) {
    this.updateStatus('Enter a profile name first', 'warning');
    return;
  }
  if (this.configs[name]) {
    this.updateStatus('Profile already exists', 'warning');
    return;
  }
  if (this.elements.newProfileNameInput) this.elements.newProfileNameInput.value = '';
  this.createNewConfig(name);
  this.editProfile(name, true);
};
