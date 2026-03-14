/**
 * Event Handler - Composer Module
 * Composer input area event handlers
 */

import { autoResizeTextArea } from '../dom-utils.js';
import { SidePanelUI } from '../panel-ui.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

const extractFilesFromClipboardEvent = (event: ClipboardEvent): File[] => {
  const clipboardData = event.clipboardData;
  if (!clipboardData) return [];
  const directFiles = Array.from(clipboardData.files || []).filter((file): file is File => file instanceof File);
  if (directFiles.length) return directFiles;

  return Array.from(clipboardData.items || [])
    .filter((item) => item.kind === 'file')
    .map((item, index) => {
      const file = item.getAsFile();
      if (!file) return null;
      if (file.name) return file;
      const extension = file.type?.split('/')[1] || 'bin';
      return new File([file], `pasted-${index + 1}.${extension}`, { type: file.type || 'application/octet-stream' });
    })
    .filter((file): file is File => file instanceof File);
};

/**
 * Set up composer-related event listeners
 */
export const setupComposerListeners = function setupComposerListeners(this: SidePanelUI & Record<string, unknown>) {
  // Composer tool buttons — direct click handlers with active state
  const setToolActive = (btn: HTMLButtonElement | null, active: boolean) => {
    btn?.classList.toggle('active', active);
  };

  this.elements.composerActionAttachFile?.addEventListener('click', () => {
    setToolActive(this.elements.composerActionAttachFile, true);
    this.elements.fileInput?.click();
    setTimeout(() => setToolActive(this.elements.composerActionAttachFile, false), 200);
  });
  this.elements.composerActionRecordContext?.addEventListener('click', () => {
    setToolActive(this.elements.composerActionRecordContext, true);
    const recordButton = this.elements.recordBtn as HTMLButtonElement | null;
    if (recordButton === this.elements.composerActionRecordContext) {
      if (this.recordingState.status === 'idle') {
        this.startRecording();
      } else if (this.recordingState.status === 'recording') {
        this.stopRecording();
      }
    } else {
      recordButton?.click();
    }
    setTimeout(() => setToolActive(this.elements.composerActionRecordContext, false), 200);
  });
  this.elements.composerActionSelectTabs?.addEventListener('click', () => {
    setToolActive(this.elements.composerActionSelectTabs, true);
    this.toggleTabSelector();
    setTimeout(() => setToolActive(this.elements.composerActionSelectTabs, false), 200);
  });
  this.elements.composerActionExport?.addEventListener('click', () => {
    setToolActive(this.elements.composerActionExport, true);
    this.showExportMenu();
    setTimeout(() => setToolActive(this.elements.composerActionExport, false), 200);
  });

  // Send button handler
  this.elements.sendBtn?.addEventListener('click', () => handleSendButtonClick.call(this));

  // Enter to send (Shift+Enter for newline), workflow menu gets priority
  this.elements.userInput?.addEventListener('keydown', (event: KeyboardEvent) => {
    if (this.workflowMenuOpen && this.handleWorkflowKeydown(event)) {
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendButtonClick.call(this);
    }
  });

  this.elements.userInput?.addEventListener('paste', (event: ClipboardEvent) => {
    const files = extractFilesFromClipboardEvent(event);
    if (!files.length) return;
    event.preventDefault();
    void this.ingestFilesIntoComposer?.(files, 'paste');
  });

  // Auto-expand textarea height as user types
  const userInput = this.elements.userInput;
  userInput?.addEventListener('input', () => {
    autoResizeTextArea(userInput, 280);
    this.handleWorkflowInput();
  });
  this.elements.systemPrompt?.addEventListener('input', () => {
    autoResizeTextArea(this.elements.systemPrompt, 500, 500);
  });
  this.elements.profileEditorPrompt?.addEventListener('input', () => {
    autoResizeTextArea(this.elements.profileEditorPrompt, 500);
  });
  autoResizeTextArea(userInput, 280);
  autoResizeTextArea(this.elements.systemPrompt, 500, 500);
  autoResizeTextArea(this.elements.profileEditorPrompt, 500);

  // Recording
  if (this.elements.recordBtn && this.elements.recordBtn !== this.elements.composerActionRecordContext) {
    this.elements.recordBtn.addEventListener('click', () => {
      if (this.recordingState.status === 'idle') {
        this.startRecording();
      } else if (this.recordingState.status === 'recording') {
        this.stopRecording();
      }
    });
  }
  this.elements.recordedContextRemove?.addEventListener('click', () => {
    this.removeRecordedContext();
  });

  // Export button
  this.elements.exportBtn?.addEventListener('click', () => this.showExportMenu());
};

sidePanelProto.setupComposerListeners = setupComposerListeners;

/**
 * Handle send button click - can queue, stop, or send message depending on state
 */
function handleSendButtonClick(this: SidePanelUI & Record<string, unknown>) {
  const isRunning = this.elements.composer?.classList.contains('running');
  const hasText = this.elements.userInput?.value.trim();

  if (isRunning && hasText) {
    // Queue the message — it will send after the current turn completes
    this.queuedMessage = this.elements.userInput.value.trim();
    this.elements.userInput.value = '';
    this.elements.userInput.style.height = '';
    this.updateStatus('Message queued', 'active');
  } else if (isRunning) {
    // No text — stop the run
    this.requestRunStop('Stopped by user');
    this.stopWatchdog?.();
    this.stopThinkingTimer?.();
    this.stopRunTimer?.();
    this.elements.composer?.classList.remove('running');
    this.pendingTurnDraft = null;
    this.pendingRecordedContext = null;
    this.hideRecordedContextBadge?.();
    this.pendingToolCount = 0;
    this.isStreaming = false;
    this.activeToolName = null;
    this.queuedMessage = null;
    this.updateActivityState();
    this.finishStreamingMessage();
    this.clearErrorBanner?.();
    this.insertStoppedDivider();
    this.updateStatus('Stopped', 'warning');
  } else {
    this.sendMessage();
  }
}
