import type { SidePanelElements } from './panel-elements.js';

export type RightPanelName = 'settings' | null;

const PANEL_SELECTOR = '.right-panel-content';

export const setSidebarOpen = (elements: SidePanelElements, open: boolean) => {
  elements.sidebar?.classList.toggle('closed', !open);
  document.body.classList.toggle('sidebar-open', open);
  if (!open) {
    // Keep CSS state sane when panel is closed.
    document.body.removeAttribute('data-right-panel');
  }
};

export const showRightPanel = (elements: SidePanelElements, panelName: RightPanelName) => {
  const container = elements.rightPanelPanels ?? elements.rightPanel;
  if (!container) return;

  const panels = container.querySelectorAll(PANEL_SELECTOR);
  panels.forEach((panel: unknown) => (panel as HTMLElement).classList.add('hidden'));

  if (!panelName) {
    document.body.removeAttribute('data-right-panel');
    return;
  }

  const targetPanel = container.querySelector(`${PANEL_SELECTOR}[data-panel="${panelName}"]`) as HTMLElement | null;
  targetPanel?.classList.remove('hidden');
  document.body.dataset.rightPanel = panelName;
};

type NavigationHandlers = {
  onOpen: () => void;
  onClose: () => void;
};

export const bindSidebarNavigation = (elements: SidePanelElements, handlers: NavigationHandlers) => {
  elements.openSidebarBtn?.addEventListener('click', () => {
    const sidebar = elements.sidebar;
    if (!sidebar) {
      handlers.onOpen();
      return;
    }
    if (sidebar.classList.contains('closed')) {
      handlers.onOpen();
    } else {
      handlers.onClose();
    }
  });

  elements.closeSidebarBtn?.addEventListener('click', handlers.onClose);

  // Scrim click closes sidebar
  elements.sidebarScrim?.addEventListener('click', handlers.onClose);
};
