import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;
type StoredSkill = { id?: string; name?: string; description?: string; sitePattern?: string; steps?: unknown[] };

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
  controls.forEach((ctrl: { disabled?: boolean; parentElement?: Element | null } | null | undefined) => {
    if (!ctrl) return;
    ctrl.disabled = !wantsScreens;
    ctrl.parentElement?.classList.toggle('disabled', !wantsScreens);
  });
  if (wantsScreens && !hasVision) {
    this.updateStatus('Enable a vision-capable profile before sending screenshots.', 'warning');
  }
};

sidePanelProto.renderSkillsList = async function renderSkillsList() {
  const list = document.getElementById('skillsList');
  if (!list) return;

  try {
    const data = await chrome.storage.local.get('skills');
    const skills = Array.isArray(data.skills) ? (data.skills as StoredSkill[]) : [];

    if (skills.length === 0) {
      list.innerHTML = '<div class="skills-empty">No skills saved yet. Record a workflow to create one.</div>';
      return;
    }

    list.innerHTML = '';
    for (const skill of skills) {
      const card = document.createElement('div');
      card.className = 'skill-card';
      const stepCount = Array.isArray(skill.steps) ? skill.steps.length : 0;
      const siteLabel = skill.sitePattern || 'any site';
      card.innerHTML = `
        <div class="skill-card-header">
          <span class="skill-card-name">${this.escapeHtml(skill.name || 'Unnamed')}</span>
          <span class="skill-card-meta">${stepCount} step${stepCount !== 1 ? 's' : ''}</span>
        </div>
        <div class="skill-card-desc">${this.escapeHtml(skill.description || '')}</div>
        <div class="skill-card-footer">
          <span class="skill-card-site">${this.escapeHtml(siteLabel)}</span>
          <div class="skill-card-actions">
            <button class="skill-export-btn icon-btn" title="Export">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            <button class="skill-delete-btn icon-btn" title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      `;

      const exportBtn = card.querySelector('.skill-export-btn');
      exportBtn?.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(skill, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(skill.name || 'skill').replace(/\s+/g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });

      const deleteBtn = card.querySelector('.skill-delete-btn');
      deleteBtn?.addEventListener('click', async () => {
        const updated = skills.filter((s: StoredSkill) => s.id !== skill.id);
        await chrome.storage.local.set({ skills: updated });
        this.renderSkillsList?.();
        this.updateStatus?.('Skill deleted', 'success');
      });

      list.appendChild(card);
    }
  } catch {
    list.innerHTML = '<div class="skills-empty">Failed to load skills.</div>';
  }
};
