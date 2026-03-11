import { dedupeThinking } from '../../../ai/message-utils.js';
import type { SidePanelUI } from '../core/panel-ui.js';

export function renderNewAssistantMessage(
  self: SidePanelUI,
  options: {
    content: string;
    thinking: string | null;
    messageMeta: string;
    showThinking: boolean;
    buildReportImagesHtml: () => string;
  },
): void {
  const { content, thinking, messageMeta, showThinking, buildReportImagesHtml } = options;

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant';
  self.tagAgentView?.(messageDiv, 'main');

  const html = buildMessageHtml(self, { content, thinking, messageMeta, showThinking, buildReportImagesHtml });
  messageDiv.innerHTML = html;

  attachThinkingToggle(messageDiv);
  appendToChat(self, messageDiv);
  finalizeMessage(self);
}

function buildMessageHtml(
  self: SidePanelUI,
  options: {
    content: string;
    thinking: string | null;
    messageMeta: string;
    showThinking: boolean;
    buildReportImagesHtml: () => string;
  },
): string {
  const { content, thinking, messageMeta, showThinking, buildReportImagesHtml } = options;

  let html = `<div class="message-header">Assistant</div>`;

  if (messageMeta) {
    html += `<div class="message-meta">${self.escapeHtml(messageMeta)}</div>`;
  }

  if (thinking && showThinking) {
    html += buildThinkingBlock(self, thinking);
  }

  if (content && content.trim() !== '') {
    const renderedContent = self.renderMarkdown(content);
    html += `<div class="message-content markdown-body">${renderedContent}</div>`;
  }

  const reportImagesHtml = buildReportImagesHtml();
  if (reportImagesHtml) {
    html += reportImagesHtml;
  }

  return html;
}

function buildThinkingBlock(self: SidePanelUI, thinking: string): string {
  const cleanedThinking = dedupeThinking(thinking);
  return `
    <div class="thinking-block collapsed">
      <button class="thinking-header" type="button" aria-expanded="false">
        <svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        Thought process
      </button>
      <div class="thinking-content">${self.escapeHtml(cleanedThinking)}</div>
    </div>
  `;
}

function attachThinkingToggle(messageDiv: HTMLElement): void {
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
}

function appendToChat(self: SidePanelUI, messageDiv: HTMLElement): void {
  if (self.lastChatTurn) {
    self.lastChatTurn.appendChild(messageDiv);
  } else {
    self.elements.chatMessages.appendChild(messageDiv);
  }
  self.scrollToBottom();
}

function finalizeMessage(self: SidePanelUI): void {
  self.updateStatus('Ready', 'success');
  self.elements.composer?.classList.remove('running');
  self.stopWatchdog?.();
  self.stopRunTimer?.();
  self.pendingToolCount = 0;
  self.updateActivityState();
  self.nullifyFinalizedToolData();
  self.pruneOldChatTurns();
  self.persistHistory();
  self.updateChatEmptyState();
  self.flushQueuedMessage?.();
}
