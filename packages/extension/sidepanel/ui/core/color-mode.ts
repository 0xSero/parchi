import { SidePanelUI } from './panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.applyBaseColorMode = function applyBaseColorMode(mode: 'light' | 'dark') {
  const root = document.documentElement;
  if (mode === 'light') {
    root.style.setProperty('--background', '#fafafa');
    root.style.setProperty('--foreground', '#09090b');
    root.style.setProperty('--muted', '#71717a');
    root.style.setProperty('--muted-dim', '#a1a1aa');
    root.style.setProperty('--border', '#e4e4e7');
    root.style.setProperty('--card', '#ffffff');
    root.style.setProperty('--card-hover', '#f4f4f5');
    root.style.setProperty('--card-inset', '#f4f4f5');
    root.style.setProperty('--ink-1', 'rgba(0, 0, 0, 0.04)');
    root.style.setProperty('--ink-2', 'rgba(0, 0, 0, 0.06)');
    root.style.setProperty('--ink-3', 'rgba(0, 0, 0, 0.12)');
  } else {
    root.style.setProperty('--background', '#09090b');
    root.style.setProperty('--foreground', '#fafafa');
    root.style.setProperty('--muted', '#a1a1aa');
    root.style.setProperty('--muted-dim', '#71717a');
    root.style.setProperty('--border', '#27272a');
    root.style.setProperty('--card', '#131315');
    root.style.setProperty('--card-hover', '#1a1a1d');
    root.style.setProperty('--card-inset', '#131316');
    root.style.setProperty('--ink-1', 'rgba(255, 255, 255, 0.05)');
    root.style.setProperty('--ink-2', 'rgba(255, 255, 255, 0.08)');
    root.style.setProperty('--ink-3', 'rgba(255, 255, 255, 0.14)');
  }
};

sidePanelProto.resolveSystemColorMode = function resolveSystemColorMode(): 'light' | 'dark' {
  const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
  return mediaQuery?.matches ? 'dark' : 'light';
};

sidePanelProto.clearSystemColorModeListener = function clearSystemColorModeListener() {
  if (!this._colorModeMediaQuery || !this._colorModeMediaQueryHandler) return;
  this._colorModeMediaQuery.removeEventListener('change', this._colorModeMediaQueryHandler);
  this._colorModeMediaQuery = null;
  this._colorModeMediaQueryHandler = null;
};

sidePanelProto.applyColorMode = function applyColorMode(
  mode: 'light' | 'dark' | 'system',
  { persist = true }: { persist?: boolean } = {},
) {
  this.currentColorMode = mode;

  let resolvedMode: 'light' | 'dark';
  if (mode === 'system') {
    resolvedMode = this.resolveSystemColorMode();
    if (!this._colorModeMediaQueryHandler) {
      this._colorModeMediaQueryHandler = () => {
        this.applyColorMode('system', { persist: false });
      };
    }
    if (!this._colorModeMediaQuery) {
      this._colorModeMediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)') || null;
      this._colorModeMediaQuery?.addEventListener('change', this._colorModeMediaQueryHandler);
    }
  } else {
    resolvedMode = mode;
    this.clearSystemColorModeListener();
  }

  document.documentElement.dataset.colorMode = resolvedMode;
  this.applyColorScheme?.(this.currentTheme || 'void', resolvedMode);

  if (persist) {
    void import('../../../state/stores/settings-store.js').then(({ patchSettingsStoreSnapshot }) =>
      patchSettingsStoreSnapshot({ colorMode: mode }).catch(() => {}),
    );
  }
};

sidePanelProto.setColorMode = function setColorMode(mode: 'light' | 'dark' | 'system') {
  this.applyColorMode(mode);
};
