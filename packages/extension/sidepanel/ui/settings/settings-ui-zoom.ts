import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

const FONT_PRESET_STACKS: Record<string, string> = {
  default: 'var(--font-sans-default)',
  geist: 'var(--font-sans-geist)',
  soft: 'var(--font-sans-soft)',
  'dm-sans': 'var(--font-sans-dm)',
  plex: 'var(--font-sans-plex)',
  manrope: 'var(--font-sans-manrope)',
};

const FONT_STYLE_WEIGHTS: Record<string, string> = {
  normal: '400',
  medium: '500',
  semibold: '600',
};

sidePanelProto.applyUiZoom = function applyUiZoom(value: number, { persist = true } = {}) {
  const next = Number.isFinite(value) ? value : 1;
  const clamped = Math.min(1.25, Math.max(0.85, next));
  this.uiZoom = clamped;
  document.documentElement.style.setProperty('--ui-zoom', String(clamped));
  if (this.elements.uiZoom) this.elements.uiZoom.value = clamped.toFixed(2);
  if (this.elements.uiZoomValue) this.elements.uiZoomValue.textContent = `${Math.round(clamped * 100)}%`;
  if (persist) {
    void import('../../../state/stores/settings-store.js').then(({ patchSettingsStoreSnapshot }) =>
      patchSettingsStoreSnapshot({ uiZoom: clamped }).catch(() => {}),
    );
  }
};

sidePanelProto.applyTypography = function applyTypography(preset: string, style: string, { persist = true } = {}) {
  const nextPreset = FONT_PRESET_STACKS[preset] ? preset : 'default';
  const nextStyle = FONT_STYLE_WEIGHTS[style] ? style : 'normal';
  this.fontPreset = nextPreset;
  this.fontStylePreset = nextStyle;
  document.documentElement.style.setProperty('--font-sans', FONT_PRESET_STACKS[nextPreset]);
  document.documentElement.style.setProperty('--font-base-weight', FONT_STYLE_WEIGHTS[nextStyle]);
  if (this.elements.fontPreset) this.elements.fontPreset.value = nextPreset;
  if (this.elements.fontStylePreset) this.elements.fontStylePreset.value = nextStyle;
  if (persist) {
    void import('../../../state/stores/settings-store.js').then(({ patchSettingsStoreSnapshot }) =>
      patchSettingsStoreSnapshot({ fontPreset: nextPreset, fontStylePreset: nextStyle }).catch(() => {}),
    );
  }
};

sidePanelProto.adjustUiZoom = function adjustUiZoom(delta: number) {
  const next = (this.uiZoom || 1) + delta;
  this.applyUiZoom(next);
};

sidePanelProto.syncAccountAvatar = function syncAccountAvatar() {
  const initialsEl = this.elements.settingsAccountAvatar;
  if (!initialsEl) return;
  const label = String(this.elements.accountUserValue?.textContent || '').trim();
  const fallback = label && label !== '-' ? label : 'Account';
  const parts = fallback.split(/[\s@._-]+/).filter(Boolean);
  const initials = (parts[0]?.[0] || 'A') + (parts[1]?.[0] || '');
  initialsEl.textContent = initials.slice(0, 2).toUpperCase();
};
