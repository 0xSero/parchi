import { createMessage } from '../../../ai/message-schema.js';
import { getActiveTab } from '../../../utils/active-tab.js';
import { clampContextHistory } from '../core/panel-session-memory.js';
import { SidePanelUI } from '../core/panel-ui.js';
import { MAX_DISPLAY_HISTORY, sanitizeForMessaging, sendRuntimeMessageWithRetry } from './chat-utils.js';
import { appendTrace } from './trace-store.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.requestManualContextCompaction = async function requestManualContextCompaction() {
  if (this.elements.composer?.classList.contains('running')) {
    this.updateStatus('Finish the active run before compacting.', 'warning');
    return;
  }
  if (this.contextCompactionState?.inProgress) {
    return;
  }

  this.setContextCompactionState?.({
    inProgress: true,
    lastResult: null,
    lastRequestedAt: Date.now(),
    lastTrigger: 'manual',
    lastMessage: null,
  });
  this.updateStatus('Compacting context…', 'active');

  try {
    const response = await sendRuntimeMessageWithRetry({
      type: 'compact_context',
      sessionId: this.sessionId,
      conversationHistory: this.getSendableContextHistory?.(),
      trigger: 'manual',
    });
    if (!response?.accepted) {
      throw new Error(response?.error || 'Compaction request was not accepted');
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? 'Compaction request failed');
    this.setContextCompactionState?.({
      inProgress: false,
      lastResult: 'error',
      lastMessage: message,
      lastCompletedAt: Date.now(),
    });
    this.updateStatus(`Compaction failed: ${message}`, 'error');
  }
};

sidePanelProto.sendMessage = async function sendMessage() {
  if (this.activeAgent && this.activeAgent !== 'main') {
    this.updateStatus('Switch back to the orchestrator tab to send a new message.', 'warning');
    return;
  }
  const userMessage = this.elements.userInput.value.trim();
  if (!userMessage) return;

  this.pendingTurnDraft = { userMessage, startedAt: Date.now() };

  // Persist user message trace to IndexedDB
  appendTrace({
    sessionId: this.sessionId,
    ts: Date.now(),
    kind: 'user_message',
    content: userMessage,
  });

  this.elements.userInput.value = '';
  this.elements.userInput.style.height = '';
  if (!this.firstUserMessage) {
    this.firstUserMessage = userMessage;
  }

  this.pendingToolCount = 0;
  this.isStreaming = false;
  this.streamingState = null;
  this.stepTimeline.steps.clear();
  this.stepTimeline.activeStepIndex = null;
  this.stepTimeline.activeStepBody = null;
  this.activeToolName = null;
  this.latestThinking = null;
  this.clearRunIncompleteBanner();
  this.updateActivityState();

  let selectedTabsPayload = Array.from(this.selectedTabs.values());
  let tabsContext = this.getSelectedTabsContext(selectedTabsPayload);

  if (selectedTabsPayload.length === 0) {
    try {
      const activeTab = await getActiveTab();
      if (activeTab && typeof activeTab.id === 'number') {
        const autoTab = this.buildSelectedTab(activeTab);
        selectedTabsPayload = [autoTab];
        tabsContext = this.getSelectedTabsContext(selectedTabsPayload, 'active');
      }
    } catch (error) {
      console.warn('Failed to capture active tab context:', error);
    }
  }

  const fullMessage = userMessage + tabsContext;
  const recordedContextForMessage = this.pendingRecordedContext
    ? {
        id: this.pendingRecordedContext.id,
        duration: this.pendingRecordedContext.duration,
        summary: this.pendingRecordedContext.summary,
        events: Array.isArray(this.pendingRecordedContext.events) ? this.pendingRecordedContext.events : [],
        selectedImages: Array.isArray(this.pendingRecordedContext.selectedImages)
          ? this.pendingRecordedContext.selectedImages.map((img: unknown) => {
              const entry = img as { index?: unknown; timestamp?: unknown; url?: unknown };
              return {
                index: Number(entry?.index ?? 0),
                timestamp: Number(entry?.timestamp ?? 0),
                url: String(entry?.url ?? ''),
              };
            })
          : [],
      }
    : null;
  const mediaAttachmentsForMessage = Array.isArray(this.pendingComposerAttachments)
    ? [...this.pendingComposerAttachments]
    : [];

  this.displayUserMessage(userMessage, recordedContextForMessage, mediaAttachmentsForMessage);

  const displayEntry = createMessage({ role: 'user', content: userMessage });
  if (displayEntry) {
    this.displayHistory.push(displayEntry);
    if (this.displayHistory.length > MAX_DISPLAY_HISTORY) {
      this.displayHistory.splice(0, this.displayHistory.length - MAX_DISPLAY_HISTORY);
    }
  }

  const contextEntry = createMessage({ role: 'user', content: fullMessage });
  if (contextEntry) {
    this.contextHistory.push(contextEntry);
    clampContextHistory(this.contextHistory);
  }
  this.updateContextUsage();

  this.updateStatus('Processing...', 'active');
  this.elements.composer?.classList.add('running');
  this.startRunTimer?.();
  this.startWatchdog?.();

  try {
    // Avoid sending huge tool payloads; also ensures errors are caught (promise-based APIs).
    const sendableHistory = this.getSendableContextHistory?.() || sanitizeForMessaging(this.contextHistory || []);
    const payload: Record<string, unknown> = {
      type: 'user_message',
      message: fullMessage,
      conversationHistory: sendableHistory,
      selectedTabs: selectedTabsPayload,
      sessionId: this.sessionId,
    };
    if (this.pendingRecordedContext) {
      payload.recordedContext = this.pendingRecordedContext;
      this.pendingRecordedContext = null;
      this.hideRecordedContextBadge?.();
    }
    if (mediaAttachmentsForMessage.length > 0) {
      payload.attachments = mediaAttachmentsForMessage;
      this.pendingComposerAttachments = [];
    }
    const response = await sendRuntimeMessageWithRetry(payload);
    if (response?.sessionId && typeof response.sessionId === 'string') {
      this.sessionId = response.sessionId;
    }
    // Note: persistHistory is called after the assistant response completes
    // in displayAssistantMessage to ensure complete conversation is saved
  } catch (error: unknown) {
    this.stopThinkingTimer?.();
    this.stopRunTimer?.();
    this.stopWatchdog?.();
    this.pendingTurnDraft = null;
    this.pendingRecordedContext = null;
    this.hideRecordedContextBadge?.();
    const message = error instanceof Error ? error.message : String(error ?? '');
    this.updateStatus('Error: ' + message, 'error');
    this.elements.composer?.classList.remove('running');
    this.displayAssistantMessage('Sorry, an error occurred: ' + message);
  }
};
