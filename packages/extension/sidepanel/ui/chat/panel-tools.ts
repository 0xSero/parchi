import { dedupeThinking } from '../../../ai/message-utils.js';
import { SidePanelUI } from '../core/panel-ui.js';

// ============================================================================
// Tool Icons - Clean SVG icons instead of emoji
// ============================================================================

const toolIcons: Record<string, string> = {
  // Browser tools
  browser_navigate:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 12l6-6m-6 6l6 6"/></svg>',
  browser_click:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8m-4-4h8"/></svg>',
  browser_type:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 12h8M8 16h4"/></svg>',
  browser_screenshot:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
  browser_get_page_text:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  browser_scroll:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
  browser_go_back:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a4 4 0 0 1 4 4v1"/></svg>',
  browser_go_forward:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a4 4 0 0 0-4 4v1"/></svg>',
  browser_refresh:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  browser_find_element:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
  browser_press_key:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8M12 8v8"/></svg>',
  browser_select_option:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  browser_get_element_text:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>',
  browser_get_element_attribute:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  browser_execute_script:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  browser_wait:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  browser_set_viewport:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>',
  browser_clear_cookies:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5l7 7"/><path d="M15.5 8.5l-7 7"/></svg>',
  browser_get_cookies:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/></svg>',
  browser_set_cookie:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>',
  browser_delete_cookie:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8 12h8"/></svg>',

  // Default
  default:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 6.34L2.1 2.1m20.9 9.9h-6m-6 0H2.1m16.12 4.24l4.24 4.24M6.34 17.66l-4.24 4.24"/></svg>',
};

// ============================================================================
// Tool Display - Elegant inline visualization
// ============================================================================

(SidePanelUI.prototype as any).displayToolExecution = function displayToolExecution(
  toolName: string,
  args: any,
  result: any,
  toolCallId: string | null = null,
) {
  const entryId = toolCallId || `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let entry = this.toolCallViews.get(entryId);
  const displayName = toolName;

  if (!entry) {
    // Cap toolCallViews — evict oldest entries
    if (this.toolCallViews.size >= MAX_TOOL_CALL_VIEWS) {
      const iter = this.toolCallViews.entries();
      const excess = this.toolCallViews.size - MAX_TOOL_CALL_VIEWS + 1;
      for (let i = 0; i < excess; i++) {
        const next = iter.next().value;
        if (next) {
          const [key, old] = next;
          old.element?.remove();
          this.toolCallViews.delete(key);
        }
      }
    }

    entry = {
      id: entryId,
      toolName: displayName,
      fullToolName: toolName,
      args,
      startTime: Date.now(),
      element: null,
      statusEl: null,
      durationEl: null,
    };
    this.toolCallViews.set(entryId, entry);

    if (this.streamingState?.eventsEl) {
      const toolEl = this.createToolElement(entry);
      entry.element = toolEl;
      this.streamingState.eventsEl.appendChild(toolEl);
      this.streamingState.lastEventType = 'tool';
    }
    this.scrollToBottom();
  }

  if (result !== null && result !== undefined) {
    this.updateToolResult(entry, result);
    const isError = result && (result.error || result.success === false);
    if (isError) {
      const detail = result?.details
        ? ` (${this.truncateText?.(String(result.details), 140) || String(result.details)})`
        : '';
      this.showErrorBanner(`${displayName}: ${result.error || 'Tool execution failed'}${detail}`);
    }
  }
  this.updateActivityToggle();
};

(SidePanelUI.prototype as any).createToolElement = function createToolElement(entry: any) {
  const container = document.createElement('div');
  container.className = 'tool-row running';
  container.dataset.toolId = entry.id;

  const icon = this.getToolIcon(entry.fullToolName);
  const argsTokens = this.getArgsTokens(entry.args);
  const argsLabel = argsTokens.join(' · ');
  if (argsLabel) {
    container.title = argsLabel;
  }

  container.innerHTML = `
    <span class="tool-icon">${icon}</span>
    <span class="tool-name">${this.escapeHtml(entry.toolName)}</span>
    ${argsLabel ? `<span class="tool-args">${this.escapeHtml(argsLabel)}</span>` : ''}
    <span class="tool-status">RUN</span>
    <span class="tool-duration">...</span>
  `;

  entry.statusEl = container.querySelector('.tool-status');
  entry.durationEl = container.querySelector('.tool-duration');

  // Animate duration
  this.animateToolDuration(entry);

  // Click to expand/collapse tool result details
  container.addEventListener('click', () => {
    const existing = container.querySelector('.tool-detail');
    if (existing) {
      existing.remove();
      return;
    }
    if (!entry.result) return;
    const detail = document.createElement('div');
    detail.className = 'tool-detail';
    const resultText = typeof entry.result === 'object'
      ? JSON.stringify(entry.result, null, 2)
      : String(entry.result);
    const truncated = resultText.length > 2000 ? resultText.slice(0, 2000) + '\n...(truncated)' : resultText;
    detail.textContent = truncated;
    container.appendChild(detail);
  });
  container.style.cursor = 'pointer';

  return container;
};

(SidePanelUI.prototype as any).animateToolDuration = function animateToolDuration(entry: any) {
  if (!entry.durationEl || entry.endTime) return;

  const update = () => {
    if (!entry.durationEl || entry.endTime) return;
    const elapsed = Date.now() - entry.startTime;
    entry.durationEl.textContent = elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`;
    requestAnimationFrame(() => setTimeout(update, 100));
  };
  update();
};

