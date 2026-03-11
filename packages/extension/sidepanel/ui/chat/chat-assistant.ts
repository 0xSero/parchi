import { createMessage } from '../../../ai/message-schema.js';
import { extractThinking } from '../../../ai/message-utils.js';
import { SidePanelUI } from '../core/panel-ui.js';
import type { UsagePayload } from '../types/panel-types.js';
import { renderNewAssistantMessage } from './chat-assistant-new.js';
import { renderStreamedContainer } from './chat-assistant-streamed.js';
import { MAX_DISPLAY_HISTORY } from './chat-utils.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.displayAssistantMessage = function displayAssistantMessage(
  content: string,
  thinking: string | null = null,
  usage: UsagePayload | null = null,
  model: string | null = null,
) {
  this.stopThinkingTimer?.();
  const streamResult = this.finishStreamingMessage();
  const streamedContainer = streamResult?.container;
  const streamEventsEl = streamedContainer?.querySelector('.stream-events') as HTMLElement | null;
  const hasStreamEvents = Boolean(streamEventsEl && streamEventsEl.children.length > 0);

  const parsed = extractThinking(content, [streamResult?.thinking, thinking].filter(Boolean).join('\n\n') || null);
  content = parsed.content;
  thinking = parsed.thinking;

  this.updateThinkingPanel(thinking, false);

  // Handle empty content case
  if ((!content || content.trim() === '') && !thinking && !hasStreamEvents) {
    if (streamedContainer) {
      streamedContainer.remove();
    }
    this.updateStatus('Ready', 'success');
    this.elements.composer?.classList.remove('running');
    this.stopWatchdog?.();
    this.pendingToolCount = 0;
    this.updateActivityState();
    return;
  }

  const { messageMeta } = processUsage(this, usage, content, model);

  const selectedReportImages =
    typeof this.getSelectedReportImagesForExport === 'function' ? this.getSelectedReportImagesForExport() : [];

  const buildReportImagesHtml = (): string => buildReportImagesHtmlFn(this, selectedReportImages);

  // Save to display history
  const assistantEntry = createMessage({ role: 'assistant', content, thinking });
  if (assistantEntry) {
    this.displayHistory.push(assistantEntry);
    if (this.displayHistory.length > MAX_DISPLAY_HISTORY) {
      this.displayHistory.splice(0, this.displayHistory.length - MAX_DISPLAY_HISTORY);
    }
  }

  const showThinking = this.elements.showThinking?.value === 'true';

  if (streamedContainer) {
    renderStreamedContainer(this, streamedContainer, streamEventsEl, {
      content,
      thinking,
      messageMeta,
      showThinking,
      buildReportImagesHtml,
    });
    return;
  }

  renderNewAssistantMessage(this, {
    content,
    thinking,
    messageMeta,
    showThinking,
    buildReportImagesHtml,
  });
};

function processUsage(
  self: SidePanelUI,
  usage: UsagePayload | null,
  content: string,
  model: string | null,
): { messageMeta: string } {
  let normalizedUsage = self.normalizeUsage(usage);
  const modelLabel = model || self.getActiveModelLabel();
  const estimatedApplied = Math.max(0, Number(self.streamingUsageEstimatedTokensApplied || 0));

  if (!normalizedUsage) {
    normalizedUsage = self.estimateUsageFromContent(content);
    if (normalizedUsage && estimatedApplied > 0) {
      normalizedUsage = adjustUsageForEstimated(normalizedUsage, estimatedApplied);
    }
  } else if (estimatedApplied > 0) {
    normalizedUsage = adjustUsageForEstimated(normalizedUsage, estimatedApplied);
  }

  if (
    normalizedUsage &&
    (normalizedUsage.inputTokens > 0 || normalizedUsage.outputTokens > 0 || normalizedUsage.totalTokens > 0)
  ) {
    self.updateUsageStats(normalizedUsage);
  }

  self.streamingUsageEstimatedTokens = 0;
  self.streamingUsageEstimatedTokensApplied = 0;

  const messageMeta = self.buildMessageMeta(normalizedUsage, modelLabel);
  return { messageMeta };
}

function adjustUsageForEstimated(
  usage: { inputTokens: number; outputTokens: number; totalTokens: number },
  estimatedApplied: number,
): { inputTokens: number; outputTokens: number; totalTokens: number } {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: Math.max(0, usage.outputTokens - estimatedApplied),
    totalTokens: Math.max(0, usage.totalTokens - estimatedApplied),
  };
}

function buildReportImagesHtmlFn(self: SidePanelUI, selectedReportImages: unknown[]): string {
  if (!Array.isArray(selectedReportImages) || selectedReportImages.length === 0) return '';

  const cards = selectedReportImages
    .map((image: unknown, index: number) => {
      const img = image as { title?: unknown; url?: unknown; id?: unknown; dataUrl?: unknown };
      const label = self.escapeHtml(String(img.title || img.url || img.id || `Image ${index + 1}`));
      const src = String(img.dataUrl || '');
      if (!src) return '';
      return `
        <figure class="report-image-card">
          <img src="${src}" alt="${label}" loading="lazy" />
          <figcaption>${label}</figcaption>
        </figure>
      `;
    })
    .join('');

  if (!cards) return '';
  return `
    <div class="report-images-inline">
      <div class="report-images-inline-title">Selected report images</div>
      <div class="report-images-inline-grid">${cards}</div>
    </div>
  `;
}
