import { dedupeThinking, extractThinking } from '../../../ai/message-utils.js';
import { clearReportImages, clearToolCallViews } from '../core/panel-session-memory.js';
import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.renderConversationHistory = function renderConversationHistory() {
  this.elements.chatMessages.innerHTML = '';
  clearToolCallViews(this.toolCallViews);
  clearReportImages(this.reportImages, this.reportImageOrder, this.selectedReportImageIds);
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
