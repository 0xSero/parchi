import { SidePanelUI } from '../core/panel-ui.js';
import { formatTraceNumber, formatTracePercent, formatTraceSignedDelta } from './chat-utils.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.displayTokenTraceMessage = function displayTokenTraceMessage(trace: {
  action?: unknown;
  reason?: unknown;
  note?: unknown;
  before?: unknown;
  after?: unknown;
  details?: unknown;
}) {
  const action = String(trace?.action || 'token_trace');
  const reason = String(trace?.reason || 'unknown');
  const note = String(trace?.note || '').trim();
  const before =
    (trace?.before && typeof trace.before === 'object' ? (trace.before as Record<string, unknown>) : {}) || {};
  const after = (trace?.after && typeof trace.after === 'object' ? (trace.after as Record<string, unknown>) : {}) || {};

  const { deltaInput, deltaApprox, deltaSession } = calculateDeltas(before, after);

  const container = document.createElement('div');
  container.className = 'message token-trace-message';
  this.tagAgentView?.(container, 'main');
  container.innerHTML = `
    <div class="token-trace-card">
      <div class="token-trace-header">
        <span class="token-trace-title">Token trace</span>
        <span class="token-trace-badge">${this.escapeHtml(action)}</span>
        <span class="token-trace-reason">${this.escapeHtml(reason)}</span>
      </div>
      <div class="token-trace-grid">
        <div class="token-trace-row">
          <span class="token-trace-key">Provider input</span>
          <span class="token-trace-value">${formatTraceNumber(before.providerInputTokens)} → ${formatTraceNumber(after.providerInputTokens)} <strong>${formatTraceSignedDelta(deltaInput)}</strong></span>
        </div>
        <div class="token-trace-row">
          <span class="token-trace-key">Context approx</span>
          <span class="token-trace-value">${formatTraceNumber(before.contextApproxTokens)} (${formatTracePercent(before.contextPercent)}) → ${formatTraceNumber(after.contextApproxTokens)} (${formatTracePercent(after.contextPercent)}) <strong>${formatTraceSignedDelta(deltaApprox)}</strong></span>
        </div>
        <div class="token-trace-row">
          <span class="token-trace-key">Session total</span>
          <span class="token-trace-value">${formatTraceNumber(before.sessionTotalTokens)} → ${formatTraceNumber(after.sessionTotalTokens)} <strong>${formatTraceSignedDelta(deltaSession)}</strong></span>
        </div>
      </div>
      ${note ? `<div class="token-trace-note">${this.escapeHtml(note)}</div>` : ''}
      <details class="token-trace-details">
        <summary>Raw details</summary>
        <pre>${this.escapeHtml(JSON.stringify({ before, after, details: trace?.details }, null, 2))}</pre>
      </details>
    </div>
  `;

  this.elements.chatMessages.appendChild(container);
  this.scrollToBottom();
  this.updateChatEmptyState();
};

function calculateDeltas(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { deltaInput: number; deltaApprox: number; deltaSession: number } {
  const beforeInput = Number(before.providerInputTokens ?? Number.NaN);
  const afterInput = Number(after.providerInputTokens ?? Number.NaN);
  const deltaInput =
    Number.isFinite(beforeInput) && Number.isFinite(afterInput) ? afterInput - beforeInput : Number.NaN;

  const beforeApprox = Number(before.contextApproxTokens ?? Number.NaN);
  const afterApprox = Number(after.contextApproxTokens ?? Number.NaN);
  const deltaApprox =
    Number.isFinite(beforeApprox) && Number.isFinite(afterApprox) ? afterApprox - beforeApprox : Number.NaN;

  const beforeSession = Number(before.sessionTotalTokens ?? Number.NaN);
  const afterSession = Number(after.sessionTotalTokens ?? Number.NaN);
  const deltaSession =
    Number.isFinite(beforeSession) && Number.isFinite(afterSession) ? afterSession - beforeSession : Number.NaN;

  return { deltaInput, deltaApprox, deltaSession };
}
