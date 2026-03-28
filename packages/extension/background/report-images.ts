import type { ReportImage, SessionState } from './service-types.js';

const MAX_REPORT_IMAGES_PER_SESSION = 50;
const MAX_REPORT_IMAGE_BYTES_PER_IMAGE = 4 * 1024 * 1024;
const MAX_REPORT_IMAGE_BYTES_PER_SESSION = 48 * 1024 * 1024;

export function estimateDataUrlBytes(dataUrl: string): number {
  if (!dataUrl) return 0;
  const commaIndex = dataUrl.indexOf(',');
  const payload = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  if (!payload) return 0;
  const rawLength = payload.length;
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((rawLength * 3) / 4) - padding);
}

export function getReportImageSummary(sessionState: SessionState) {
  return sessionState.reportImages.map((image) => ({
    id: image.id,
    capturedAt: image.capturedAt,
    url: image.url,
    title: image.title,
    tabId: image.tabId,
    visionDescription: image.visionDescription,
    selected: sessionState.selectedReportImageIds.has(image.id),
  }));
}

export function trimReportImages(sessionState: SessionState) {
  while (
    sessionState.reportImages.length > MAX_REPORT_IMAGES_PER_SESSION ||
    sessionState.reportImageBytes > MAX_REPORT_IMAGE_BYTES_PER_SESSION
  ) {
    let evictionIndex = sessionState.reportImages.findIndex(
      (candidate) => !sessionState.selectedReportImageIds.has(candidate.id),
    );
    if (evictionIndex < 0) evictionIndex = 0;
    const [evicted] = sessionState.reportImages.splice(evictionIndex, 1);
    if (!evicted) break;
    sessionState.reportImageBytes = Math.max(0, sessionState.reportImageBytes - Number(evicted.byteSize || 0));
    sessionState.selectedReportImageIds.delete(evicted.id);
  }
}

export function captureReportImage(
  sessionState: SessionState,
  result: Record<string, unknown>,
  args: Record<string, unknown>,
  toolCallId: string,
): ReportImage | null {
  const dataUrl = typeof result?.dataUrl === 'string' ? result.dataUrl : '';
  if (!dataUrl) return null;
  const byteSize = estimateDataUrlBytes(dataUrl);
  if (!Number.isFinite(byteSize) || byteSize <= 0) return null;
  if (byteSize > MAX_REPORT_IMAGE_BYTES_PER_IMAGE) {
    return null;
  }

  const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const image: ReportImage = {
    id,
    dataUrl,
    byteSize,
    capturedAt: Date.now(),
    toolCallId,
    tabId: typeof args?.tabId === 'number' ? args.tabId : undefined,
    url: typeof result?.url === 'string' ? result.url : undefined,
    title: typeof result?.title === 'string' ? result.title : undefined,
    visionDescription: typeof result?.visionDescription === 'string' ? result.visionDescription : undefined,
  };
  sessionState.reportImages.push(image);
  sessionState.reportImageBytes += byteSize;
  trimReportImages(sessionState);
  return image;
}

export function applyReportImageSelection(
  sessionState: SessionState,
  imageIds: string[],
  mode: 'replace' | 'add' | 'remove' | 'clear',
) {
  const validIds = new Set(sessionState.reportImages.map((image) => image.id));
  const filteredIds = imageIds.filter((id) => validIds.has(id));

  if (mode === 'clear') {
    sessionState.selectedReportImageIds.clear();
  } else if (mode === 'replace') {
    sessionState.selectedReportImageIds = new Set(filteredIds);
  } else if (mode === 'add') {
    filteredIds.forEach((id) => sessionState.selectedReportImageIds.add(id));
  } else if (mode === 'remove') {
    filteredIds.forEach((id) => sessionState.selectedReportImageIds.delete(id));
  }

  return getReportImageSummary(sessionState);
}
