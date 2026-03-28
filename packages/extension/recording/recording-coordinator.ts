import type { RecordedContext, RecordingEvent, RecordingScreenshot, RecordingState } from '@parchi/shared';
import {
  MAX_DURATION_MS,
  MAX_SCREENSHOTS,
  SCREENSHOT_INTERVAL_MS,
  isRestrictedRecordingUrl,
  shouldSkipInlineRecordingEvent,
} from './recording-rules.js';
import {
  buildRecordingUrlTimeline,
  deduplicateRecordingEvents,
  generateRecordingSummary,
} from './recording-summary.js';

export class RecordingCoordinator {
  state: RecordingState | null = null;
  screenshotBuffer: RecordingScreenshot[] = [];
  eventBuffer: RecordingEvent[] = [];
  private screenshotTimer: ReturnType<typeof setInterval> | null = null;
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private tabUpdateListener: ((tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => void) | null = null;
  private tabRemovedListener: ((tabId: number) => void) | null = null;

  async startRecording(tabId?: number): Promise<void> {
    if (this.state?.status === 'recording') {
      throw new Error('Already recording');
    }

    let resolvedTabId = tabId;
    if (!resolvedTabId) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab?.id) throw new Error('No active tab found');
      resolvedTabId = activeTab.id;
    }

    const tab = await chrome.tabs.get(resolvedTabId);
    if (isRestrictedRecordingUrl(tab.url)) {
      throw new Error('Cannot record on this page (restricted URL)');
    }

    this.screenshotBuffer = [];
    this.eventBuffer = [];
    this.state = {
      status: 'recording',
      tabId: resolvedTabId,
      startedAt: Date.now(),
      elapsedMs: 0,
      screenshotCount: 0,
      eventCount: 0,
    };

    await this.injectContentScript(resolvedTabId);
    await this.captureScreenshot();

    this.screenshotTimer = setInterval(async () => {
      if (this.screenshotBuffer.length >= MAX_SCREENSHOTS) {
        await this.stopRecording();
        return;
      }
      await this.captureScreenshot();
    }, SCREENSHOT_INTERVAL_MS);

    this.tickTimer = setInterval(() => {
      if (!this.state) return;
      this.state.elapsedMs = Date.now() - this.state.startedAt;
      this.sendToSidePanel({
        type: 'recording_tick',
        elapsedMs: this.state.elapsedMs,
        screenshotCount: this.state.screenshotCount,
        eventCount: this.state.eventCount,
      });
    }, 1000);

