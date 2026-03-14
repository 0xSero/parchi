import type { Message } from '../../../ai/messages/schema.js';

export const CONTEXT_HISTORY_SOFT_CAP = 600;

export function clampContextHistory(history: Message[] | null | undefined, maxEntries = CONTEXT_HISTORY_SOFT_CAP) {
  if (!Array.isArray(history)) return [];
  if (history.length > maxEntries) {
    history.splice(0, history.length - maxEntries);
  }
  return history;
}

export function clearToolCallViews(toolCallViews: Map<string, any> | null | undefined) {
  if (!(toolCallViews instanceof Map)) return;
  for (const entry of toolCallViews.values()) {
    entry?.abortController?.abort?.();
    if (entry && typeof entry === 'object') {
      entry.element = null;
      entry.statusEl = null;
      entry.durationEl = null;
    }
  }
  toolCallViews.clear();
}

export function clearReportImages(
  reportImages: Map<string, any> | null | undefined,
  reportImageOrder?: string[] | null,
  selectedReportImageIds?: Set<string> | null,
) {
  if (reportImages instanceof Map) {
    for (const image of reportImages.values()) {
      const blobUrl = typeof image?._blobUrl === 'string' ? image._blobUrl : '';
      if (blobUrl) {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {}
      }
      if (image && typeof image === 'object' && '_blobUrl' in image) {
        delete image._blobUrl;
      }
    }
    reportImages.clear();
  }
  if (Array.isArray(reportImageOrder)) {
    reportImageOrder.length = 0;
  }
  if (selectedReportImageIds instanceof Set) {
    selectedReportImageIds.clear();
  }
}
