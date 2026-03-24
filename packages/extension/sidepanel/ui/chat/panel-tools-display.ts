import { MAX_TOOL_CALL_VIEWS, sidePanelProto } from './panel-tools-shared.js';

const HIDDEN_TOOLS = new Set(['set_plan', 'update_plan']);

sidePanelProto.displayToolExecution = function displayToolExecution(
  toolName: string,
  args: any,
  result: any,
  toolCallId: string | null = null,
) {
  if (HIDDEN_TOOLS.has(toolName)) return;

  const entryId = toolCallId || `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let entry = this.toolCallViews.get(entryId);
  const displayName = toolName;

  if (!entry) {
    if (this.toolCallViews.size >= MAX_TOOL_CALL_VIEWS) {
      const iter = this.toolCallViews.entries();
      const excess = this.toolCallViews.size - MAX_TOOL_CALL_VIEWS + 1;
      for (let i = 0; i < excess; i++) {
        const next = iter.next().value;
        if (next) {
          const [key, old] = next;
          old.abortController?.abort();
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
      abortController: new AbortController(),
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

sidePanelProto.createToolElement = function createToolElement(entry: any) {
  const container = document.createElement('div');
  container.className = 'tool-call-card running';
  container.dataset.toolId = entry.id;

  const icon = this.getToolIcon(entry.fullToolName);

  const formatJson = (obj: any) => {
    const text = typeof obj === 'object' ? JSON.stringify(obj, null, 2) : String(obj);
    return text.length > 2000 ? text.slice(0, 2000) + '\n...(truncated)' : text;
  };

  const hasInput = entry.args && Object.keys(entry.args).length > 0;
  const inputText = hasInput ? formatJson(entry.args) : '';

  container.innerHTML = `
    <div class="tool-call-header">
      <span class="tool-call-icon">${icon}</span>
      <span class="tool-call-name">${this.escapeHtml(entry.toolName)}</span>
      <span class="tool-status"></span>
      <span class="tool-duration"></span>
    </div>
    ${hasInput ? `<div class="tool-card-section">
      <div class="tool-card-section-header">
        <span class="tool-card-section-label">Input</span>
        <button class="tool-card-copy" data-copy="input" title="Copy">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>
      <pre class="tool-card-code"><code>${this.escapeHtml(inputText)}</code></pre>
    </div>` : ''}
    <div class="tool-call-output-slot"></div>
  `;

  entry.statusEl = container.querySelector('.tool-status');
  entry.durationEl = container.querySelector('.tool-duration');
  this.animateToolDuration(entry);

  container.addEventListener('click', (ce: Event) => {
    const copyBtn = (ce.target as HTMLElement).closest('.tool-card-copy') as HTMLElement | null;
    if (!copyBtn) return;
    ce.stopPropagation();
    const which = copyBtn.dataset.copy;
    const data = which === 'input' ? entry.args : entry.result;
    const text = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.classList.add('copied');
      setTimeout(() => copyBtn.classList.remove('copied'), 1500);
    });
  });

  return container;
};

sidePanelProto.animateToolDuration = function animateToolDuration(entry: any) {
  if (!entry.durationEl || entry.endTime) return;
  const update = () => {
    if (!entry.durationEl || entry.endTime) return;
    const elapsed = Date.now() - entry.startTime;
    entry.durationEl.textContent = elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`;
    requestAnimationFrame(() => setTimeout(update, 100));
  };
  update();
};

sidePanelProto.updateToolResult = function updateToolResult(entry: any, result: any) {
  if (!entry || !entry.element) return;

  entry.endTime = Date.now();
  const isError = result && (result.error || result.success === false);
  const duration = entry.endTime - entry.startTime;
  const isNoopScroll = entry.fullToolName === 'scroll' && result && result.success === true && result.moved === false;

  entry.element.classList.remove('running');
  entry.element.classList.add(isError ? 'error' : 'done');
  entry.element.classList.toggle('noop', isNoopScroll);

  if (entry.durationEl) {
    entry.durationEl.textContent = duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`;
  }
  if (entry.statusEl) {
    entry.statusEl.textContent = isError ? 'ERR' : '';
  }

  if (isNoopScroll) {
    entry.element.title = 'Scroll did not move. The page may use an inner scroll container; pass scroll.selector.';
    const headerEl = entry.element.querySelector('.tool-call-header');
    let noteEl = entry.element.querySelector('.tool-note') as HTMLElement | null;
    if (!noteEl && headerEl) {
      noteEl = document.createElement('span');
      noteEl.className = 'tool-note';
      noteEl.textContent = 'no-op';
      headerEl.appendChild(noteEl);
    }
  }

  entry.result = result;

  // Render output section into the output slot
  const outputSlot = entry.element.querySelector('.tool-call-output-slot');
  if (outputSlot && result !== null && result !== undefined) {
    const formatJson = (obj: any) => {
      const text = typeof obj === 'object' ? JSON.stringify(obj, null, 2) : String(obj);
      return text.length > 2000 ? text.slice(0, 2000) + '\n...(truncated)' : text;
    };
    const outputText = formatJson(result);
    outputSlot.innerHTML = `<div class="tool-card-section">
      <div class="tool-card-section-header">
        <span class="tool-card-section-label">Output</span>
        <button class="tool-card-copy" data-copy="output" title="Copy">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>
      <pre class="tool-card-code"><code>${this.escapeHtml(outputText)}</code></pre>
    </div>`;
  }

  this.attachScreenshotPreview(entry, result);
  if (entry.result && typeof entry.result === 'object' && entry.result.dataUrl) {
    entry.result = { ...entry.result, dataUrl: '[stored in reportImages]' };
  }

  // Show selected element chip for selection-related tools
  if (!isError && entry.args && this.streamingState?.eventsEl) {
    const selector = entry.args.selector || entry.args.element || entry.args.text;
    const isSelectTool = ['click', 'select', 'hover', 'fill', 'type', 'check', 'focus'].includes(entry.fullToolName);
    if (selector && isSelectTool) {
      const prev = this.streamingState.eventsEl.querySelector('.selected-element-chip');
      if (prev) prev.remove();
      const chip = document.createElement('div');
      chip.className = 'selected-element-chip';
      const label = typeof selector === 'string' && selector.length > 50 ? selector.slice(0, 47) + '...' : String(selector);
      chip.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 15l6 6M4 4l6 6"/><rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/></svg><span>Selected: ${this.escapeHtml(label)}</span>`;
      entry.element.insertAdjacentElement('afterend', chip);
    }
  }
};