(SidePanelUI.prototype as any).updateToolResult = function updateToolResult(entry: any, result: any) {
  if (!entry || !entry.element) return;

  entry.endTime = Date.now();
  const isError = result && (result.error || result.success === false);
  const duration = entry.endTime - entry.startTime;
  const isNoopScroll = entry.fullToolName === 'scroll' && result && result.success === true && result.moved === false;

  // Update visual state - subtle, no red/green
  entry.element.classList.remove('running');
  entry.element.classList.add(isError ? 'error' : 'done');
  entry.element.classList.toggle('noop', isNoopScroll);

  // Update duration display
  if (entry.durationEl) {
    entry.durationEl.textContent = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`;
  }

  if (entry.statusEl) {
    entry.statusEl.textContent = isError ? 'ERR' : 'OK';
  }

  if (isError) {
    const detailParts = [result?.error, result?.details, result?.hint].filter((part) => typeof part === 'string' && part);
    if (detailParts.length > 0) {
      entry.element.title = detailParts.join(' ');
    }
  }

  // When scroll can't move (common in nested scroll containers), surface it without marking as an error.
  if (isNoopScroll) {
    entry.element.title = 'Scroll did not move. The page may use an inner scroll container; pass scroll.selector.';
    let noteEl = entry.element.querySelector('.tool-note') as HTMLElement | null;
    if (!noteEl) {
      noteEl = document.createElement('span');
      noteEl.className = 'tool-note';
      noteEl.textContent = 'no-op';
      // Prefer placing after args, before status.
      const argsEl = entry.element.querySelector('.tool-args');
      if (argsEl && argsEl.parentElement) {
        argsEl.insertAdjacentElement('afterend', noteEl);
      } else {
        const statusEl = entry.element.querySelector('.tool-status');
        if (statusEl && statusEl.parentElement) {
          statusEl.insertAdjacentElement('beforebegin', noteEl);
        } else {
          entry.element.appendChild(noteEl);
        }
      }
    }
  }

  // Store result for potential expansion
  entry.result = result;
  this.attachScreenshotPreview(entry, result);
};

const MAX_REPORT_IMAGES = 50;
const MAX_TOOL_CALL_VIEWS = 200;

(SidePanelUI.prototype as any).recordReportImage = function recordReportImage(image: any) {
  if (!image || typeof image.id !== 'string' || typeof image.dataUrl !== 'string') return;
  const normalized = {
    id: image.id,
    dataUrl: image.dataUrl,
    capturedAt: Number(image.capturedAt || Date.now()),
    toolCallId: typeof image.toolCallId === 'string' ? image.toolCallId : undefined,
    tabId: typeof image.tabId === 'number' ? image.tabId : undefined,
    url: typeof image.url === 'string' ? image.url : undefined,
    title: typeof image.title === 'string' ? image.title : undefined,
    visionDescription: typeof image.visionDescription === 'string' ? image.visionDescription : undefined,
    selected: image.selected === true,
  };
  if (!this.reportImages.has(normalized.id)) {
    this.reportImageOrder.push(normalized.id);
  }
  this.reportImages.set(normalized.id, normalized);
  if (normalized.selected) {
    this.selectedReportImageIds.add(normalized.id);
  } else {
    this.selectedReportImageIds.delete(normalized.id);
  }

  // Cap reportImages — evict oldest non-selected images
  if (this.reportImages.size > MAX_REPORT_IMAGES) {
    const toEvict: string[] = [];
    for (const id of this.reportImageOrder) {
      if (this.reportImages.size - toEvict.length <= MAX_REPORT_IMAGES) break;
      if (!this.selectedReportImageIds.has(id)) {
        toEvict.push(id);
      }
    }
    for (const id of toEvict) {
      this.reportImages.delete(id);
      // Remove DOM preview if it exists
      const previewEl = document.querySelector(`.report-image-toggle[data-report-image-id="${id}"]`);
      previewEl?.closest('.tool-screenshot-preview')?.remove();
    }
    this.reportImageOrder = this.reportImageOrder.filter((id: string) => this.reportImages.has(id));
  }

  if (normalized.toolCallId) {
    const entry = this.toolCallViews.get(normalized.toolCallId);
    if (entry) {
      this.attachScreenshotPreview(entry, { reportImageId: normalized.id });
    }
  }
};

(SidePanelUI.prototype as any).updateReportImageSelection = function updateReportImageSelection(ids: any[]) {
  const nextSelected = new Set(
    (Array.isArray(ids) ? ids : [])
      .map((value: unknown) => String(value || '').trim())
      .filter((value: string) => value.length > 0),
  );
  this.selectedReportImageIds = nextSelected;
  this.reportImages.forEach((image: any, id: string) => {
    image.selected = nextSelected.has(id);
  });

  const checkboxes = document.querySelectorAll<HTMLInputElement>('.report-image-toggle[data-report-image-id]');
  checkboxes.forEach((checkbox) => {
    const imageId = checkbox.dataset.reportImageId || '';
    const isSelected = nextSelected.has(imageId);
    checkbox.checked = isSelected;
    checkbox.closest('.tool-screenshot-preview')?.classList.toggle('selected', isSelected);
  });
};

(SidePanelUI.prototype as any).attachScreenshotPreview = function attachScreenshotPreview(entry: any, result: any) {
  if (!entry?.element) return;

  let image: any = null;
  const imageId = typeof result?.reportImageId === 'string' ? result.reportImageId : '';
  if (imageId) {
    image = this.reportImages.get(imageId) || null;
  }

  if (!image && typeof result?.dataUrl === 'string' && result.dataUrl.startsWith('data:image/')) {
    const fallbackId = imageId || `img-inline-${entry.id}`;
    const fallbackImage = {
      id: fallbackId,
      dataUrl: result.dataUrl,
      capturedAt: Date.now(),
      toolCallId: entry.id,
      tabId: typeof result?.tabId === 'number' ? result.tabId : undefined,
      url: typeof result?.url === 'string' ? result.url : undefined,
      title: typeof result?.title === 'string' ? result.title : undefined,
      visionDescription: typeof result?.visionDescription === 'string' ? result.visionDescription : undefined,
      selected: this.selectedReportImageIds.has(fallbackId),
    };
    this.recordReportImage(fallbackImage);
    image = this.reportImages.get(fallbackId) || fallbackImage;
  }

  if (!image || typeof image.dataUrl !== 'string') return;

  let preview = entry.element.querySelector('.tool-screenshot-preview') as HTMLElement | null;
  if (!preview) {
    preview = document.createElement('div');
    preview.className = 'tool-screenshot-preview';
    entry.element.appendChild(preview);
  }
  entry.element.classList.add('has-preview');

  const imageLabel = this.truncateText(image.title || image.url || image.id, 46);
  const isSelected = this.selectedReportImageIds.has(image.id) || image.selected === true;
  preview.classList.toggle('selected', isSelected);
  preview.innerHTML = `
    <img class="tool-screenshot-image" src="${image.dataUrl}" alt="${this.escapeHtml(imageLabel)}" />
    <div class="tool-screenshot-meta">
      <span class="tool-screenshot-label">${this.escapeHtml(imageLabel)}</span>
      <label class="tool-screenshot-toggle">
        <input
          type="checkbox"
          class="report-image-toggle"
          data-report-image-id="${this.escapeHtml(image.id)}"
          ${isSelected ? 'checked' : ''}
        />
        Include in report
      </label>
    </div>
  `;

  preview.addEventListener('click', (event) => event.stopPropagation());
  const checkbox = preview.querySelector('.report-image-toggle') as HTMLInputElement | null;
  checkbox?.addEventListener('click', (event) => event.stopPropagation());
  checkbox?.addEventListener('change', (event) => {
    event.stopPropagation();
    const checked = checkbox.checked;
    if (checked) {
      this.selectedReportImageIds.add(image.id);
    } else {
      this.selectedReportImageIds.delete(image.id);
    }
    image.selected = checked;
    preview.classList.toggle('selected', checked);
  });
};

(SidePanelUI.prototype as any).nullifyFinalizedToolData = function nullifyFinalizedToolData() {
  for (const entry of this.toolCallViews.values()) {
    if (entry.endTime) {
      entry.args = null;
      entry.result = null;
    }
  }
};

(SidePanelUI.prototype as any).refreshTimelineHud = function refreshTimelineHud() {
  // No-op: run-hud removed
};

(SidePanelUI.prototype as any).getToolIcon = function getToolIcon(toolName: string): string {
  // Check for exact match first
  if (toolIcons[toolName]) {
    return toolIcons[toolName];
  }

  // Try partial matches for browser tools
  for (const [key, icon] of Object.entries(toolIcons)) {
    if (key === 'default') continue;
    const searchKey = key.replace(/^browser_/, '');
    if (toolName.toLowerCase().includes(searchKey.toLowerCase())) {
      return icon;
    }
  }

  return toolIcons.default;
};

(SidePanelUI.prototype as any).getArgsTokens = function getArgsTokens(args: any): string[] {
  if (!args || typeof args !== 'object') return [];
  const tokens: string[] = [];

  if (args.tabId) tokens.push(`tab ${args.tabId}`);
  if (args.url)
    tokens.push(
      String(args.url)
        .replace(/^https?:\/\//, '')
        .substring(0, 36),
    );
  if (args.path) tokens.push(String(args.path).substring(0, 36));
  if (args.selector) tokens.push(String(args.selector).substring(0, 40));
  if (args.text) {
    const value = String(args.text);
    tokens.push(`"${value.substring(0, 24)}${value.length > 24 ? '…' : ''}"`);
  }
  if (args.query) {
    const value = String(args.query);
    tokens.push(`"${value.substring(0, 24)}${value.length > 24 ? '…' : ''}"`);
  }
  if (args.key) tokens.push(`key ${args.key}`);
  if (args.direction) tokens.push(`scroll ${args.direction}`);
  if (args.type) tokens.push(String(args.type));

  const keys = Object.keys(args).filter((k) => !k.startsWith('_') && !tokens.join(' ').includes(k));
  if (tokens.length === 0 && keys.length === 1) {
    tokens.push(String(args[keys[0]]).substring(0, 30));
  } else if (tokens.length === 0 && keys.length > 1) {
    tokens.push(`${keys.length} params`);
  }

  return tokens;
};

// ============================================================================
// Error Handling
// ============================================================================

(SidePanelUI.prototype as any).showErrorBanner = function showErrorBanner(
  message: string,
  opts?: { category?: string; action?: string; recoverable?: boolean },
) {
  // Remove any existing error banners to prevent stacking
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

  if (opts?.recoverable === false) {
    banner.classList.add('error-persistent');
  }

  const dismissButton = banner.querySelector('.error-dismiss');
  dismissButton?.addEventListener('click', () => banner.remove());

  const settingsBtn = banner.querySelector('.error-settings-btn');
  settingsBtn?.addEventListener('click', () => {
    banner.remove();
    this.openSettingsPanel?.();
  });

  document.body.appendChild(banner);
  // Auto-dismiss: persistent for non-recoverable errors, shorter for recoverable
  const dismissMs = opts?.recoverable === false ? 30000 : 12000;
  setTimeout(() => banner.remove(), dismissMs);
};

(SidePanelUI.prototype as any).clearRunIncompleteBanner = function clearRunIncompleteBanner() {
  document.querySelectorAll('.run-incomplete-banner').forEach((el) => el.remove());
};

(SidePanelUI.prototype as any).clearErrorBanner = function clearErrorBanner() {
  document.querySelectorAll('.error-banner').forEach((el) => el.remove());
};

// ============================================================================
// Legacy update helpers (for backward compatibility)
// ============================================================================

(SidePanelUI.prototype as any).updateToolMessage = function updateToolMessage(entry: any, result: any) {
  if (!entry) return;
  if (entry.element) {
    this.updateToolResult(entry, result);
  }
};

(SidePanelUI.prototype as any).updateToolLogEntry = function updateToolLogEntry(_entry: any, _result: any) {
  // Legacy method - tool log panel removed
};

// ============================================================================
// Activity State
// ============================================================================

(SidePanelUI.prototype as any).updateActivityState = function updateActivityState() {
  // --- Toolbar: timer + context ---
  const toolbarLabels: string[] = [];

  if (this.runStartedAt) {
    const elapsed = Math.max(0, Date.now() - this.runStartedAt);
    const totalSeconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const label = `${minutes.toString().padStart(1, '0')}:${seconds.toString().padStart(2, '0')}`;
    toolbarLabels.push(`Run ${label}`);
  }

  if (this.contextUsage && this.contextUsage.maxContextTokens) {
    const used = Math.max(0, this.contextUsage.approxTokens || 0);
    const max = Math.max(1, this.contextUsage.maxContextTokens || 0);
    const usedLabel = used >= 10000 ? `${(used / 1000).toFixed(1)}k` : `${used}`;
    const maxLabel = max >= 10000 ? `${(max / 1000).toFixed(0)}k` : `${max}`;
    toolbarLabels.push(`${usedLabel} / ${maxLabel}`);
  }

  const usageLabel = this.buildUsageLabel?.(this.lastUsage);
  if (usageLabel) {
    toolbarLabels.push(usageLabel);
  }

  const paidStatusHoverLabel = String(this.paidStatusHoverLabel || '').trim();
  if (paidStatusHoverLabel) {
    toolbarLabels.push(paidStatusHoverLabel);
  }

  if (this.elements.statusMeta) {
    this.elements.statusMeta.textContent = toolbarLabels.join(' · ');
  }

  // --- Bubble: status only (actions, streaming) ---
  const bubbleLabels: string[] = [];

  if (this.pendingToolCount > 0) {
    bubbleLabels.push(`${this.pendingToolCount} action${this.pendingToolCount > 1 ? 's' : ''} running`);
  }
  if (this.isStreaming) {
    bubbleLabels.push('Streaming');
  }

  const bubbleMeta = document.getElementById('bubbleMeta');
  if (bubbleMeta) {
    bubbleMeta.textContent = bubbleLabels.join(' · ');
  }

  // Update mascot eye state
  this.updateMascotEyeState();
  this.updateActivityToggle();
};

(SidePanelUI.prototype as any).updateActivityToggle = function updateActivityToggle() {
  // Activity panel removed — no-op
};

(SidePanelUI.prototype as any).toggleActivityPanel = function toggleActivityPanel(_force?: boolean) {
  // Activity panel removed — no-op
};

/* ============================================================================
   Mascot Bubble — click to show/hide status bubble above mascot
   ============================================================================ */

(SidePanelUI.prototype as any).initMascotBubble = function initMascotBubble() {
  const mascot = document.getElementById('mascotCorner');
  if (!mascot) return;

  // Track typing for eye state
  this._lastTypingAt = 0;
  this._typingCheckTimerId = null;
  this._mascotBubbleOpen = false;

  mascot.addEventListener('click', () => {
    this.toggleMascotBubble();
  });

  // Typing detection on userInput
  const userInput = this.elements.userInput;
  if (userInput) {
    userInput.addEventListener('input', () => {
      this._lastTypingAt = Date.now();
      this.updateMascotEyeState();

      // Start polling to detect when typing stops
      if (!this._typingCheckTimerId) {
        this._typingCheckTimerId = window.setInterval(() => {
          const elapsed = Date.now() - this._lastTypingAt;
          if (elapsed >= 5000) {
            window.clearInterval(this._typingCheckTimerId);
            this._typingCheckTimerId = null;
            this.updateMascotEyeState();
          }
        }, 1000);
      }
    });
  }
};

(SidePanelUI.prototype as any).toggleMascotBubble = function toggleMascotBubble() {
  const bubble = document.getElementById('mascotBubble');
  if (!bubble) return;

  this._mascotBubbleOpen = !this._mascotBubbleOpen;
  if (this._mascotBubbleOpen) {
    bubble.classList.remove('hidden');
    // Update content immediately
    this.updateActivityState();
  } else {
    bubble.classList.add('hidden');
  }
};

(SidePanelUI.prototype as any).updateMascotBubbleContent = function updateMascotBubbleContent(
  verb: string,
  elapsed: string,
) {
  const bubbleVerb = document.getElementById('bubbleVerb');
  if (bubbleVerb) {
    bubbleVerb.textContent = `${verb} ${elapsed}`;
  }
};

/* ============================================================================
   Mascot Eye State
   ============================================================================ */

(SidePanelUI.prototype as any).updateMascotEyeState = function updateMascotEyeState() {
  const mascot = document.getElementById('mascotCorner');
  if (!mascot) return;

  const isRunning = !!(this.runStartedAt || this.isStreaming || this.pendingToolCount > 0);
  const isTyping = this._lastTypingAt && (Date.now() - this._lastTypingAt) < 5000;

  // Remove all state classes
  mascot.classList.remove('sleeping', 'working', 'looking-up', 'thinking');

  if (isRunning) {
    mascot.classList.add('working');
  } else if (isTyping) {
    mascot.classList.add('looking-up');
  } else {
    mascot.classList.add('sleeping');
  }
};

(SidePanelUI.prototype as any).updateThinkingPanel = function updateThinkingPanel(
  thinking: string | null,
  isStreaming = false,
) {
  // Track latest thinking for activity state
  if (thinking) {
    this.latestThinking = dedupeThinking(thinking.trim());
  } else if (!isStreaming) {
    this.latestThinking = null;
  }

  // If we have a streaming container, render/update thinking block inline
  if (this.streamingState?.eventsEl && this.latestThinking) {
    let thinkingBlock = this.streamingState.eventsEl.querySelector('.inline-thinking-block') as HTMLElement | null;

    if (!thinkingBlock) {
      // Create thinking block at the top of the events container
      thinkingBlock = document.createElement('div');
      thinkingBlock.className = 'inline-thinking-block';
      thinkingBlock.innerHTML = `
        <div class="thinking-block-inner">
          <div class="thinking-header-inline">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4"/>
              <path d="M12 8h.01"/>
            </svg>
            <span>Thinking</span>
          </div>
          <div class="thinking-content-inline"></div>
        </div>
      `;
      // Insert at the beginning of events
      const firstChild = this.streamingState.eventsEl.firstChild;
      if (firstChild) {
        this.streamingState.eventsEl.insertBefore(thinkingBlock, firstChild);
      } else {
        this.streamingState.eventsEl.appendChild(thinkingBlock);
      }
    }

    // Update content
    const contentEl = thinkingBlock.querySelector('.thinking-content-inline') as HTMLElement | null;
    if (contentEl) {
      contentEl.textContent = this.latestThinking;
    }
  }
};

(SidePanelUI.prototype as any).resetActivityPanel = function resetActivityPanel() {
  // Clear inline tool displays
  if (this.elements.chatMessages) {
    const trees = this.elements.chatMessages.querySelectorAll('.tool-card, .step-block');
    trees.forEach((tree) => tree.remove());
  }
  this.latestThinking = null;
  this.activeToolName = null;
  this.toolCallViews.clear();
  this.stepTimeline.steps.clear();
  this.stepTimeline.activeStepIndex = null;
  this.stepTimeline.activeStepBody = null;
};
