import { sidePanelProto } from './panel-tools-shared.js';

sidePanelProto.showErrorBanner = function showErrorBanner(
  message: string,
  opts?: { category?: string; action?: string; recoverable?: boolean },
) {
  document.querySelectorAll('.error-banner').forEach((el) => el.remove());

  const actionHtml = opts?.action ? `<span class="error-action">${this.escapeHtml(opts.action)}</span>` : '';
  const settingsBtnHtml =
    opts?.category === 'auth' ? `<button class="error-settings-btn" title="Open Settings">Settings</button>` : '';

  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.innerHTML = `
    <svg class="error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
    <div class="error-body">
      <span class="error-text">${this.escapeHtml(message)}</span>
      ${actionHtml}
    </div>
    ${settingsBtnHtml}
    <button class="error-dismiss" title="Dismiss">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  if (opts?.recoverable === false) banner.classList.add('error-persistent');
  banner.querySelector('.error-dismiss')?.addEventListener('click', () => banner.remove());
  banner.querySelector('.error-settings-btn')?.addEventListener('click', () => {
    banner.remove();
    this.openSettingsPanel?.();
  });

  // Append inline into the chat stream near the current streaming context
  const streamEventsEl = this.streamingState?.eventsEl;
  if (streamEventsEl) {
    streamEventsEl.appendChild(banner);
  } else if (this.elements.chatMessages) {
    this.elements.chatMessages.appendChild(banner);
  } else {
    document.body.appendChild(banner);
  }
  this.scrollToBottom();

  const dismissMs = opts?.recoverable === false ? 30000 : 12000;
  setTimeout(() => banner.remove(), dismissMs);
};

sidePanelProto.clearRunIncompleteBanner = function clearRunIncompleteBanner() {
  document.querySelectorAll('.run-incomplete-banner').forEach((el) => el.remove());
};

sidePanelProto.clearErrorBanner = function clearErrorBanner() {
  document.querySelectorAll('.error-banner').forEach((el) => el.remove());
};

sidePanelProto.updateToolMessage = function updateToolMessage(entry: any, result: any) {
  if (!entry) return;
  if (entry.element) this.updateToolResult(entry, result);
};

sidePanelProto.updateToolLogEntry = function updateToolLogEntry(_entry: any, _result: any) {
  // Legacy method - tool log panel removed
};
