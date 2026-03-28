import { type RecordingEvent, truncate } from '@parchi/shared';
import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

const formatOffset = (ms: number): string => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `+${min}:${String(sec).padStart(2, '0')}`;
};

const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const hostnameFromUrl = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

const pathFromUrl = (url: string): string => {
  try {
    const u = new URL(url);
    return u.hostname + u.pathname;
  } catch {
    return url;
  }
};

// ──────────────────────────────────────────────────────────────────────
// Icon SVGs per event type
// ──────────────────────────────────────────────────────────────────────

sidePanelProto.getActionIcon = function getActionIcon(type: string): string {
  switch (type) {
    case 'click':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';
    case 'input':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6" y2="14"/></svg>';
    case 'scroll':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>';
    case 'navigation':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
    case 'dom_mutation':
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>';
    default:
      return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>';
  }
};

// ──────────────────────────────────────────────────────────────────────
// Label extraction
// ──────────────────────────────────────────────────────────────────────

sidePanelProto.getActionLabel = function getActionLabel(event: RecordingEvent): {
  primary: string;
  detail: string;
} {
  switch (event.type) {
    case 'click': {
      const primary = event.textContent?.trim() ? truncate(event.textContent.trim(), 40) : event.selector || 'click';
      const pos = event.position ? `at (${event.position.x}, ${event.position.y})` : '';
      const detail = [event.tagName || '', pos].filter(Boolean).join(' ');
      return { primary, detail };
    }
    case 'input': {
      const primary = event.placeholder ? truncate(event.placeholder, 40) : event.selector || 'input';
      return { primary, detail: event.inputType || 'text' };
    }
    case 'scroll': {
      const primary = `Scroll ${event.direction || 'down'}`;
      return { primary, detail: event.scrollY != null ? `${event.scrollY}px` : '' };
    }
    case 'navigation': {
      const primary = event.toUrl ? truncate(pathFromUrl(event.toUrl), 40) : 'navigate';
      return { primary, detail: event.trigger || '' };
    }
    case 'dom_mutation': {
      const primary = event.summary || 'DOM mutation';
      const parts: string[] = [];
      if (event.addedCount) parts.push(`+${event.addedCount}`);
      if (event.removedCount) parts.push(`-${event.removedCount}`);
      return { primary: truncate(primary, 40), detail: parts.join(' / ') || '' };
    }
    default:
      return { primary: event.type, detail: '' };
  }
};

// ──────────────────────────────────────────────────────────────────────
// Single action node
// ──────────────────────────────────────────────────────────────────────

sidePanelProto.createActionNode = function createActionNode(
  event: RecordingEvent,
  offsetMs: number,
  index: number,
): HTMLElement {
  const node = document.createElement('div');
  node.className = 'action-timeline-node';
  if (event.type === 'dom_mutation') node.classList.add('excluded');
  node.dataset.index = String(index);

  const { primary, detail } = this.getActionLabel(event);
  const icon = this.getActionIcon(event.type);

  node.innerHTML = `
    <div class="action-node-icon">${icon}</div>
    <div class="action-node-body">
      <span class="action-node-primary">${escapeHtml(primary)}</span>
      ${detail ? `<span class="action-node-detail">${escapeHtml(detail)}</span>` : ''}
    </div>
    <span class="action-node-time">${formatOffset(offsetMs)}</span>
    <label class="action-node-toggle" title="Include in skill">
      <input type="checkbox" ${event.type === 'dom_mutation' ? '' : 'checked'} />
    </label>
  `;

  // Wire checkbox
  const checkbox = node.querySelector('input[type="checkbox"]') as HTMLInputElement;
  checkbox?.addEventListener('change', () => {
    if (!this.reviewState) return;
    if (checkbox.checked) {
      this.reviewState.excludedEventIndices.delete(index);
      node.classList.remove('excluded');
    } else {
      this.reviewState.excludedEventIndices.add(index);
      node.classList.add('excluded');
    }
  });

  return node;
};

// ──────────────────────────────────────────────────────────────────────
// Full timeline
// ──────────────────────────────────────────────────────────────────────

sidePanelProto.renderActionTimeline = function renderActionTimeline(
  events: RecordingEvent[],
  startTimestamp: number,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'action-timeline-list';

  let lastUrl = '';

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const eventUrl = event.url || event.toUrl || '';

    // Insert URL separator when URL changes
    if (event.type === 'navigation' && event.toUrl) {
      const sep = document.createElement('div');
      sep.className = 'action-timeline-separator';
      sep.textContent = truncate(pathFromUrl(event.toUrl), 50);
      container.appendChild(sep);
      lastUrl = event.toUrl;
    } else if (eventUrl && eventUrl !== lastUrl && hostnameFromUrl(eventUrl) !== hostnameFromUrl(lastUrl)) {
      const sep = document.createElement('div');
      sep.className = 'action-timeline-separator';
      sep.textContent = truncate(pathFromUrl(eventUrl), 50);
      container.appendChild(sep);
      lastUrl = eventUrl;
    }

    const offsetMs = event.timestamp - startTimestamp;
    const node = this.createActionNode(event, offsetMs, i);
    container.appendChild(node);
  }

  return container;
};
