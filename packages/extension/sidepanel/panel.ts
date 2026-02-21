import './ui/panel-modules.js';
import './ui/account/panel-account.js';
import { loadPanelLayout } from './ui/core/layout-loader.js';
import { SidePanelUI } from './ui/core/panel-ui.js';

const init = async () => {
  // Apply Safari theme when running in Safari
  if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome') && !navigator.userAgent.includes('Firefox')) {
    document.body.setAttribute('data-theme', 'safari');
  }

  await loadPanelLayout();
  const ui = new SidePanelUI();
  // Expose for debugging
  (window as any).sidePanelUI = ui;
};

void init();
