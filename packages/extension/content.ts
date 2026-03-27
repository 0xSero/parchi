// Content Script - Runs in the context of web pages
// This script can access the DOM and communicate with the background script

import { ActionOverlayController } from './content-action-overlay.js';
import { getElementInfo } from './content-element-inspection.js';
import { highlightElement, unhighlightAll } from './content-highlight.js';
import { SubagentBadgeController } from './content-subagent-badge.js';
import type { HighlightEntry } from './content-types.js';

class ContentScriptHandler {
  highlightedElements: Set<HighlightEntry>;
  overlayController: ActionOverlayController;
  subagentBadgeController: SubagentBadgeController;
  private messageListener: (
    message: Record<string, unknown>,
    sender: unknown,
    sendResponse: (response: unknown) => void,
  ) => boolean;

  constructor() {
    this.highlightedElements = new Set();
    this.overlayController = new ActionOverlayController();
    this.subagentBadgeController = new SubagentBadgeController();
    this.messageListener = (message, sender, sendResponse) => {
      void this.handleMessage(message, sender, sendResponse).catch((err) => {
        console.warn('[content] Message handling failed:', err);
      });
      return true;
    };
    this.init();
  }

  init() {
    chrome.runtime.onMessage.addListener(this.messageListener);
    this.notifyReady();
  }

  destroy() {
    chrome.runtime.onMessage.removeListener(this.messageListener);
    this.overlayController.clearActionOverlay();
    this.subagentBadgeController.clearBadge();
    unhighlightAll(this.highlightedElements);
  }

  async handleMessage(message: Record<string, unknown>, _sender: unknown, sendResponse: (response: unknown) => void) {
    try {
      switch (message.action) {
        case 'highlight_element':
          highlightElement(this.highlightedElements, String(message.selector || ''));
          sendResponse({ success: true });
          break;
        case 'unhighlight_all':
          unhighlightAll(this.highlightedElements);
          sendResponse({ success: true });
          break;
        case 'action_overlay':
          this.overlayController.showActionOverlay(message);
          sendResponse({ success: true });
          break;
        case 'clear_action_overlay':
          this.overlayController.clearActionOverlay();
          sendResponse({ success: true });
          break;
        case 'show_subagent_badge':
          this.subagentBadgeController.showBadge(message);
          sendResponse({ success: true });
          break;
        case 'clear_subagent_badge':
          this.subagentBadgeController.clearBadge();
          sendResponse({ success: true });
          break;
        case 'get_element_info': {
          const info = getElementInfo(String(message.selector || ''));
          sendResponse({ success: true, info });
          break;
        }
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error || 'Unknown content script error'),
      });
    }
  }

  notifyReady() {
    chrome.runtime
      .sendMessage({
        type: 'content_script_ready',
        url: window.location.href,
      })
      .catch(() => {
        // Extension context may not be ready yet
      });
  }
}

new ContentScriptHandler();
