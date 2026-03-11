// Status panel module - barrel file that imports all status-related functionality
// This file is kept for backward compatibility; individual modules can also be imported directly

// Import side effects - these augment SidePanelUI.prototype
import './status-display.js';
import './balance-popover.js';
import './model-utils.js';
import './model-catalog-fetch.js';
import './model-catalog.js';
import './model-selection.js';
import './model-profile-editor.js';

// Re-export utilities for direct use
export {
  MODEL_SELECT_VALUE_SEPARATOR,
  OPENROUTER_BASE_URL,
  normalizeProvider,
  normalizeHeaders,
  normalizeEndpointBase,
  buildModelEndpointCandidates,
  encodeModelSelectValue,
  decodeModelSelectValue,
  extractModelIds,
  populateModelSelectElement,
  populateModelSuggestionList,
  withTimeout,
} from './model-utils.js';
