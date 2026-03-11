import { SidePanelUI } from '../core/panel-ui.js';
import { DEFAULT_THEME_ID, THEMES, applyTheme, getThemeById } from './themes.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.renderThemeGrid = function renderThemeGrid() {
  const select = this.elements.themeSelect as HTMLSelectElement | null;
  const preview = this.elements.themePreview as HTMLElement | null;
  if (!select) return;

  select.innerHTML = THEMES.map(
    (theme) => `<option value="${this.escapeHtml(theme.id)}">${this.escapeHtml(theme.name)}</option>`,
  ).join('');

  const activeThemeId = getThemeById(this.currentTheme || '') ? this.currentTheme : THEMES[0]?.id || DEFAULT_THEME_ID;
  this.currentTheme = activeThemeId;
  select.value = activeThemeId;

  if (preview) {
    const activeTheme = getThemeById(activeThemeId) || THEMES[0];
    if (activeTheme) {
      preview.innerHTML = `
        <div class="theme-preview-pill">
          <span class="theme-preview-dot" style="background:${activeTheme.preview.bg}; border-color:${activeTheme.preview.accent};"></span>
          <span class="theme-preview-name">${this.escapeHtml(activeTheme.name)}</span>
          <span class="theme-preview-count">${THEMES.length} themes</span>
        </div>
        <div class="theme-preview-swatches">
          <span class="theme-preview-swatch" style="background:${activeTheme.preview.bg}" title="Background"></span>
          <span class="theme-preview-swatch" style="background:${activeTheme.preview.card}" title="Surface"></span>
          <span class="theme-preview-swatch" style="background:${activeTheme.preview.accent}" title="Accent"></span>
          <span class="theme-preview-swatch theme-preview-foreground" style="background:${activeTheme.vars['--foreground'] || '#ffffff'}" title="Text"></span>
        </div>
      `;
    }
  }

  if (select.dataset.bound !== 'true') {
    select.addEventListener('change', () => this.setTheme(select.value));
    select.dataset.bound = 'true';
  }
};

sidePanelProto.setTheme = function setTheme(id: string) {
  this.currentTheme = id;
  applyTheme(id);
  this.renderThemeGrid();
  void import('../../../state/stores/settings-store.js').then(({ patchSettingsStoreSnapshot }) =>
    patchSettingsStoreSnapshot({ theme: id }).catch(() => {}),
  );
};
