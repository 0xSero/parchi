import { getSessionHistoryEntries, hydrateSessionHistoryStore } from '../../../state/stores/session-history-store.js';
import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

/**
 * Resolve the target container for history items.
 * Prefers the new drawer element, falls back to the old sidebar panel element.
 */
const resolveHistoryContainer = (self: any): HTMLElement | null => {
  // Prefer drawer container
  if (self.elements.historyDrawerItems) return self.elements.historyDrawerItems;
  // Re-query in case elements were captured before layout hydration
  const el = document.getElementById('historyDrawerItems');
  if (el) {
    self.elements.historyDrawerItems = el;
    return el;
  }
  // Fallback to legacy sidebar element
  if (self.elements.historyItems) return self.elements.historyItems;
  const legacy = document.getElementById('historyItems');
  if (legacy) {
    self.elements.historyItems = legacy;
    return legacy;
  }
  return null;
};

sidePanelProto.loadHistoryList = async function loadHistoryList() {
  const container = resolveHistoryContainer(this);
  if (!container) return;

  const saveEnabled = this.elements.saveHistory?.value !== 'false';
  if (!saveEnabled) {
    container.innerHTML =
      '<div class="history-empty">History is off. Enable "Save History" in Settings to see past chats.</div>';
    return;
  }

  try {
    await hydrateSessionHistoryStore();
    const sessions = getSessionHistoryEntries();
    container.innerHTML = '';

    if (!sessions.length) {
      container.innerHTML = '<div class="history-empty">No saved chats yet.</div>';
      return;
    }

    sessions.forEach((session: any) => {
      const item = document.createElement('div');
      item.className = 'history-item';
      item.dataset.title = (session.title || '').toLowerCase();
      const date = new Date(session.updatedAt || session.startedAt || Date.now());
      const msgCount = session.messageCount ?? session.transcript?.length ?? 0;
      const timeAgo = this.formatTimeAgo(date);

      const rawTitle = session.title || 'Untitled Session';
      const words = rawTitle.split(/\s+/);
      const truncatedTitle = words.length > 30 ? words.slice(0, 30).join(' ') + '...' : rawTitle;

      item.innerHTML = `
        <div class="history-item-main">
          <div class="history-title">${this.escapeHtml(truncatedTitle)}</div>
          <div class="history-meta">
            <span>${timeAgo}</span>
            <span class="history-meta-dot">·</span>
            <span>${msgCount} messages</span>
          </div>
        </div>
        <button class="history-delete" title="Delete" data-session-id="${session.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;

      // Click to load session
      item.querySelector('.history-item-main')?.addEventListener('click', () => {
        this.closeHistoryDrawer?.();
        this.loadSession(session);
      });

      // Delete button
      item.querySelector('.history-delete')?.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        this.deleteSession(session.id);
      });

      container.appendChild(item);
    });
  } catch (e) {
    console.error('Failed to load history:', e);
    container.innerHTML = '<div class="history-empty">Failed to load history.</div>';
  }
};

sidePanelProto.filterHistoryList = function filterHistoryList(query: string) {
  const container = resolveHistoryContainer(this);
  if (!container) return;
  const lowerQuery = query.toLowerCase();
  const items = container.querySelectorAll('.history-item');
  items.forEach((item: Element) => {
    const el = item as HTMLElement;
    if (!lowerQuery) {
      el.style.display = '';
      return;
    }
    const title = el.dataset.title || '';
    el.style.display = title.includes(lowerQuery) ? '' : 'none';
  });
};

sidePanelProto.formatTimeAgo = function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};
