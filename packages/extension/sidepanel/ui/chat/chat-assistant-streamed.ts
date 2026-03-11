import { dedupeThinking } from '../../../ai/message-utils.js';
import type { SidePanelUI } from '../core/panel-ui.js';

export function renderStreamedContainer(
  self: SidePanelUI,
  streamedContainer: Element,
  streamEventsEl: HTMLElement | null,
  options: {
    content: string;
    thinking: string | null;
    messageMeta: string;
    showThinking: boolean;
    buildReportImagesHtml: () => string;
  },
): void {
  const { content, thinking, messageMeta, showThinking, buildReportImagesHtml } = options;

  addMessageHeader(streamedContainer);
  addMessageMeta(streamedContainer, messageMeta);

  if (thinking && showThinking && streamEventsEl) {
    renderStreamedThinking(self, streamedContainer, streamEventsEl, thinking);
  }

  if (streamEventsEl) {
    finalizeStreamEvents(self, streamEventsEl, content, buildReportImagesHtml);
  }

  self.scrollToBottom();
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

function addMessageHeader(streamedContainer: Element): void {
  if (!streamedContainer.querySelector('.message-header')) {
    const header = document.createElement('div');
    header.className = 'message-header';
    header.textContent = 'Assistant';
    streamedContainer.prepend(header);
  }
}

function addMessageMeta(streamedContainer: Element, messageMeta: string): void {
  if (!messageMeta) return;

  let metaEl = streamedContainer.querySelector('.message-meta') as HTMLElement | null;
  if (!metaEl) {
    metaEl = document.createElement('div');
    metaEl.className = 'message-meta';
    const header = streamedContainer.querySelector('.message-header');
    if (header) {
      header.insertAdjacentElement('afterend', metaEl);
    } else {
      streamedContainer.prepend(metaEl);
    }
  }
  metaEl.textContent = messageMeta;
}

function renderStreamedThinking(
  self: SidePanelUI,
  streamedContainer: Element,
  streamEventsEl: HTMLElement,
  thinking: string,
): void {
  const existingThinking = streamedContainer.querySelector(
    '.thinking-block, .inline-thinking-block, .stream-event-reasoning',
  );
  const cleanedThinking = dedupeThinking(thinking);
  if (!existingThinking && cleanedThinking) {
    const thinkingBlock = document.createElement('div');
    thinkingBlock.className = 'thinking-block collapsed';
    thinkingBlock.innerHTML = `
      <button class="thinking-header" type="button" aria-expanded="false">
        <svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
        Thought process
      </button>
      <div class="thinking-content">${self.escapeHtml(cleanedThinking)}</div>
    `;

    const targetBody = streamedContainer.querySelector('.step-body') as HTMLElement | null;
    const target = targetBody || streamEventsEl;
    const firstChild = target.firstChild;
    if (firstChild) {
      target.insertBefore(thinkingBlock, firstChild);
    } else {
      target.appendChild(thinkingBlock);
    }

    const thinkingHeader = thinkingBlock.querySelector('.thinking-header');
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
}

function finalizeStreamEvents(
  self: SidePanelUI,
  streamEventsEl: HTMLElement,
  content: string,
  buildReportImagesHtml: () => string,
): void {
  // Clean up ALL streamed text blocks (they may contain raw <think> tags)
  const textEvents = streamEventsEl.querySelectorAll('.stream-event-text');
  Array.from(textEvents).forEach((el) => (el as Element).remove());

  // Add a single clean text block with the final content
  if (content && content.trim() !== '') {
    const textEvent = document.createElement('div');
    textEvent.className = 'stream-event stream-event-text';
    textEvent.innerHTML = self.renderMarkdown(content);
    streamEventsEl.appendChild(textEvent);
  }

  // Add report images
  const reportImagesHtml = buildReportImagesHtml();
  if (reportImagesHtml) {
    const existing = streamEventsEl.querySelector('.report-images-inline');
    existing?.remove();
    const reportBlock = document.createElement('div');
    reportBlock.className = 'stream-event stream-event-report-images';
    reportBlock.innerHTML = reportImagesHtml;
    streamEventsEl.appendChild(reportBlock);
  }

  // Collapse tool rows by default with a summary toggle
  const toolRows = streamEventsEl.querySelectorAll('.tool-row');
  if (toolRows.length > 0) {
    addToolGroupToggle(streamEventsEl, toolRows);
  }
}

function addToolGroupToggle(streamEventsEl: HTMLElement, toolRows: NodeListOf<Element>): void {
  const errorCount = streamEventsEl.querySelectorAll('.tool-row.error').length;
  const label = `${toolRows.length} tool call${toolRows.length !== 1 ? 's' : ''}${errorCount > 0 ? ` · ${errorCount} error${errorCount !== 1 ? 's' : ''}` : ''}`;

  const toggle = document.createElement('button');
  toggle.className = 'tool-group-toggle';
  toggle.type = 'button';
  toggle.innerHTML = `
    <svg class="tool-group-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
    <span>${label}</span>
  `;
  toggle.addEventListener('click', () => {
    streamEventsEl.classList.toggle('tools-collapsed');
  });

  // Insert before the first tool row
  toolRows[0].insertAdjacentElement('beforebegin', toggle);
  streamEventsEl.classList.add('tools-collapsed');
}
