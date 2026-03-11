import {
  clearSessionHistoryStore,
  deleteSessionHistoryEntry,
  upsertSessionHistoryEntry,
} from '../../../state/stores/session-history-store.js';
import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.persistHistory = async function persistHistory() {
  // Default to saving history unless explicitly disabled
  const saveEnabled = this.elements.saveHistory?.value !== 'false';
  if (!saveEnabled) return;

  // Only persist if there's actual content
  if (!this.displayHistory || this.displayHistory.length === 0) return;

  const now = Date.now();
  const turns = Array.from(this.historyTurnMap.values())
    .filter((turn: any) => turn && typeof turn === 'object')
    .sort((a: any, b: any) => Number(a.startedAt || 0) - Number(b.startedAt || 0));

  const entry = {
    id: this.sessionId,
    startedAt: this.sessionStartedAt,
    updatedAt: now,
    title: this.firstUserMessage || 'Session',
    messageCount: this.displayHistory.length,
    transcript: this.displayHistory.slice(-200),
    contextTranscript: this.contextHistory.slice(-200),
    turns,
  };

  try {
    await upsertSessionHistoryEntry(entry);
    void this.loadHistoryList();
  } catch (e) {
    console.error('Failed to persist history:', e);
  }
};

sidePanelProto.deleteSession = async function deleteSession(sessionId: string) {
  try {
    await deleteSessionHistoryEntry(sessionId);
    void this.loadHistoryList();
  } catch (e) {
    console.error('Failed to delete session:', e);
  }
};

sidePanelProto.clearAllHistory = async function clearAllHistory() {
  // Use a two-click pattern instead of confirm() which freezes the sidepanel.
  // First click sets a flag; second click within 3s actually clears.
  const now = Date.now();
  if (this._clearHistoryPendingAt && now - this._clearHistoryPendingAt < 3000) {
    this._clearHistoryPendingAt = 0;
    try {
      await clearSessionHistoryStore();
      void this.loadHistoryList();
      this.updateStatus('History cleared', 'success');
    } catch (e) {
      console.error('Failed to clear history:', e);
    }
    return;
  }
  this._clearHistoryPendingAt = now;
  this.updateStatus('Click Clear again to confirm', 'warning');
};
