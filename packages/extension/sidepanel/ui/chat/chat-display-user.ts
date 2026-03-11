import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.displayUserMessage = function displayUserMessage(
  content: string,
  recordedContext: unknown = null,
  mediaAttachments: unknown[] = [],
) {
  const turn = document.createElement('div');
  turn.className = 'chat-turn';
  this.tagAgentView?.(turn, 'main');
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message user';

  const recordingHtml = buildRecordingHtml(this, recordedContext);
  const mediaHtml = buildMediaHtml(this, mediaAttachments);

  messageDiv.innerHTML = `
      <div class="message-header">You</div>
      <div class="message-content">${this.escapeHtml(content)}</div>
      ${recordingHtml}
      ${mediaHtml}
    `;
  turn.appendChild(messageDiv);
  this.elements.chatMessages.appendChild(turn);
  this.lastChatTurn = turn;
  this.scrollToBottom({ force: true });
  this.updateChatEmptyState();
};

function buildRecordingHtml(self: SidePanelUI, recordedContext: unknown): string {
  if (!recordedContext) return '';
  const rc = recordedContext as any;
  const events = Array.isArray(rc.events)
    ? (rc.events as unknown[]).filter((event: unknown) => {
        const evt = event as { type?: unknown };
        return String(evt.type || '') !== 'dom_mutation';
      })
    : [];
  const selectedImages = Array.isArray(rc.selectedImages) ? rc.selectedImages : [];
  const durationMs = Math.max(0, Number(rc.duration || 0));
  const durationSec = Math.round(durationMs / 1000);
  const summary = String(rc.summary || '').trim();
  const firstEvent = events[0] as any;
  const firstImage = selectedImages[0] as any;
  const origin = String(firstEvent?.url || firstImage?.url || '').trim();
  const baseTs = Number(firstEvent?.timestamp || 0);

  const stepRows = events
    .map((event: unknown, index: number) => {
      const ev = event as any;
      const ts = Number(ev?.timestamp || 0);
      const deltaSec = baseTs > 0 && ts >= baseTs ? Math.round((ts - baseTs) / 1000) : null;
      const type = String(ev?.type || 'event');
      const line = formatEventLine(type, ev);
      const suffix = deltaSec === null ? '' : ` (+${deltaSec}s)`;
      return `<li>${self.escapeHtml(`${index + 1}. ${line}${suffix}`)}</li>`;
    })
    .join('');

  const sourceHtml = origin ? `<div class="user-recording-origin">${self.escapeHtml(origin)}</div>` : '';

  return `
      <details class="user-recording-block">
        <summary>Recording attached · ${events.length} steps · ${selectedImages.length} images · ${durationSec}s</summary>
        <div class="user-recording-content">
          ${summary ? `<div class="user-recording-summary">${self.escapeHtml(summary)}</div>` : ''}
          ${sourceHtml}
          <ol class="user-recording-steps">${stepRows || '<li>No interaction steps captured.</li>'}</ol>
        </div>
      </details>
    `;
}

function formatEventLine(type: string, ev: any): string {
  if (type === 'click') {
    return `Click ${ev?.selector || ev?.tagName || 'element'}`;
  }
  if (type === 'input') {
    return `Input ${ev?.selector || ev?.placeholder || ''}`.trim();
  }
  if (type === 'navigation') {
    return `Navigate to ${ev?.toUrl || ev?.url || ''}`.trim();
  }
  if (type === 'scroll') {
    return `Scroll ${ev?.direction || ''}`.trim();
  }
  return `${type}`;
}

function buildMediaHtml(self: SidePanelUI, mediaAttachments: unknown[]): string {
  const attachments = Array.isArray(mediaAttachments) ? mediaAttachments : [];
  if (!attachments.length) return '';

  const rows = attachments
    .map((attachment: unknown) => {
      const a = attachment as any;
      const kind = String(a?.kind || 'file');
      const name = String(a?.name || `${kind}-attachment`);
      const mimeType = String(a?.mimeType || '');
      const size = Number(a?.size || 0);
      const kb = Math.max(1, Math.round(size / 1024));
      return `<li>${self.escapeHtml(`${kind.toUpperCase()}: ${name} (${mimeType || 'unknown'}, ${kb} KB)`)}</li>`;
    })
    .join('');

  return `
      <details class="user-attachments-block">
        <summary>Media attached · ${attachments.length}</summary>
        <ul class="user-attachments-list">${rows}</ul>
      </details>
    `;
}
