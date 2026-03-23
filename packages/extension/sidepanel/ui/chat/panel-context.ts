import { SidePanelUI } from '../core/panel-ui.js';
import { compactionStageLabel, formatClockTime, toFiniteNumber, toPlainObject } from './context-inspector-utils.js';
import { getSessionTraces } from './trace-store.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

const formatContextTokens = (value: number) => {
  const normalized = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  if (normalized >= 1_000_000) return `${(normalized / 1_000_000).toFixed(1)}m`;
  if (normalized >= 10_000) return `${(normalized / 1_000).toFixed(0)}k`;
  if (normalized >= 1_000) return `${(normalized / 1_000).toFixed(1)}k`;
  return `${normalized}`;
};

const formatCompactionTimeAgo = (timestamp: number) => {
  const elapsedMs = Math.max(0, Date.now() - timestamp);
  const elapsedSec = Math.floor(elapsedMs / 1000);
  if (elapsedSec < 3) return 'just now';
  if (elapsedSec < 60) return `${elapsedSec}s ago`;
  const elapsedMin = Math.floor(elapsedSec / 60);
  if (elapsedMin < 60) return `${elapsedMin}m ago`;
  const elapsedHr = Math.floor(elapsedMin / 60);
  return `${elapsedHr}h ago`;
};

const defaultCompactionState = (): SidePanelUI['contextCompactionState'] => ({
  inProgress: false,
  lastResult: null,
  lastMessage: null,
  lastCompactedAt: 0,
  lastCompletedAt: 0,
});

sidePanelProto.setContextCompactionState = function setContextCompactionState(nextState: Record<string, unknown>) {
  const current =
    this.contextCompactionState && typeof this.contextCompactionState === 'object'
      ? this.contextCompactionState
      : defaultCompactionState();
  this.contextCompactionState = { ...current, ...nextState } as SidePanelUI['contextCompactionState'];
  this.updateContextInspector?.();
  if (this.isContextInspectorPopoverOpen?.()) {
    void this.refreshContextInspectorLog?.();
  }
};

sidePanelProto.isContextInspectorPopoverOpen = function isContextInspectorPopoverOpen() {
  const popover = this.elements.contextInspectorPopover as HTMLElement | null;
  return Boolean(popover && !popover.classList.contains('hidden'));
};

sidePanelProto.closeContextInspectorPopover = function closeContextInspectorPopover() {
  const popover = this.elements.contextInspectorPopover as HTMLElement | null;
  if (!popover) return;
  popover.classList.add('hidden');
  this.elements.contextInspectorBtn?.setAttribute('aria-expanded', 'false');
};

sidePanelProto.toggleContextInspectorPopover = function toggleContextInspectorPopover() {
  const popover = this.elements.contextInspectorPopover as HTMLElement | null;
  if (!popover) return;
  const shouldOpen = popover.classList.contains('hidden');
  if (!shouldOpen) {
    this.closeContextInspectorPopover?.();
    return;
  }
  popover.classList.remove('hidden');
  this.elements.contextInspectorBtn?.setAttribute('aria-expanded', 'true');
  void this.refreshContextInspectorLog?.();
};

