import { createMessage, normalizeConversationHistory } from '../../../ai/message-schema.js';
import type { Message } from '../../../ai/message-schema.js';
import { dedupeThinking, extractThinking } from '../../../ai/message-utils.js';
import { SidePanelUI } from '../core/panel-ui.js';

const normalizeStoredSessions = (raw: any): any[] => {
  if (Array.isArray(raw)) {
    return raw.filter(Boolean);
  }
  if (raw && typeof raw === 'object') {
    return Object.values(raw).filter(Boolean);
  }
  return [];
};

const normalizeTranscript = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') return Object.values(parsed).filter(Boolean);
      return [];
    } catch {
      return [];
    }
  }
  return [];
};

(SidePanelUI.prototype as any).persistHistory = async function persistHistory() {
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
    turns,
  };

  try {
    const existing = await chrome.storage.local.get(['chatSessions']);
    const sessions = normalizeStoredSessions(existing.chatSessions);
    const filtered = sessions.filter((s: any) => s?.id !== entry.id);
    filtered.unshift(entry);
    const trimmed = filtered.slice(0, 50); // Keep more sessions
    await chrome.storage.local.set({ chatSessions: trimmed });
    this.loadHistoryList();
  } catch (e) {
    console.error('Failed to persist history:', e);
  }
};

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