    this.maxDurationTimer = setTimeout(() => {
      void this.stopRecording().catch((err) => {
        console.warn('[RecordingCoordinator] Max duration stop failed:', err);
      });
    }, MAX_DURATION_MS);
    this.registerTabListeners();
  }

  async stopRecording(): Promise<void> {
    if (!this.state || this.state.status !== 'recording') return;

    this.state.status = 'selecting';
    this.state.elapsedMs = Date.now() - this.state.startedAt;
    this.clearTimers();
    this.removeTabListeners();

    if (this.state.tabId) {
      try {
        await chrome.tabs.sendMessage(this.state.tabId, { type: 'recording_content_stop' });
      } catch {
        // Tab may have been closed.
      }
      await this.forceCleanupContentScript(this.state.tabId);
    }

    this.sendToSidePanel({
      type: 'recording_complete',
      screenshots: this.screenshotBuffer,
      events: this.deduplicateEvents(),
    });
  }

  handleContentEvent(event: RecordingEvent): void {
    if (this.state?.status !== 'recording') return;
    const lastEvent = this.eventBuffer[this.eventBuffer.length - 1];
    if (shouldSkipInlineRecordingEvent(lastEvent, event)) return;

    this.eventBuffer.push(event);
    this.state.eventCount = this.eventBuffer.length;
  }

  async selectImages(selectedIds: string[]): Promise<RecordedContext> {
    if (!this.state) throw new Error('No active recording session');

    const selected = this.screenshotBuffer
      .filter((screenshot) => selectedIds.includes(screenshot.id))
      .map((screenshot) => ({
        dataUrl: screenshot.dataUrl,
        timestamp: screenshot.timestamp,
        url: screenshot.url,
        index: screenshot.index,
      }));

    const events = this.deduplicateEvents();
    const urlTimeline = this.buildUrlTimeline(events);
    const summary = this.generateSummary(events, urlTimeline, selected.length);
    const context: RecordedContext = {
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      duration: this.state.elapsedMs || 0,
      selectedImages: selected,
      events,
      urlTimeline,
      summary,
    };

    this.state = { ...this.state, status: 'ready' };
    this.sendToSidePanel({ type: 'recording_context_ready', context });
    return context;
  }

  discard(): void {
    const tabId = this.state?.tabId;
    this.clearTimers();
    this.removeTabListeners();
    this.screenshotBuffer = [];
    this.eventBuffer = [];
    this.state = null;
    if (typeof tabId === 'number') {
      void this.forceCleanupContentScript(tabId).catch((err) => {
        console.warn('[RecordingCoordinator] Force cleanup failed during discard:', err);
      });
    }
  }

  private async injectContentScript(tabId: number): Promise<void> {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-recording.js'],
      });
    } catch (error) {
      console.warn('[RecordingCoordinator] Failed to inject content script:', error);
    }
  }

  private async forceCleanupContentScript(tabId: number): Promise<void> {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          try {
            window.__parchiRecordingCleanup?.();
          } catch (cleanupErr) {
            console.warn('[recording] Cleanup script threw:', cleanupErr);
          }
        },
      });
    } catch {
      // Ignore if the tab is gone or script context is unavailable.
    }
  }

  private async captureScreenshot(): Promise<void> {
    if (!this.state || this.state.status !== 'recording') return;
    if (this.screenshotBuffer.length >= MAX_SCREENSHOTS) return;

    try {
      const tab = await chrome.tabs.get(this.state.tabId);
      if (!tab.windowId) return;

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'jpeg',
        quality: 50,
      });

      this.screenshotBuffer.push({
        id: `ss-${Date.now()}-${this.screenshotBuffer.length}`,
        timestamp: Date.now(),
        dataUrl,
        url: tab.url || '',
        index: this.screenshotBuffer.length,
      });
      this.state.screenshotCount = this.screenshotBuffer.length;
    } catch (error) {
      console.warn('[RecordingCoordinator] Screenshot capture failed:', error);
    }
  }

  private deduplicateEvents(): RecordingEvent[] {
    return deduplicateRecordingEvents(this.eventBuffer);
  }

  private buildUrlTimeline(events: RecordingEvent[]): Array<{ url: string; timestamp: number }> {
    return buildRecordingUrlTimeline(events);
  }

  private generateSummary(
    events: RecordingEvent[],
    urlTimeline: Array<{ url: string; timestamp: number }>,
    imageCount: number,
  ): string {
    return generateRecordingSummary(events, urlTimeline, imageCount);
  }

  private registerTabListeners(): void {
    this.tabUpdateListener = (changedTabId, changeInfo) => {
      if (changedTabId === this.state?.tabId && changeInfo.status === 'complete') {
        void this.injectContentScript(changedTabId).catch((error) => {
          console.warn('[RecordingCoordinator] Failed to reinject content script after tab update:', error);
        });
      }
    };
    chrome.tabs.onUpdated.addListener(this.tabUpdateListener);

    this.tabRemovedListener = (removedTabId) => {
      if (removedTabId === this.state?.tabId) {
        void this.stopRecording().catch((error) => {
          console.warn('[RecordingCoordinator] Failed to stop recording after tab removal:', error);
        });
      }
    };
    chrome.tabs.onRemoved.addListener(this.tabRemovedListener);
  }

  private sendToSidePanel(message: Record<string, unknown>): void {
    try {
      void chrome.runtime.sendMessage(message).catch(() => {
        // Sidepanel may not be open.
      });
    } catch {
      // Sidepanel may not be open.
    }
  }

  private clearTimers(): void {
    if (this.screenshotTimer) {
      clearInterval(this.screenshotTimer);
      this.screenshotTimer = null;
    }
    if (this.maxDurationTimer) {
      clearTimeout(this.maxDurationTimer);
      this.maxDurationTimer = null;
    }
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private removeTabListeners(): void {
    if (this.tabUpdateListener) {
      chrome.tabs.onUpdated.removeListener(this.tabUpdateListener);
      this.tabUpdateListener = null;
    }
    if (this.tabRemovedListener) {
      chrome.tabs.onRemoved.removeListener(this.tabRemovedListener);
      this.tabRemovedListener = null;
    }
  }
}
