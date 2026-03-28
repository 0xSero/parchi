// On-demand content script for recording user interactions.
// Injected via chrome.scripting.executeScript, NOT in the manifest.

import type { RecordingEvent, RecordingEventType } from '@parchi/shared';

declare global {
  interface Window {
    __parchiRecording?: boolean;
    __parchiRecordingCleanup?: () => void;
  }
}

(() => {
  if (window.__parchiRecording) return;
  window.__parchiRecording = true;

  const OVERLAY_ROOT_ID = 'parchi-overlay-root';
  const SCROLL_THROTTLE_MS = 1000;
  const SCROLL_DELTA_MIN = 200;
  const MUTATION_DEBOUNCE_MS = 500;
  const MAX_RECORDING_RUNTIME_MS = 75_000;
  const MAX_MUTATION_BATCH_ITEMS = 5000;

  let lastScrollY = window.scrollY;
  let lastScrollTime = 0;
  let mutationBatchTimer: ReturnType<typeof setTimeout> | null = null;
  let hardStopTimer: ReturnType<typeof setTimeout> | null = null;
  let isCleaningUp = false;
  let droppedMutationEvents = 0;
  let mutationBatch = { added: 0, removed: 0, attributes: 0, target: '' };

  const isInsideOverlay = (el: Element | null): boolean => {
    if (!el) return false;
    return !!el.closest(`#${OVERLAY_ROOT_ID}`);
  };

  const getSelector = (el: Element): string => {
    if (el.id) return `#${el.id}`;
    const tag = el.tagName.toLowerCase();
    const cls = Array.from(el.classList).slice(0, 2).join('.');
    return cls ? `${tag}.${cls}` : tag;
  };

  const sendMessageSafely = (payload: Record<string, unknown>) => {
    try {
      const maybePromise = chrome.runtime.sendMessage(payload);
      if (maybePromise && typeof (maybePromise as Promise<unknown>).catch === 'function') {
        void (maybePromise as Promise<unknown>).catch((error: unknown) => {
          console.warn('[ContentRecording] Failed to send runtime message:', error);
        });
      }
    } catch {
      // Extension context may be invalidated
    }
  };

  const sendEvent = (event: RecordingEvent) => {
    sendMessageSafely({ type: 'recording_event', event });
  };

  const sendPerfEvent = (reason: string, payload: Record<string, unknown> = {}) => {
    sendMessageSafely({
      type: 'content_perf_event',
      event: {
        source: 'recording',
        reason,
        ts: Date.now(),
        url: location.href,
        ...payload,
      },
    });
  };

  const buildBase = (type: RecordingEventType): RecordingEvent => ({
    type,
    timestamp: Date.now(),
    url: location.href,
  });

  // --- Click handler ---
  const onClickCapture = (e: MouseEvent) => {
    const target = e.target as Element | null;
    if (!target || isInsideOverlay(target)) return;
    const ev = buildBase('click');
    ev.selector = getSelector(target);
    ev.tagName = target.tagName.toLowerCase();
    ev.textContent = (target.textContent || '').trim().slice(0, 100);
    ev.position = { x: Math.round(e.clientX), y: Math.round(e.clientY) };
    sendEvent(ev);
  };

  // --- Scroll handler (throttled) ---
  const onScroll = () => {
    const now = Date.now();
    if (now - lastScrollTime < SCROLL_THROTTLE_MS) return;
    const currentY = window.scrollY;
    const delta = currentY - lastScrollY;
    if (Math.abs(delta) < SCROLL_DELTA_MIN) return;
    lastScrollTime = now;
    const ev = buildBase('scroll');
    ev.scrollY = Math.round(currentY);
    ev.direction = delta > 0 ? 'down' : 'up';
    lastScrollY = currentY;
    sendEvent(ev);
  };

  // --- Input handler ---
  const onInputCapture = (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | null;
    if (!target || isInsideOverlay(target)) return;
    const ev = buildBase('input');
    ev.selector = getSelector(target);
    ev.tagName = target.tagName.toLowerCase();
    ev.inputType = (target as HTMLInputElement).type || 'text';
    ev.placeholder = (target.placeholder || '').slice(0, 100);
    // Never capture input values for privacy
    sendEvent(ev);
  };

  // --- Mutation observer (debounced batching) ---
  const flushMutations = () => {
    if (mutationBatch.added === 0 && mutationBatch.removed === 0 && mutationBatch.attributes === 0) return;
    const ev = buildBase('dom_mutation');
    const droppedSuffix = droppedMutationEvents > 0 ? ` (+${droppedMutationEvents} dropped due to cap)` : '';
    ev.summary = `+${mutationBatch.added} nodes, -${mutationBatch.removed} nodes, ${mutationBatch.attributes} attr changes in ${mutationBatch.target}${droppedSuffix}`;
    ev.addedCount = mutationBatch.added;
    ev.removedCount = mutationBatch.removed;
    ev.attributeChanges = mutationBatch.attributes;
    sendEvent(ev);
    droppedMutationEvents = 0;
    mutationBatch = { added: 0, removed: 0, attributes: 0, target: '' };
  };

  const observer = new MutationObserver((mutations) => {
    if (isCleaningUp || document.hidden) return;
    for (const m of mutations) {
      if (isInsideOverlay(m.target as Element)) continue;
      if (m.type === 'childList') {
        mutationBatch.added += m.addedNodes.length;
        mutationBatch.removed += m.removedNodes.length;
      } else if (m.type === 'attributes') {
        mutationBatch.attributes += 1;
      }
      if (!mutationBatch.target && m.target instanceof Element) {
        mutationBatch.target = getSelector(m.target);
      }

      if (mutationBatch.added + mutationBatch.removed + mutationBatch.attributes > MAX_MUTATION_BATCH_ITEMS) {
        droppedMutationEvents += 1;
        break;
      }
    }
    if (mutationBatchTimer) clearTimeout(mutationBatchTimer);
    mutationBatchTimer = setTimeout(flushMutations, MUTATION_DEBOUNCE_MS);
  });

  const mutationRoot = document.body || document.documentElement;
  if (mutationRoot) {
    observer.observe(mutationRoot, {
      childList: true,
      subtree: true,
    });
  } else {
    sendPerfEvent('mutation_root_missing');
  }

  // --- SPA navigation detection ---
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  const onNavigation = (fromUrl: string, toUrl: string, trigger: string) => {
    if (fromUrl === toUrl) return;
    const ev = buildBase('navigation');
    ev.fromUrl = fromUrl;
    ev.toUrl = toUrl;
    ev.trigger = trigger;
    sendEvent(ev);
  };

  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    const from = location.href;
    originalPushState.apply(this, args);
    onNavigation(from, location.href, 'pushState');
  };

  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    const from = location.href;
    originalReplaceState.apply(this, args);
    onNavigation(from, location.href, 'replaceState');
  };

  const onPopState = () => {
    onNavigation('', location.href, 'popstate');
  };

  // --- Register listeners ---
  document.addEventListener('click', onClickCapture, { capture: true });
  document.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('input', onInputCapture, { capture: true });
  window.addEventListener('popstate', onPopState);

  // --- Listen for stop command ---
  const onMessage = (message: unknown) => {
    const row = message && typeof message === 'object' ? (message as Record<string, unknown>) : null;
    if (row?.type === 'recording_content_stop') {
      cleanup('stop_message');
    }
  };
  chrome.runtime.onMessage.addListener(onMessage);

  // --- Cleanup ---
  const cleanup = (reason = 'manual') => {
    if (isCleaningUp) return;
    isCleaningUp = true;
    document.removeEventListener('click', onClickCapture, { capture: true } as EventListenerOptions);
    document.removeEventListener('scroll', onScroll);
    document.removeEventListener('input', onInputCapture, { capture: true } as EventListenerOptions);
    window.removeEventListener('popstate', onPopState);
    window.removeEventListener('pagehide', onPageHide);
    chrome.runtime.onMessage.removeListener(onMessage);
    observer.disconnect();
    if (hardStopTimer) {
      clearTimeout(hardStopTimer);
      hardStopTimer = null;
    }
    if (mutationBatchTimer) {
      clearTimeout(mutationBatchTimer);
      mutationBatchTimer = null;
      flushMutations();
    }
    if (reason === 'max_runtime') {
      sendPerfEvent('auto_stop_after_runtime_cap', {
        maxRuntimeMs: MAX_RECORDING_RUNTIME_MS,
      });
    }
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    window.__parchiRecording = false;
    window.__parchiRecordingCleanup = undefined;
  };

  const onPageHide = () => cleanup('pagehide');

  window.addEventListener('pagehide', onPageHide);
  hardStopTimer = setTimeout(() => cleanup('max_runtime'), MAX_RECORDING_RUNTIME_MS);
  window.__parchiRecordingCleanup = cleanup;
})();
