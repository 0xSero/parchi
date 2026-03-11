/**
 * Event Handler - Navigation Module
 * Navigation-related event handlers
 */

import { debounce } from './dom-utils.js';
import { bindSidebarNavigation } from './panel-navigation.js';
import { SidePanelUI } from './panel-ui.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Set up navigation-related event listeners
 */
export const setupNavigationListeners = function setupNavigationListeners(this: SidePanelUI & Record<string, unknown>) {
  bindSidebarNavigation(this.elements, {
    onOpen: () => this.openSettingsPanel(),
    onClose: () => this.closeSidebar(),
  });

  const stopOnClose = () => {
    this.requestRunStop('Stopped (panel closed)');
  };
  window.addEventListener('pagehide', stopOnClose);
  window.addEventListener('beforeunload', () => {
    stopOnClose();
    this.autoSaveSessionJsonl?.();
  });

  // Session buttons
  this.elements.startNewSessionBtn?.addEventListener('click', () => this.startNewSession());
  this.elements.newSessionFab?.addEventListener('click', () => this.startNewSession());
  this.elements.clearHistoryBtn?.addEventListener('click', () => this.clearAllHistory());

  // History drawer
  this.elements.historyFab?.addEventListener('click', () => this.openHistoryDrawer());
  this.elements.closeHistoryDrawerBtn?.addEventListener('click', () => this.closeHistoryDrawer());
  this.elements.historyDrawerScrim?.addEventListener('click', () => this.closeHistoryDrawer());
  this.elements.drawerClearHistoryBtn?.addEventListener('click', () => this.clearAllHistory());
  this.elements.drawerNewSessionBtn?.addEventListener('click', () => {
    this.closeHistoryDrawer();
    this.startNewSession();
  });
  this.elements.historySearchInput?.addEventListener(
    'input',
    debounce(() => {
      const query = (this.elements.historySearchInput?.value || '').trim();
      this.filterHistoryList(query);
    }, 150),
  );

  // Quick actions menu
  const closeQuickActionsMenu = () => {
    this.elements.quickActionsMenu?.classList.add('hidden');
  };

  this.elements.quickActionsFab?.addEventListener('click', (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    const menu = this.elements.quickActionsMenu as HTMLElement | null;
    if (!menu) return;
    menu.classList.toggle('hidden');
  });
  this.elements.quickActionMissionControl?.addEventListener('click', () => {
    closeQuickActionsMenu();
    this.toggleMissionControl?.();
  });
  this.elements.quickActionSettings?.addEventListener('click', () => {
    closeQuickActionsMenu();
    this.openSettingsPanel?.();
  });
  this.elements.quickActionHistory?.addEventListener('click', () => {
    closeQuickActionsMenu();
    this.openHistoryDrawer();
  });
  this.elements.quickActionNewSession?.addEventListener('click', () => {
    closeQuickActionsMenu();
    this.startNewSession();
  });
  document.getElementById('quickActionResetProfiles')?.addEventListener('click', () => {
    closeQuickActionsMenu();
    this.resetAllProfiles?.();
  });

  // Close quick actions when clicking outside
  document.addEventListener('click', (event: Event) => {
    const target = event.target as Node | null;
    if (!target) return;
    const quickMenu = this.elements.quickActionsMenu as HTMLElement | null;
    const quickButton = this.elements.quickActionsFab as HTMLElement | null;
    if (quickMenu && !quickMenu.classList.contains('hidden')) {
      if (!quickMenu.contains(target) && !quickButton?.contains(target)) closeQuickActionsMenu();
    }
  });
};

sidePanelProto.setupNavigationListeners = setupNavigationListeners;
