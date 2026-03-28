import type { SidePanelUI } from '../core/panel-ui.js';
import { MAX_REPORT_IMAGES, MAX_REPORT_IMAGE_BYTES, dataUrlToBlobUrl, sidePanelProto } from './panel-tools-shared.js';

type ReportImageEntry = SidePanelUI['reportImages'] extends Map<string, infer T> ? T : never;

const removeReportImage = (self: any, id: string) => {
  const evicted = self.reportImages.get(id);
  if (!evicted) return 0;
  const byteLength = evicted.dataUrl?.length || 0;
  if (evicted._blobUrl) URL.revokeObjectURL(evicted._blobUrl);
  self.reportImages.delete(id);
  self.selectedReportImageIds.delete(id);
  const previewEl = document.querySelector(`.report-image-toggle[data-report-image-id="${id}"]`);
  previewEl?.closest('.tool-screenshot-preview')?.remove();
  return byteLength;
};

const trimReportImagesByCount = (self: any) => {
  if (self.reportImages.size <= MAX_REPORT_IMAGES) return;
  for (const allowSelected of [false, true]) {
    for (const id of [...self.reportImageOrder]) {
      if (self.reportImages.size <= MAX_REPORT_IMAGES) break;
      if (!allowSelected && self.selectedReportImageIds.has(id)) continue;
      removeReportImage(self, id);
    }
    if (self.reportImages.size <= MAX_REPORT_IMAGES) break;
  }
  self.reportImageOrder = self.reportImageOrder.filter((id: string) => self.reportImages.has(id));
};

const trimReportImagesByBytes = (self: any) => {
  let totalBytes = 0;
  for (const img of self.reportImages.values()) totalBytes += img.dataUrl?.length || 0;
  if (totalBytes <= MAX_REPORT_IMAGE_BYTES) return;

  for (const allowSelected of [false, true]) {
    for (const id of [...self.reportImageOrder]) {
      if (totalBytes <= MAX_REPORT_IMAGE_BYTES) break;
      if (!allowSelected && self.selectedReportImageIds.has(id)) continue;
      totalBytes -= removeReportImage(self, id);
    }
    if (totalBytes <= MAX_REPORT_IMAGE_BYTES) break;
  }

  self.reportImageOrder = self.reportImageOrder.filter((id: string) => self.reportImages.has(id));
};

sidePanelProto.recordReportImage = function recordReportImage(image: any) {
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
  if (!this.reportImages.has(normalized.id)) this.reportImageOrder.push(normalized.id);
  this.reportImages.set(normalized.id, normalized);
  if (normalized.selected) {
    this.selectedReportImageIds.add(normalized.id);
  } else {
    this.selectedReportImageIds.delete(normalized.id);
  }

  trimReportImagesByCount(this);
  trimReportImagesByBytes(this);

  if (normalized.toolCallId) {
    const entry = this.toolCallViews.get(normalized.toolCallId);
    if (entry) this.attachScreenshotPreview(entry, { reportImageId: normalized.id });
  }
};

sidePanelProto.updateReportImageSelection = function updateReportImageSelection(ids: any[]) {
  const nextSelected = new Set(
    (Array.isArray(ids) ? ids : [])
      .map((value: unknown) => String(value || '').trim())
      .filter((value: string) => value.length > 0),
  );
  this.selectedReportImageIds = nextSelected;
  this.reportImages.forEach((image: ReportImageEntry, id: string) => {
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

sidePanelProto.attachScreenshotPreview = function attachScreenshotPreview(entry: any, result: any) {
  if (!entry?.element) return;

  let image: any = null;
  const imageId = typeof result?.reportImageId === 'string' ? result.reportImageId : '';
  if (imageId) image = this.reportImages.get(imageId) || null;

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
  if (!image._blobUrl) image._blobUrl = dataUrlToBlobUrl(image.dataUrl);
  const imgSrc = image._blobUrl || image.dataUrl;

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
    <img class="tool-screenshot-image" src="${this.escapeHtml(imgSrc)}" alt="${this.escapeHtml(imageLabel)}" />
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

  const previewSignal = entry.abortController?.signal;
  const listenerOpts = previewSignal ? ({ signal: previewSignal } as AddEventListenerOptions) : undefined;
  preview.addEventListener('click', (event) => event.stopPropagation(), listenerOpts);
  const checkbox = preview.querySelector('.report-image-toggle') as HTMLInputElement | null;
  checkbox?.addEventListener('click', (event) => event.stopPropagation(), listenerOpts);
  checkbox?.addEventListener(
    'change',
    (event) => {
      event.stopPropagation();
      const checked = checkbox.checked;
      if (checked) {
        this.selectedReportImageIds.add(image.id);
      } else {
        this.selectedReportImageIds.delete(image.id);
      }
      image.selected = checked;
      preview.classList.toggle('selected', checked);
    },
    listenerOpts,
  );
};

sidePanelProto.nullifyFinalizedToolData = function nullifyFinalizedToolData() {
  for (const entry of this.toolCallViews.values()) {
    if (entry.endTime) {
      entry.args = null;
      entry.result = null;
    }
  }
};
