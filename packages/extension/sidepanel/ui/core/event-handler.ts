/**
 * Event Handler Module
 * Main entry point that imports and registers all event handlers
 */

import { SidePanelUI } from './panel-ui.js';

// Import sub-modules (each registers methods on SidePanelUI.prototype)
import './event-handler-navigation.js';
import './event-handler-composer.js';
import './event-handler-settings.js';
import './event-handler-profile.js';
import './event-handler-ui.js';
import './event-handler-runtime.js';

const sidePanelProto = (SidePanelUI as any).prototype as SidePanelUI & Record<string, unknown>;

/**
 * Set up all event listeners for the sidepanel
 * Delegates to specialized handler modules
 */
export const setupEventListeners = function setupEventListeners(this: SidePanelUI & Record<string, unknown>) {
  this.setupNavigationListeners();
  this.setupComposerListeners();
  this.setupSettingsListeners();
  this.setupProfileListeners();
  this.setupUIListeners();
  this.setupRuntimeListeners();
};

sidePanelProto.setupEventListeners = setupEventListeners;
