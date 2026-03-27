import './ui/panel-modules.js';
import './ui/account/panel-account.js';
import { hydrateSessionHistoryStore, startSessionHistoryStoreSync } from '../state/stores/session-history-store.js';
import { hydrateSettingsStore, startSettingsStoreSync } from '../state/stores/settings-store.js';
import { loadPanelLayout } from './ui/core/layout-loader.js';
import { SidePanelUI } from './ui/core/panel-ui.js';

declare const __PERF_DEBUG__: boolean;

const init = async () => {
  await loadPanelLayout();
  startSettingsStoreSync();
  startSessionHistoryStoreSync();
  void hydrateSettingsStore().catch((err) => {
    console.warn('[panel] Settings hydration failed:', err);
  });
  void hydrateSessionHistoryStore().catch((err) => {
    console.warn('[panel] Session history hydration failed:', err);
  });
  const ui = new SidePanelUI();
  const debugWindow = window as Window & { sidePanelUI?: SidePanelUI; __PERF_DEBUG__?: boolean };
  debugWindow.sidePanelUI = ui;

  if (__PERF_DEBUG__ || debugWindow.__PERF_DEBUG__) {
    const { perfMonitor } = await import('../utils/perf-monitor.js');
    perfMonitor.start();
  }
};

void init().catch((err) => {
  console.error('[panel] Sidepanel initialization failed:', err);
});
