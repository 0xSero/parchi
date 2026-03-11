import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

const MAX_CHAT_TURNS = 100;
const PRUNE_PLACEHOLDER_CLASS = 'chat-pruned-placeholder';

sidePanelProto.pruneOldChatTurns = function pruneOldChatTurns() {
  const container = this.elements.chatMessages;
  if (!container) return;

  const turns = Array.from(container.querySelectorAll('.chat-turn'));
  const excess = turns.length - MAX_CHAT_TURNS;
  if (excess <= 0) return;

  // Preserve scroll position relative to bottom
  const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;

  let removed = 0;
  for (let i = 0; i < turns.length && removed < excess; i++) {
    const turn = turns[i] as HTMLElement;
    // Never remove a turn that's still streaming
    if (turn.querySelector('.streaming')) continue;
    turn.remove();
    removed++;
  }

  if (removed > 0) {
    // Insert or update placeholder at top
    let placeholder = container.querySelector(`.${PRUNE_PLACEHOLDER_CLASS}`) as HTMLElement | null;
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = PRUNE_PLACEHOLDER_CLASS;
      container.prepend(placeholder);
    }
    const totalPruned = Number(placeholder.dataset.count || 0) + removed;
    placeholder.dataset.count = String(totalPruned);
    placeholder.textContent = `${totalPruned} earlier messages hidden`;

    // Restore scroll position relative to bottom to prevent visual jump
    container.scrollTop = container.scrollHeight - container.clientHeight - scrollBottom;

    // Sweep toolCallViews — null out stale DOM refs for entries whose elements were pruned
    for (const entry of this.toolCallViews.values()) {
      if (entry.element && !entry.element.isConnected) {
        entry.abortController?.abort();
        entry.element = null;
        entry.statusEl = null;
        entry.durationEl = null;
      }
    }

    // Sweep reportImages — revoke blob URLs and remove orphaned non-selected images
    const orphanIds: string[] = [];
    for (const [id, img] of this.reportImages.entries()) {
      if (this.selectedReportImageIds.has(id)) continue;
      // Check if any live DOM preview references this image
      const livePreview = document.querySelector(`.report-image-toggle[data-report-image-id="${id}"]`);
      if (!livePreview) {
        if (img._blobUrl) URL.revokeObjectURL(img._blobUrl);
        orphanIds.push(id);
      }
    }
    for (const id of orphanIds) {
      this.reportImages.delete(id);
    }
    if (orphanIds.length > 0) {
      this.reportImageOrder = this.reportImageOrder.filter((id: string) => this.reportImages.has(id));
    }
  }
};
