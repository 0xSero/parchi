import { SidePanelUI } from '../core/panel-ui.js';

// ============================================================================
// Session Tabs HUD — Live floating tab strip showing model's active tabs
// ============================================================================

(SidePanelUI.prototype as any).handleSessionTabsUpdate = function handleSessionTabsUpdate(message: any) {
  const tabs = Array.isArray(message.tabs) ? message.tabs : [];
  const activeTabId = typeof message.activeTabId === 'number' ? message.activeTabId : null;
  const maxTabs = typeof message.maxTabs === 'number' ? message.maxTabs : 5;
  const groupTitle = typeof message.groupTitle === 'string' ? message.groupTitle : undefined;

  this.sessionTabsState = {
    ...this.sessionTabsState,
    tabs,
    activeTabId,
    maxTabs,
    groupTitle,
  };

  this.renderSessionTabsHud();
};

(SidePanelUI.prototype as any).setInteractingTab = function setInteractingTab(tabId: number | null) {
  const prev = this.sessionTabsState.interactingTabId;
  if (prev === tabId) return;
  this.sessionTabsState.interactingTabId = tabId;
  this.updateSessionTabInteractionState();
};

(SidePanelUI.prototype as any).renderSessionTabsHud = function renderSessionTabsHud() {
  const hud = this.elements.sessionTabsHud;
  const list = this.elements.sessionTabsList;
  const countEl = this.elements.sessionTabsCount;
  if (!hud || !list || !countEl) return;

  const { tabs, activeTabId, maxTabs, interactingTabId } = this.sessionTabsState;

  if (tabs.length === 0) {
    hud.classList.add('hidden');
    return;
  }

  hud.classList.remove('hidden');
  countEl.textContent = `${tabs.length}/${maxTabs}`;

  // Check if at limit
  if (tabs.length >= maxTabs) {
    countEl.classList.add('at-limit');
  } else {
    countEl.classList.remove('at-limit');
  }

  list.innerHTML = '';

  tabs.forEach((tab: any) => {
    const pill = document.createElement('div');
    pill.className = 'session-tab-pill';
    pill.dataset.tabId = String(tab.id);

    if (tab.id === activeTabId) {
      pill.classList.add('active');
    }
    if (tab.id === interactingTabId) {
      pill.classList.add('interacting');
    }

    const domain = this.formatTabLabel?.(tab.url) || '';
    const title = tab.title || domain || 'Tab';
    const truncatedTitle = title.length > 20 ? title.slice(0, 20) + '\u2026' : title;

    // Build favicon URL from domain
    let faviconHtml = '';
    if (tab.url) {
      try {
        const origin = new URL(tab.url).origin;
        const img = document.createElement('img');
        img.className = 'session-tab-favicon';
        img.src = `${origin}/favicon.ico`;
        img.alt = '';
        img.onerror = () => {
          img.style.display = 'none';
        };
        faviconHtml = img.outerHTML;
      } catch {
        // skip favicon for invalid URLs
      }
    }

    pill.innerHTML = `
      ${faviconHtml}
      <span class="session-tab-title">${this.escapeHtml(truncatedTitle)}</span>
      <span class="session-tab-activity"></span>
    `;

    pill.title = `${title}\n${tab.url || ''}`;

    list.appendChild(pill);
  });
};

(SidePanelUI.prototype as any).updateSessionTabInteractionState = function updateSessionTabInteractionState() {
  const list = this.elements.sessionTabsList;
  if (!list) return;

  const { interactingTabId } = this.sessionTabsState;
  const pills = list.querySelectorAll('.session-tab-pill');

  pills.forEach((pill: HTMLElement) => {
    const tabId = Number(pill.dataset.tabId);
    if (tabId === interactingTabId) {
      pill.classList.add('interacting');
    } else {
      pill.classList.remove('interacting');
    }
  });
};
