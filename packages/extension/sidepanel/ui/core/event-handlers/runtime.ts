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
  chrome.runtime.onMessage.addListener((message) => {
    if (isRuntimeMessage(message)) {
      this.handleRuntimeMessage(message);
      return;
    }
    // Recording messages (not runtime messages — they have their own schema)
    const recordingTypes = ['recording_tick', 'recording_complete', 'recording_context_ready', 'recording_error'];
    if (message?.type && recordingTypes.includes(message.type)) {
      this.handleRecordingMessage?.(message);
    }
  });

  // Keep relay connection status fresh while Settings is open.
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (!changes.relayConnected && !changes.relayLastError) return;
    const next: Record<string, any> = {};
    if (changes.relayConnected) next.relayConnected = changes.relayConnected.newValue;
    if (changes.relayLastError) next.relayLastError = changes.relayLastError.newValue;
    this.updateRelayStatusFromSettings?.(next);
  });
};

sidePanelProto.setupRuntimeListeners = setupRuntimeListeners;
