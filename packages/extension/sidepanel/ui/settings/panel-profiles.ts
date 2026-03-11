// Profile management module - imports all profile-related functionality
import './profile-bindings.js';
import './profile-form-helpers.js';
import './profile-crud.js';
import './profile-selectors.js';
import './profile-grid.js';
import './profile-editor.js';
import './profile-json-editor.js';

// Re-export types for consumers
export type { BooleanBinding, NumberBinding } from './profile-bindings.js';
export { parseHeadersJson } from './settings-validation.js';
export { formatHeadersJson, resizeProfilePromptInput } from './profile-json-editor.js';
