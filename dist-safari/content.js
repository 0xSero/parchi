"use strict";
(() => {
  // packages/extension/content.ts
  var ContentScriptHandler = class {
    highlightedElements;
    overlay;
    constructor() {
      this.highlightedElements = /* @__PURE__ */ new Set();
      this.overlay = {
        root: null,
        toast: null,
        target: null,
        label: null,
        styleEl: null,
        cleanupTimer: null,
        rafId: null,
        trackedElement: null
      };
      this.init();
    }
    init() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        void this.handleMessage(message, sender, sendResponse);
        return true;
      });
      this.notifyReady();
    }
    async handleMessage(message, _sender, sendResponse) {
      try {
        switch (message.action) {
          case "highlight_element":
            this.highlightElement(message.selector);
            sendResponse({ success: true });
            break;
          case "unhighlight_all":
            this.unhighlightAll();
            sendResponse({ success: true });
            break;
          case "action_overlay":
            this.showActionOverlay(message);
            sendResponse({ success: true });
            break;
          case "clear_action_overlay":
            this.clearActionOverlay();
            sendResponse({ success: true });
            break;
          case "get_element_info":
            const info = this.getElementInfo(message.selector);
            sendResponse({ success: true, info });
            break;
          default:
            sendResponse({ success: false, error: "Unknown action" });
        }
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
    notifyReady() {
      chrome.runtime.sendMessage({
        type: "content_script_ready",
        url: window.location.href
      }).catch(() => {
      });
    }
    highlightElement(selector) {
      const element = document.querySelector(selector);
      if (!element) return;
      const originalOutline = element.style.outline;
      const originalOutlineOffset = element.style.outlineOffset;
      element.style.outline = "3px solid #4f46e5";
      element.style.outlineOffset = "2px";
      this.highlightedElements.add({
        element,
        originalOutline,
        originalOutlineOffset
      });
      setTimeout(() => {
        element.style.outline = originalOutline;
        element.style.outlineOffset = originalOutlineOffset;
      }, 3e3);
    }
    unhighlightAll() {
      this.highlightedElements.forEach(({ element, originalOutline, originalOutlineOffset }) => {
        element.style.outline = originalOutline;
        element.style.outlineOffset = originalOutlineOffset;
      });
      this.highlightedElements.clear();
    }
    ensureOverlayRoot() {
      if (this.overlay.root) return;
      const styleEl = document.createElement("style");
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
      const root = document.createElement("div");
      root.id = "parchi-overlay-root";
      document.documentElement.appendChild(root);
      const toast = document.createElement("div");
      toast.className = "parchi-overlay-toast";
      toast.innerHTML = '<span class="parchi-overlay-dot"></span><span class="parchi-overlay-text"></span>';
      root.appendChild(toast);
      const target = document.createElement("div");
      target.className = "parchi-overlay-target";
      root.appendChild(target);
      const label = document.createElement("div");
      label.className = "parchi-overlay-label";
      root.appendChild(label);
      this.overlay = {
        ...this.overlay,
        root,
        toast,
        target,
        label,
        styleEl
      };
    }
    clearActionOverlay() {
      if (this.overlay.cleanupTimer) {
        window.clearTimeout(this.overlay.cleanupTimer);
        this.overlay.cleanupTimer = null;
      }
      if (this.overlay.rafId) {
        window.cancelAnimationFrame(this.overlay.rafId);
        this.overlay.rafId = null;
      }
      if (this.overlay.toast) this.overlay.toast.style.opacity = "0";
      if (this.overlay.target) this.overlay.target.style.opacity = "0";
      if (this.overlay.label) this.overlay.label.style.opacity = "0";
      this.overlay.trackedElement = null;
    }
    showActionOverlay(payload) {
      const { label: overlayLabel, selector, note, status, durationMs, bringIntoView } = payload || {};
      this.ensureOverlayRoot();
      const toast = this.overlay.toast;
      const label = this.overlay.label;
      const target = this.overlay.target;
      const actionLabel = [overlayLabel, note].filter(Boolean).join(" \xB7 ");
      if (toast) {
        const textEl = toast.querySelector(".parchi-overlay-text");
        if (textEl) textEl.textContent = actionLabel || "Working\u2026";
        toast.style.opacity = "1";
        toast.dataset.status = status || "running";
      }
      if (selector) {
        const element = document.querySelector(selector);
        if (element) {
          if (bringIntoView && !this.isElementInViewport(element)) {
            element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
          }
          this.overlay.trackedElement = element;
          this.updateOverlayPosition();
        } else {
          this.overlay.trackedElement = null;
          if (target) target.style.opacity = "0";
          if (label) label.style.opacity = "0";
        }
      } else {
        this.overlay.trackedElement = null;
        if (target) target.style.opacity = "0";
        if (label) label.style.opacity = "0";
      }
      if (this.overlay.cleanupTimer) {
        window.clearTimeout(this.overlay.cleanupTimer);
      }
      const ttl = typeof durationMs === "number" ? durationMs : 2400;
      this.overlay.cleanupTimer = window.setTimeout(() => this.clearActionOverlay(), ttl);
    }
    updateOverlayPosition() {
      const element = this.overlay.trackedElement;
      const target = this.overlay.target;
      const label = this.overlay.label;
      if (!element || !target || !label) return;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        target.style.opacity = "0";
        label.style.opacity = "0";
        return;
      }
      target.style.opacity = "1";
      target.style.top = `${rect.top - 4}px`;
      target.style.left = `${rect.left - 4}px`;
      target.style.width = `${rect.width + 8}px`;
      target.style.height = `${rect.height + 8}px`;
      label.style.opacity = "1";
      const labelTop = rect.top - 28;
      const labelLeft = Math.min(window.innerWidth - 280, Math.max(12, rect.left));
      label.style.top = `${labelTop < 10 ? rect.bottom + 8 : labelTop}px`;
      label.style.left = `${labelLeft}px`;
      label.textContent = element.getAttribute("aria-label") || element.getAttribute("name") || element.tagName.toLowerCase();
      if (this.overlay.rafId) {
        window.cancelAnimationFrame(this.overlay.rafId);
      }
      this.overlay.rafId = window.requestAnimationFrame(() => this.updateOverlayPosition());
    }
    isElementInViewport(element) {
      const rect = element.getBoundingClientRect();
      return rect.top >= 0 && rect.left >= 0 && rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && rect.right <= (window.innerWidth || document.documentElement.clientWidth);
    }
    getElementInfo(selector) {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const typedElement = element;
      return {
        tagName: element.tagName,
        id: element.id,
        className: element.className,
        textContent: element.textContent?.substring(0, 200),
        value: typedElement.value,
        type: typedElement.type,
        position: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        },
        visible: this.isElementVisible(element),
        attributes: Array.from(element.attributes).reduce((acc, attr) => {
          acc[attr.name] = attr.value;
          return acc;
        }, {})
      };
    }
    isElementVisible(element) {
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0" && element.offsetParent !== null;
    }
  };
  new ContentScriptHandler();
})();
//# sourceMappingURL=content.js.map
