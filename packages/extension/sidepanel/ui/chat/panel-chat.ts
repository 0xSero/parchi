// Chat module - re-exports all chat-related functionality
// This file is the entry point that loads all chat submodules

// Load utilities and helpers
import './chat-utils.js';

// Load messaging functionality (sendMessage, context compaction)
import './chat-messaging.js';

// Load display functionality (split into focused modules)
import './chat-display-user.js';
import './chat-display-summary.js';
import './chat-display-trace.js';
import './chat-empty-state.js';

// Load assistant message handling (split into focused modules)
import './chat-assistant.js';
import './chat-assistant-streamed.js';
import './chat-assistant-new.js';

// Load chat pruning functionality
import './chat-pruning.js';
