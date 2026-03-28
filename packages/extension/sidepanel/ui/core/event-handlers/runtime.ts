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

  // Keep relay connection status fresh while Settings is open.
  const onStorageChangedListener = (changes: Record<string, { newValue?: unknown }>, areaName: string) => {
    if (areaName !== 'local') return;
    if (!changes.relayConnected && !changes.relayLastError) return;
    const next: Record<string, unknown> = {};
    if (changes.relayConnected) next.relayConnected = changes.relayConnected.newValue;
    if (changes.relayLastError) next.relayLastError = changes.relayLastError.newValue;
    this.updateRelayStatusFromSettings?.(next);
  };
  chrome.storage.onChanged.addListener(onStorageChangedListener);

  // Store references for cleanup
  this._runtimeMessageListener = onMessageListener;
  this._storageChangedListener = onStorageChangedListener;
};

export const cleanupRuntimeListeners = function cleanupRuntimeListeners(this: SidePanelUI & Record<string, unknown>) {
  if (this._runtimeMessageListener) {
    chrome.runtime.onMessage.removeListener(this._runtimeMessageListener);
    this._runtimeMessageListener = null;
  }
  if (this._storageChangedListener) {
    chrome.storage.onChanged.removeListener(this._storageChangedListener);
    this._storageChangedListener = null;
  }
};

sidePanelProto.setupRuntimeListeners = setupRuntimeListeners;
sidePanelProto.cleanupRuntimeListeners = cleanupRuntimeListeners;
