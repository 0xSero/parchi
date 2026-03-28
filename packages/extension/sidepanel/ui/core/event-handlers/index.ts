/**
 * Event Handler Module
 * Main entry point that imports and registers all event handlers
 */

import { SidePanelUI } from '../panel-ui.js';

// Import sub-modules (each registers methods on SidePanelUI.prototype)
import './navigation.js';
import './composer.js';
import './settings.js';
import './profile.js';
import './ui.js';
import './runtime.js';

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
