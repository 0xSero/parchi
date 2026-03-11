import { materializeProfileWithProvider } from '../../../state/provider-registry.js';
import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.renderProfileGrid = function renderProfileGrid() {
  if (!this.elements.agentGrid) return;
  this.elements.agentGrid.innerHTML = '';
  const currentVision = this.elements.visionProfile?.value;
  const currentOrchestrator = this.elements.orchestratorProfile?.value;
  const configs = Object.keys(this.configs);
  if (!configs.length) {
    this.elements.agentGrid.innerHTML = '<div class="history-empty">No profiles yet.</div>';
    return;
  }
  configs.forEach((name) => {
    const card = document.createElement('div');
    card.className = 'agent-card';
    const isEditing = name === this.profileEditorTarget;
    if (isEditing) {
      card.classList.add('editing');
    }
    card.dataset.profile = name;
    const config = materializeProfileWithProvider(
      { providers: this.providers, configs: this.configs },
      name,
      this.configs[name] || {},
    );
    const isOAuth = String(config.provider || '').endsWith('-oauth');
    if (isOAuth) card.classList.add('oauth-profile');
    const rolePills = ['main', 'vision', 'orchestrator', 'aux']
      .map((role) => {
        const isActive = this.isProfileActiveForRole(name, role, currentVision, currentOrchestrator);
        const label = this.getRoleLabel(role);
        return `<span class="role-pill ${isActive ? 'active' : ''} ${role}-pill" data-role="${role}" data-profile="${name}" title="Assign ${this.escapeHtml(
          name,
        )} as ${label.toLowerCase()} profile">${label}</span>`;
      })
      .join('');
    const deleteBtn =
      name !== 'default' && !isOAuth
        ? `<button class="agent-card-delete" data-delete-profile="${this.escapeHtml(name)}" title="Delete profile">&times;</button>`
        : '';
    const providerLabel =
      config.providerLabel || (isOAuth ? config.provider.replace(/-oauth$/, '') : config.provider || 'Provider');
    const oauthTag = isOAuth ? '<span class="oauth-badge">OAuth</span>' : '';
    card.innerHTML = `
        <div class="agent-card-header">
          <div>
            <h4>${this.escapeHtml(name)}${oauthTag}</h4>
            <span>${this.escapeHtml(providerLabel)} · ${this.escapeHtml(config.model || 'Model')}</span>
          </div>
          ${deleteBtn}
        </div>
        <div class="role-pills">${rolePills}</div>
        ${isEditing ? '<div class="agent-card-editor-slot"></div>' : ''}
      `;
    this.elements.agentGrid.appendChild(card);
  });

  if (!(this.elements.agentGrid as any)._profileGridBound) {
    (this.elements.agentGrid as any)._profileGridBound = true;
    this.elements.agentGrid.addEventListener('click', (event: Event) => {
      const target = event.target as HTMLElement;

      const deleteBtn = target.closest<HTMLElement>('[data-delete-profile]');
      if (deleteBtn) {
        event.stopPropagation();
        const profileName = deleteBtn.dataset.deleteProfile;
        if (profileName) this.deleteProfileByName(profileName);
        return;
      }

      const pill = target.closest<HTMLElement>('.role-pill');
      if (pill) {
        event.stopPropagation();
        const profileName = pill.dataset.profile;
        const role = pill.dataset.role;
        if (profileName && role) this.assignProfileRole(profileName, role);
        return;
      }

      const card = target.closest<HTMLElement>('.agent-card');
      if (card?.dataset.profile) {
        this.editProfile(card.dataset.profile, true);
      }
    });
  }

  this.mountProfileEditorInGrid?.();
};

sidePanelProto.mountProfileEditorInGrid = function mountProfileEditorInGrid() {
  const editor = this.elements.profileEditor as HTMLElement | null;
  const grid = this.elements.agentGrid as HTMLElement | null;
  if (!editor || !grid) return;

  const targetName = this.profileEditorTarget || this.currentConfig;
  const cards = Array.from(grid.querySelectorAll<HTMLElement>('.agent-card'));
  const targetCard = cards.find((card) => card.dataset.profile === targetName);
  const targetSlot = targetCard?.querySelector<HTMLElement>('.agent-card-editor-slot');

  if (!targetSlot) {
    if (grid.nextElementSibling !== editor) {
      grid.insertAdjacentElement('afterend', editor);
    }
    editor.classList.remove('profile-editor-inline');
    return;
  }

  targetSlot.appendChild(editor);
  editor.classList.add('profile-editor-inline');
};
