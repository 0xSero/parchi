import { MAX_TOOL_CALL_VIEWS, sidePanelProto } from './panel-tools-shared.js';

function highlightCode(escaped: string): string {
  return escaped
    .replace(/&quot;(.*?)&quot;/g, '<span class="tc-str">&quot;$1&quot;</span>')
    .replace(/\b(true|false|null|undefined)\b/g, '<span class="tc-bool">$1</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="tc-num">$1</span>')
    .replace(
      /\b(const|let|var|function|return|await|async|if|else|for|while|new|try|catch|throw)\b/g,
      '<span class="tc-kw">$1</span>',
    )
    .replace(/(\/\/.*)/g, '<span class="tc-cmt">$1</span>');
}

const TOOL_ICONS: Record<string, string> = {
  click:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 15l-2 5L9 9l11 4-5 2z"/><path d="M22 22l-5-5"/></svg>',
  clickAt:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 15l-2 5L9 9l11 4-5 2z"/><path d="M22 22l-5-5"/></svg>',
  native_click:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 15l-2 5L9 9l11 4-5 2z"/><path d="M22 22l-5-5"/></svg>',
  scroll:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
  navigate:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  openTab:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  getContent:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  findHtml:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  screenshot:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
  type: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>',
  fill: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/></svg>',
  pressKey:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M12 12h.01"/></svg>',
  repl: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
  evaluate:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
  waitFor:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  hover:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 15l-2 5L9 9l11 4-5 2z"/></svg>',
  select:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 15l-2 5L9 9l11 4-5 2z"/></svg>',
  create_file:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
  watchNetwork:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></svg>',
  getNetworkLog:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><circle cx="12" cy="20" r="1"/></svg>',
};

const FALLBACK_ICON =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>';

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
      // Reveal container on first content
      if (this.streamingState.container?.style.display === 'none') {
        this.streamingState.container.style.display = '';
      }
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
  const isCode = entry.fullToolName === 'repl' || entry.fullToolName === 'evaluate';
  container.className = `tool-row running${isCode ? ' tool-row-code' : ''}`;
  container.dataset.toolId = entry.id;

  const icon = TOOL_ICONS[entry.fullToolName] || FALLBACK_ICON;

  // Build a human-readable summary instead of raw args
  const summary = this.getToolSummary(entry.fullToolName, entry.args);

  container.innerHTML = `
    <span class="tool-icon">${icon}</span>
    <span class="tool-name">${this.escapeHtml(entry.toolName)}</span>
    ${summary ? `<span class="tool-args">${this.escapeHtml(summary)}</span>` : ''}
    <span class="tool-status"></span>
    <span class="tool-duration"></span>
  `;

  entry.statusEl = container.querySelector('.tool-status');
  entry.durationEl = container.querySelector('.tool-duration');
  this.animateToolDuration(entry);

  // Click toggles card open/closed
  container.addEventListener('click', (e: Event) => {
    if ((e.target as HTMLElement).closest('.tool-card-copy')) return;
    const existing = container.querySelector('.tool-card');
    if (existing) {
      existing.remove();
      container.classList.remove('expanded');
    } else {
      this.expandToolCard(container, entry);
    }
  });
  container.style.cursor = 'pointer';
  return container;
};

sidePanelProto.getToolSummary = function getToolSummary(toolName: string, args: any): string {
  if (!args) return '';
  const s = (v: unknown) => (typeof v === 'string' ? v : '');
  const trunc = (v: string, max: number) => (v.length > max ? v.slice(0, max - 1) + '\u2026' : v);

  switch (toolName) {
    case 'click':
    case 'clickAt':
    case 'native_click':
    case 'hover':
    case 'select':
    case 'focus':
      return trunc(s(args.selector) || s(args.element) || s(args.text), 60);
    case 'type':
    case 'fill':
      return trunc(`${s(args.selector) || s(args.element)} \u2190 "${s(args.text) || s(args.value)}"`, 60);
    case 'pressKey':
      return s(args.key) || s(args.keys);
    case 'navigate':
    case 'openTab':
      return trunc(s(args.url), 50);
    case 'scroll': {
      const dir = s(args.direction) || 'down';
      const amt = args.amount ? ` ${args.amount}` : '';
      const sel = s(args.selector);
      return sel ? `${dir}${amt} on ${trunc(sel, 30)}` : `${dir}${amt}`;
    }
    case 'getContent':
      return trunc(s(args.selector) || s(args.element) || 'page', 50);
    case 'findHtml':
      return trunc(s(args.query) || s(args.selector) || '', 50);
    case 'waitFor':
      return trunc(s(args.selector) || s(args.text) || '', 50);
    case 'repl':
    case 'evaluate': {
      const code = s(args.code) || s(args.script) || s(args.expression);
      if (!code) return '';
      const firstLine = code.split('\n')[0];
      return trunc(firstLine, 50);
    }
    case 'screenshot':
      return s(args.selector) ? trunc(s(args.selector), 40) : 'full page';
    case 'create_file':
      return s(args.filename);
    default: {
      const tokens = this.getArgsTokens(args);
      return trunc(tokens.join(' \u00b7 '), 60);
    }
  }
};

sidePanelProto.expandToolCard = function expandToolCard(container: HTMLElement, entry: any) {
  if (container.querySelector('.tool-card')) return;
  const hasInput = entry.args && Object.keys(entry.args).length > 0;
  const hasOutput = entry.result !== null && entry.result !== undefined;
  if (!hasInput && !hasOutput) return;

  const card = document.createElement('div');
  card.className = 'tool-card';

  const formatJson = (obj: any) => {
    const text = typeof obj === 'object' ? JSON.stringify(obj, null, 2) : String(obj);
    return text.length > 2000 ? text.slice(0, 2000) + '\n...(truncated)' : text;
  };

  let html = '';
  if (hasInput) {
    const inputText = formatJson(entry.args);
    html += `<div class="tool-card-section">
      <div class="tool-card-section-header">
        <span class="tool-card-section-label">input</span>
        <button class="tool-card-copy" data-copy="input" title="Copy">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>
      <pre class="tool-card-code"><code>${highlightCode(this.escapeHtml(inputText))}</code></pre>
    </div>`;
  }
  if (hasOutput) {
    const outputText = formatJson(entry.result);
    html += `<div class="tool-card-section">
      <div class="tool-card-section-header">
        <span class="tool-card-section-label">output</span>
        <button class="tool-card-copy" data-copy="output" title="Copy">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>
      <pre class="tool-card-code"><code>${highlightCode(this.escapeHtml(outputText))}</code></pre>
    </div>`;
  }
  card.innerHTML = html;

  card.addEventListener('click', (ce: Event) => {
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

  container.appendChild(card);
  container.classList.add('expanded');
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
    let noteEl = entry.element.querySelector('.tool-note') as HTMLElement | null;
    if (!noteEl) {
      noteEl = document.createElement('span');
      noteEl.className = 'tool-note';
      noteEl.textContent = 'no-op';
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

  entry.result = result;
  this.attachScreenshotPreview(entry, result);
  if (entry.result && typeof entry.result === 'object' && entry.result.dataUrl) {
    entry.result = { ...entry.result, dataUrl: '[stored in reportImages]' };
  }

  // Auto-expand tool card on completion — only for repl/evaluate
  const isCodeTool = entry.fullToolName === 'repl' || entry.fullToolName === 'evaluate';
  if (isCodeTool && entry.element && !entry.element.querySelector('.tool-card')) {
    this.expandToolCard(entry.element, entry);
  }
};
