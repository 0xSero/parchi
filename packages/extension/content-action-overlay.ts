import { type OverlayState, createOverlayState } from './content-types.js';

const OVERLAY_TRACK_INTERVAL_MS = 120;
const OVERLAY_MAX_TRACK_MS = 15_000;

export class ActionOverlayController {
  overlay: OverlayState;

  constructor() {
    this.overlay = createOverlayState();
  }

  ensureOverlayRoot() {
    if (this.overlay.root) return;

    const styleEl = document.createElement('style');
    styleEl.textContent = `
      #parchi-overlay-root {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 2147483647;
        font-family: "Space Grotesk", "Inter", system-ui, sans-serif;
      }
      .parchi-overlay-toast {
        position: fixed;
        top: 14px;
        right: 14px;
        padding: 8px 12px;
        border-radius: 10px;
        background: rgba(17, 24, 31, 0.92);
        color: #f4f1e8;
        font-size: 12px;
        letter-spacing: 0.02em;
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        display: flex;
        align-items: center;
        gap: 8px;
        animation: parchiToastIn 160ms ease-out;
      }
      .parchi-overlay-toast[data-status="error"] {
        border-color: rgba(242, 92, 84, 0.6);
        color: #ffd4cf;
      }
      .parchi-overlay-toast[data-status="done"] {
        border-color: rgba(86, 204, 157, 0.45);
      }
      .parchi-overlay-dot {
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: #f4b454;
        box-shadow: 0 0 10px rgba(244, 180, 84, 0.6);
      }
      .parchi-overlay-target {
        position: fixed;
        border: 2px solid rgba(244, 180, 84, 0.9);
        border-radius: 10px;
        box-shadow: 0 0 0 2px rgba(244, 180, 84, 0.15), 0 12px 30px rgba(0, 0, 0, 0.35);
        background: rgba(244, 180, 84, 0.06);
        transition: all 120ms ease-out;
      }
      .parchi-overlay-label {
        position: fixed;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(17, 24, 31, 0.92);
        color: #f4f1e8;
        font-size: 11px;
        letter-spacing: 0.02em;
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3);
        max-width: 260px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      @keyframes parchiToastIn {
        from { opacity: 0; transform: translateY(-6px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(styleEl);

    const root = document.createElement('div');
    root.id = 'parchi-overlay-root';
    document.documentElement.appendChild(root);

    const toast = document.createElement('div');
    toast.className = 'parchi-overlay-toast';
    toast.innerHTML = '<span class="parchi-overlay-dot"></span><span class="parchi-overlay-text"></span>';
    root.appendChild(toast);

    const target = document.createElement('div');
    target.className = 'parchi-overlay-target';
    root.appendChild(target);

    const label = document.createElement('div');
    label.className = 'parchi-overlay-label';
    root.appendChild(label);

    this.overlay = { ...this.overlay, root, toast, target, label, styleEl };
  }

  reportOverlayPerfEvent(reason: string, payload: Record<string, unknown> = {}) {
    try {
      const maybePromise = chrome.runtime.sendMessage({
        type: 'content_perf_event',
        event: {
          source: 'overlay',
          reason,
          url: window.location.href,
          ts: Date.now(),
          ...payload,
        },
      });
      if (maybePromise && typeof maybePromise.catch === 'function') {
        void maybePromise.catch((error: unknown) => {
          console.warn('[ContentActionOverlay] Failed to send perf event:', error);
        });
      }
    } catch {
      // Ignore perf telemetry failures in content script context.
    }
  }

  startOverlayTracking() {
    if (this.overlay.trackTimer != null) {
      window.clearInterval(this.overlay.trackTimer);
      this.overlay.trackTimer = null;
    }
    this.overlay.trackingStartedAt = Date.now();
    this.overlay.trackTimer = window.setInterval(() => {
      this.updateOverlayPosition();
    }, OVERLAY_TRACK_INTERVAL_MS);
  }

  hideTrackedOverlay() {
    if (this.overlay.target) this.overlay.target.style.opacity = '0';
    if (this.overlay.label) this.overlay.label.style.opacity = '0';
  }

  clearActionOverlay() {
    if (this.overlay.cleanupTimer) {
      window.clearTimeout(this.overlay.cleanupTimer);
      this.overlay.cleanupTimer = null;
    }
    if (this.overlay.trackTimer != null) {
      window.clearInterval(this.overlay.trackTimer);
      this.overlay.trackTimer = null;
    }
    if (this.overlay.toast) this.overlay.toast.style.opacity = '0';
    if (this.overlay.target) this.overlay.target.style.opacity = '0';
    if (this.overlay.label) this.overlay.label.style.opacity = '0';
    this.overlay.trackedElement = null;
    this.overlay.trackingStartedAt = null;
  }

  destroyOverlay() {
    this.clearActionOverlay();
    const { root, styleEl } = this.overlay;
    if (styleEl && styleEl.isConnected) styleEl.remove();
    if (root && root.isConnected) root.remove();
    this.overlay = createOverlayState();
  }

  showActionOverlay(payload: Record<string, unknown>) {
    const { label: overlayLabel, selector, note, status, durationMs, bringIntoView } = payload || {};
    this.ensureOverlayRoot();

    const toast = this.overlay.toast;
    const actionLabel = [overlayLabel, note].filter(Boolean).join(' · ');
    if (toast) {
      const textEl = toast.querySelector('.parchi-overlay-text');
      if (textEl) textEl.textContent = actionLabel || 'Working…';
      toast.style.opacity = '1';
      toast.dataset.status = typeof status === 'string' ? status : 'running';
    }

    if (typeof selector === 'string' && selector) {
      const element = document.querySelector<HTMLElement>(selector);
      if (element) {
        if (bringIntoView === true && !this.isElementInViewport(element)) {
          element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
        }
        this.overlay.trackedElement = element;
        this.startOverlayTracking();
        this.updateOverlayPosition();
      } else {
        this.overlay.trackedElement = null;
        this.hideTrackedOverlay();
      }
    } else {
      this.overlay.trackedElement = null;
      this.hideTrackedOverlay();
    }

    if (this.overlay.cleanupTimer) {
      window.clearTimeout(this.overlay.cleanupTimer);
    }
    const ttl = typeof durationMs === 'number' ? durationMs : 2400;
    this.overlay.cleanupTimer = window.setTimeout(() => this.clearActionOverlay(), ttl);
  }

  updateOverlayPosition() {
    if (this.overlay.trackingStartedAt && Date.now() - this.overlay.trackingStartedAt > OVERLAY_MAX_TRACK_MS) {
      this.reportOverlayPerfEvent('max_tracking_window_exceeded', { maxTrackMs: OVERLAY_MAX_TRACK_MS });
      this.clearActionOverlay();
      return;
    }

    const { trackedElement: element, target, label } = this.overlay;
    if (!element || !target || !label) return;
    if (!element.isConnected || !document.documentElement.contains(element)) {
      this.clearActionOverlay();
      return;
    }
    if (document.hidden) {
      this.hideTrackedOverlay();
      return;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      this.hideTrackedOverlay();
      return;
    }

    target.style.opacity = '1';
    target.style.top = `${rect.top - 4}px`;
    target.style.left = `${rect.left - 4}px`;
    target.style.width = `${rect.width + 8}px`;
    target.style.height = `${rect.height + 8}px`;

    label.style.opacity = '1';
    const labelTop = rect.top - 28;
    const labelLeft = Math.min(window.innerWidth - 280, Math.max(12, rect.left));
    label.style.top = `${labelTop < 10 ? rect.bottom + 8 : labelTop}px`;
    label.style.left = `${labelLeft}px`;
    label.textContent =
      element.getAttribute('aria-label') || element.getAttribute('name') || element.tagName.toLowerCase();
  }

  private isElementInViewport(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }
}