sidePanelProto.refreshContextInspectorLog = async function refreshContextInspectorLog() {
  const eventsEl = this.elements.contextInspectorEvents as HTMLElement | null;
  const emptyEl = this.elements.contextInspectorEmpty as HTMLElement | null;
  const summaryEl = this.elements.contextInspectorSummary as HTMLElement | null;
  if (!eventsEl || !emptyEl || !summaryEl) return;

  const traces = await getSessionTraces(this.sessionId);
  const compactionEvents = traces
    .filter((event) => event.kind === 'compaction_event')
    .sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
  const recentEvents = compactionEvents.slice(-20).reverse();

  const usage = this.contextUsage || {};
  const used = Math.max(0, Number(usage.approxTokens || 0));
  const max = Math.max(1, Number(usage.maxContextTokens || this.getConfiguredContextLimit() || 1));
  const percent = Math.max(0, Math.min(100, Number(usage.percent || 0)));
  const compactedAt = Number(this.contextCompactionState?.lastCompactedAt || 0);
  summaryEl.textContent = compactedAt
    ? `${formatContextTokens(used)} / ${formatContextTokens(max)} (${percent}%) · Last compacted ${formatCompactionTimeAgo(compactedAt)}`
    : `${formatContextTokens(used)} / ${formatContextTokens(max)} (${percent}%) · No compaction yet`;

  if (recentEvents.length === 0) {
    eventsEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  eventsEl.innerHTML = recentEvents
    .map((event) => {
      const stage = String(event.stage || 'event');
      const details = toPlainObject(event.details);
      const beforeUsage = toPlainObject(details.beforeContextUsage);
      const afterUsage = toPlainObject(details.contextUsage);
      const trimmedCount = toFiniteNumber(details.trimmedCount);
      const preservedCount = toFiniteNumber(details.preservedCount);
      const removedApproxTokens =
        toFiniteNumber(details.tokensRemoved) ??
        toFiniteNumber(details.removedApproxTokensLowerBound) ??
        toFiniteNumber(details.removedTokens);
      const beforePercent = toFiniteNumber(beforeUsage.percent);
      const afterPercent = toFiniteNumber(afterUsage.percent) ?? toFiniteNumber(details.afterPercent);

      const metrics: string[] = [];
      if (trimmedCount !== null && trimmedCount > 0) metrics.push(`${Math.round(trimmedCount)} summarized`);
      if (preservedCount !== null && preservedCount > 0) metrics.push(`${Math.round(preservedCount)} kept`);
      if (removedApproxTokens !== null && removedApproxTokens > 0)
        metrics.push(`${formatContextTokens(removedApproxTokens)} removed`);
      if (beforePercent !== null && afterPercent !== null)
        metrics.push(`${Math.round(beforePercent)}%→${Math.round(afterPercent)}%`);

      const note = String(event.note || '').trim();
      const stageClass = `stage-${stage.replace(/[^a-z0-9_-]/gi, '-').toLowerCase()}`;
      const summary = metrics.join(' · ');
      return `
        <div class="context-inspector-event ${stageClass}">
          <div class="context-inspector-event-head">
            <span class="context-inspector-event-stage">${this.escapeHtml(compactionStageLabel(stage))}</span>
            <span class="context-inspector-event-time">${this.escapeHtml(formatClockTime(Number(event.ts || 0)))}</span>
          </div>
          ${summary ? `<div class="context-inspector-event-summary">${this.escapeHtml(summary)}</div>` : ''}
          ${note ? `<div class="context-inspector-event-note">${this.escapeHtml(note)}</div>` : ''}
        </div>
      `;
    })
    .join('');
};

sidePanelProto.updateContextInspector = function updateContextInspector() {
  const button = this.elements.contextInspectorBtn as HTMLButtonElement | null;
  const valueEl = this.elements.contextInspectorValue as HTMLElement | null;
  const metaEl = this.elements.contextInspectorMeta as HTMLElement | null;
  if (!button || !valueEl || !metaEl) return;

  const usage = this.contextUsage || {};
  const used = Math.max(0, Number(usage.approxTokens || 0));
  const max = Math.max(1, Number(usage.maxContextTokens || this.getConfiguredContextLimit() || 1));
  const percent = Math.max(0, Math.min(100, Number(usage.percent || 0)));

  valueEl.textContent = `${formatContextTokens(used)} / ${formatContextTokens(max)}`;

  const compactionState =
    this.contextCompactionState && typeof this.contextCompactionState === 'object'
      ? this.contextCompactionState
      : defaultCompactionState();
  const inProgress = compactionState.inProgress === true;
  const result = String(compactionState.lastResult || '');
  const compactedAt = Number(compactionState.lastCompactedAt || 0);

  let meta = `${percent}%`;
  if (inProgress) {
    meta = 'Compacting';
  } else if (result === 'success' && compactedAt > 0) {
    meta = formatCompactionTimeAgo(compactedAt);
  } else if (result === 'skipped') {
    meta = 'OK';
  } else if (result === 'error') {
    meta = 'Failed';
  }
  metaEl.textContent = meta;

  button.classList.remove(
    'level-low',
    'level-mid',
    'level-high',
    'level-critical',
    'is-compacting',
    'is-confirmed',
    'is-warning',
    'is-error',
  );
  if (percent >= 90) button.classList.add('level-critical');
  else if (percent >= 70) button.classList.add('level-high');
  else if (percent >= 35) button.classList.add('level-mid');
  else if (percent > 0) button.classList.add('level-low');

  if (inProgress) button.classList.add('is-compacting');
  else if (result === 'success') button.classList.add('is-confirmed');
  else if (result === 'skipped') button.classList.add('is-warning');
  else if (result === 'error') button.classList.add('is-error');

  button.disabled = inProgress;
  button.setAttribute('aria-busy', inProgress ? 'true' : 'false');
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute(
    'aria-label',
    `Context ${formatContextTokens(used)} / ${formatContextTokens(max)} (${percent}%). Click for compaction log and controls.`,
  );
  const tooltip = `${formatContextTokens(used)} / ${formatContextTokens(max)} (${percent}%) · Compaction log`;
  button.title = tooltip;
  button.setAttribute('data-tooltip', tooltip);

  // Also update inline token display in composer
  const composerTokens = this.elements.composerTokens as HTMLElement | null;
  if (composerTokens && used > 0) {
    composerTokens.textContent = `${formatContextTokens(used)}/${formatContextTokens(max)}`;
  }
};

sidePanelProto.updateContextUsage = function updateContextUsage(actualTokens: number | null = null) {
  if (typeof actualTokens === 'number' && Number.isFinite(actualTokens) && actualTokens >= 0) {
    this.sessionTokensUsed = Math.max(this.sessionTokensUsed || 0, actualTokens);
  }
  let approxTokens;

  if (typeof actualTokens === 'number' && Number.isFinite(actualTokens) && actualTokens >= 0) {
    approxTokens = this.sessionTokensUsed;
  } else {
    const joined = this.contextHistory
      .map((msg: unknown) => {
        if (!msg || typeof msg !== 'object') return '';
        const m = msg as { content?: unknown };
        if (typeof m.content === 'string') return m.content;
        if (Array.isArray(m.content)) {
          return m.content
            .map((p: unknown) => {
              if (typeof p === 'string') return p;
              if (!p || typeof p !== 'object') return '';
              const part = p as { text?: unknown; content?: unknown; output?: unknown };
              if (typeof part.text === 'string') return part.text;
              if (part.content !== undefined) return JSON.stringify(part.content);
              if (part.output !== undefined) {
                const outObj = part.output as { value?: unknown };
                const output = outObj?.value ?? part.output;
                if (typeof output === 'string') return output;
                try {
                  return JSON.stringify(output);
                } catch {
                  return String(output);
                }
              }
              return '';
            })
            .join('');
        }
        return '';
      })
      .join('\n');
    const chars = joined.length;
    const baseTokens = this.estimateBaseContextTokens();
    const estimated = baseTokens + Math.ceil(chars / 4);
    approxTokens = Math.max(estimated, this.sessionTokensUsed || 0);
  }

  const maxContextTokens = this.getConfiguredContextLimit();
  const safeApproxTokens = Math.max(0, Number(approxTokens || 0));
  const percent = Math.min(100, Math.round((safeApproxTokens / maxContextTokens) * 100));
  this.contextUsage = { approxTokens: safeApproxTokens, maxContextTokens, percent };
  this.updateActivityState();
  this.updateContextInspector?.();

  // Drive the context bar visual
  const bar = document.getElementById('contextBar');
  const composer = document.getElementById('composer');
  if (bar && composer) {
    composer.style.setProperty('--context-percent', `${percent}%`);
    bar.classList.remove('level-low', 'level-mid', 'level-high', 'level-critical');
    if (percent >= 90) bar.classList.add('level-critical');
    else if (percent >= 70) bar.classList.add('level-high');
    else if (percent >= 35) bar.classList.add('level-mid');
    else if (percent > 0) bar.classList.add('level-low');
  }
};

sidePanelProto.getConfiguredContextLimit = function getConfiguredContextLimit() {
  const active = this.configs[this.currentConfig] || {};
  const configured = Number(active.contextLimit) || Number.parseInt(this.elements.contextLimit?.value) || 200000;
  return configured;
};

sidePanelProto.estimateBaseContextTokens = function estimateBaseContextTokens() {
  const active = this.configs[this.currentConfig] || {};
  const prompt = active.systemPrompt || this.getDefaultSystemPrompt();
  const promptTokens = Math.ceil((prompt?.length || 0) / 4);
  const toolBudget = 1200;
  return promptTokens + toolBudget;
};