(SidePanelUI.prototype as any).loadHistoryList = async function loadHistoryList() {
  const container = resolveHistoryContainer(this);
  if (!container) return;

  const saveEnabled = this.elements.saveHistory?.value !== 'false';
  if (!saveEnabled) {
    container.innerHTML =
      '<div class="history-empty">History is off. Enable "Save History" in Settings to see past chats.</div>';
    return;
  }

  try {
    const { chatSessions } = await chrome.storage.local.get(['chatSessions']);
    const sessions = normalizeStoredSessions(chatSessions);
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
      const transcript = normalizeTranscript(session.transcript);
      const msgCount = session.messageCount || transcript.length || 0;
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

(SidePanelUI.prototype as any).filterHistoryList = function filterHistoryList(query: string) {
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

(SidePanelUI.prototype as any).loadSession = function loadSession(session: any) {
  this.switchView('chat');
  this.recordScrollPosition();

  const transcript = normalizeTranscript(session.transcript);
  let turns = normalizeTranscript(session.turns);
  if (turns.length > 0 && transcript.length > 0) {
    const normalizedTranscript = normalizeConversationHistory(transcript as unknown as Message[]);
    const userQueue = normalizedTranscript.filter((msg) => msg.role === 'user');
    const assistantQueue = normalizedTranscript.filter((msg) => msg.role === 'assistant');
    const takeUser = () => userQueue.shift();
    const takeAssistant = () => assistantQueue.shift();

    turns = turns.map((turn: any) => {
      const updated = { ...turn };
      if (!updated.userMessage) {
        const userMessage = takeUser();
        if (userMessage) {
          updated.userMessage =
            typeof userMessage.content === 'string' ? userMessage.content : this.safeJsonStringify(userMessage.content);
        }
      }
      if (!updated.assistantFinal?.content) {
        const assistantMessage = takeAssistant();
        if (assistantMessage) {
          updated.assistantFinal = {
            content:
              typeof assistantMessage.content === 'string'
                ? assistantMessage.content
                : this.safeJsonStringify(assistantMessage.content),
            thinking: assistantMessage.thinking || null,
          };
        }
      }
      return updated;
    });
  }
  if (turns.length > 0) {
    this.isReplayingHistory = true;
    try {
      this.displayHistory = [];
      this.contextHistory = [];
      const suffix = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now());
      this.sessionId = session.id || `session-${suffix}`;
      this.firstUserMessage = session.title || '';
      this.elements.chatMessages.innerHTML = '';
      this.toolCallViews.clear();
      this.resetActivityPanel();

      turns.forEach((turn: any) => {
        const userText = String(turn.userMessage || '').trim();
        if (userText) {
          this.displayUserMessage(userText);
          const entry = createMessage({ role: 'user', content: userText });
          if (entry) {
            this.displayHistory.push(entry);
            this.contextHistory.push(entry);
          }
        }

        if (turn.plan) {
          this.applyPlanUpdate(turn.plan);
        }

        const toolEvents = Array.isArray(turn.toolEvents) ? turn.toolEvents : [];
        toolEvents.forEach((evt) => {
          if (evt && typeof evt === 'object' && evt.type === 'tool_execution_start') {
            this.handleRuntimeMessage({
              schemaVersion: 2,
              runId: 'replay',
              sessionId: this.sessionId,
              turnId: turn.id || 'replay',
              timestamp: Number((evt as any).timestamp || Date.now()),
              type: 'tool_execution_start',
              tool: (evt as any).tool,
              id: (evt as any).id,
              args: (evt as any).args || {},
              stepIndex: (evt as any).stepIndex,
              stepTitle: (evt as any).stepTitle,
            });
          }
          if (evt && typeof evt === 'object' && evt.type === 'tool_execution_result') {
            this.handleRuntimeMessage({
              schemaVersion: 2,
              runId: 'replay',
              sessionId: this.sessionId,
              turnId: turn.id || 'replay',
              timestamp: Number((evt as any).timestamp || Date.now()),
              type: 'tool_execution_result',
              tool: (evt as any).tool,
              id: (evt as any).id,
              args: (evt as any).args || {},
              result: (evt as any).result,
              stepIndex: (evt as any).stepIndex,
              stepTitle: (evt as any).stepTitle,
            });
          }
        });

        if (turn.assistantFinal?.content) {
          this.displayAssistantMessage(
            String(turn.assistantFinal.content || ''),
            (turn.assistantFinal.thinking as any) || null,
            (turn.assistantFinal.usage as any) || null,
            (turn.assistantFinal.model as any) || null,
          );
        }
      });

      this.updateContextUsage();
      this.updateChatEmptyState();
      this.scrollToBottom({ force: true });
    } finally {
      this.isReplayingHistory = false;
    }
    return;
  }

  if (transcript.length > 0) {
    const normalized = normalizeConversationHistory(transcript || []);
    this.displayHistory = normalized;
    this.contextHistory = normalized;
    const suffix = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now());
    this.sessionId = session.id || `session-${suffix}`;
    this.firstUserMessage = session.title || '';
    this.renderConversationHistory();
    this.updateContextUsage();
  }
};

(SidePanelUI.prototype as any).deleteSession = async function deleteSession(sessionId: string) {
  try {
    const { chatSessions } = await chrome.storage.local.get(['chatSessions']);
    const sessions = normalizeStoredSessions(chatSessions);
    const filtered = sessions.filter((s: any) => s?.id !== sessionId);
    await chrome.storage.local.set({ chatSessions: filtered });
    this.loadHistoryList();
  } catch (e) {
    console.error('Failed to delete session:', e);
  }
};

(SidePanelUI.prototype as any).clearAllHistory = async function clearAllHistory() {
  // Use a two-click pattern instead of confirm() which freezes the sidepanel.
  // First click sets a flag; second click within 3s actually clears.
  const now = Date.now();
  if (this._clearHistoryPendingAt && now - this._clearHistoryPendingAt < 3000) {
    this._clearHistoryPendingAt = 0;
    try {
      await chrome.storage.local.set({ chatSessions: [] });
      this.loadHistoryList();
      this.updateStatus('History cleared', 'success');
    } catch (e) {
      console.error('Failed to clear history:', e);
    }
    return;
  }
  this._clearHistoryPendingAt = now;
  this.updateStatus('Click Clear again to confirm', 'warning');
};

(SidePanelUI.prototype as any).formatTimeAgo = function formatTimeAgo(date: Date): string {
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

(SidePanelUI.prototype as any).renderConversationHistory = function renderConversationHistory() {
  this.elements.chatMessages.innerHTML = '';
  this.toolCallViews.clear();
  this.lastChatTurn = null;
  this.resetActivityPanel();

  this.displayHistory.forEach((msg: any) => {
    if (msg.role === 'system' || msg.meta?.kind === 'summary') {
      this.displaySummaryMessage(msg);
      return;
    }
    if (msg.role === 'user') {
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message user';
      messageDiv.innerHTML = `
          <div class="message-header">You</div>
          <div class="message-content">${this.escapeHtml(msg.content || '')}</div>
        `;
      this.elements.chatMessages.appendChild(messageDiv);
    } else if (msg.role === 'assistant') {
      const rawContent = typeof msg.content === 'string' ? msg.content : this.safeJsonStringify(msg.content);
      const parsed = extractThinking(rawContent, msg.thinking || null);
      const messageDiv = document.createElement('div');
      messageDiv.className = 'message assistant';
      let html = `<div class="message-header">Assistant</div>`;
      const showThinking = this.elements.showThinking.value === 'true';
      if (parsed.thinking && showThinking) {
        const cleanedThinking = dedupeThinking(parsed.thinking);
        html += `
            <div class="thinking-block collapsed">
              <button class="thinking-header" type="button" aria-expanded="false">
                <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                Thinking
              </button>
              <div class="thinking-content">${this.escapeHtml(cleanedThinking)}</div>
            </div>
          `;
      }
      if (parsed.content && parsed.content.trim() !== '') {
        html += `<div class="message-content markdown-body">${this.renderMarkdown(parsed.content)}</div>`;
      }
      messageDiv.innerHTML = html;

      const thinkingHeader = messageDiv.querySelector('.thinking-header');
      if (thinkingHeader) {
        thinkingHeader.addEventListener('click', () => {
          const block = thinkingHeader.closest('.thinking-block');
          if (!block || block.classList.contains('thinking-hidden')) return;
          block.classList.toggle('collapsed');
          const expanded = !block.classList.contains('collapsed');
          thinkingHeader.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        });
      }

      this.elements.chatMessages.appendChild(messageDiv);
    }
  });
  this.restoreScrollPosition();
  this.updateChatEmptyState();
};
