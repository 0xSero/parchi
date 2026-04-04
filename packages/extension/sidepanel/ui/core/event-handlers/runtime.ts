/**
 * Event Handler - Runtime Module
 * Runtime message and storage change listeners
 */

import { isRuntimeMessage } from '@parchi/shared';
import { SidePanelUI } from '../panel-ui.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Set up runtime message and storage listeners
 */
export const setupRuntimeListeners = function setupRuntimeListeners(this: SidePanelUI & Record<string, unknown>) {
  // Listen for messages from background
  const onMessageListener = (message: unknown) => {
    if (isRuntimeMessage(message)) {
      this.handleRuntimeMessage(message);
      return;
    }
    // Recording messages (not runtime messages — they have their own schema)
    const recordingTypes = ['recording_tick', 'recording_complete', 'recording_context_ready', 'recording_error'];
    const row = message && typeof message === 'object' ? (message as Record<string, unknown>) : null;
    if (row?.type && recordingTypes.includes(row.type as string)) {
      this.handleRecordingMessage?.(row);
    }
  };
  chrome.runtime.onMessage.addListener(onMessageListener);

  // Store references for cleanup
  this._runtimeMessageListener = onMessageListener;
};

export const cleanupRuntimeListeners = function cleanupRuntimeListeners(this: SidePanelUI & Record<string, unknown>) {
  if (this._runtimeMessageListener) {
    chrome.runtime.onMessage.removeListener(this._runtimeMessageListener);
    this._runtimeMessageListener = null;
  }
};

sidePanelProto.setupRuntimeListeners = setupRuntimeListeners;
sidePanelProto.cleanupRuntimeListeners = cleanupRuntimeListeners;
