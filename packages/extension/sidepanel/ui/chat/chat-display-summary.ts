import type { Message } from '../../../ai/message-schema.js';
import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.displaySummaryMessage = function displaySummaryMessage(messageOrEntry: Message | string) {
  const content = typeof messageOrEntry === 'string' ? messageOrEntry : String(messageOrEntry.content || '');
  const meta = typeof messageOrEntry === 'object' && messageOrEntry !== null ? messageOrEntry.meta : null;
  const trimmedCount = typeof meta?.summaryOfCount === 'number' ? meta.summaryOfCount : 0;

  const container = document.createElement('div');
  container.className = 'message compaction-message';
  this.tagAgentView?.(container, 'main');

  const countLabel = trimmedCount > 0 ? `${trimmedCount} messages summarized` : '';

  container.innerHTML = `
    <div class="compaction-card">
      <div class="compaction-header">
        <div class="compaction-badge">
          <svg class="compaction-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
            <path d="M9 12h6"/>
          </svg>
          <span>Context compacted</span>
        </div>
        ${countLabel ? `<span class="compaction-count">${this.escapeHtml(countLabel)}</span>` : ''}
        <button class="compaction-toggle" type="button" aria-expanded="false" title="Show summary">
          <svg class="toggle-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 15 12 9 18 15"></polyline>
          </svg>
        </button>
      </div>
      <div class="compaction-body collapsed">
        <div class="compaction-detail">${this.renderMarkdown(content)}</div>
      </div>
    </div>
  `;

  const toggleBtn = container.querySelector('.compaction-toggle');
  const body = container.querySelector('.compaction-body');
  if (toggleBtn && body) {
    toggleBtn.addEventListener('click', () => {
      const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      toggleBtn.setAttribute('aria-expanded', String(!isExpanded));
      body.classList.toggle('collapsed', isExpanded);
    });
  }

  this.elements.chatMessages.appendChild(container);
  this.scrollToBottom();
  this.updateChatEmptyState();
};
