/**
 * Panel Core Module
 * Main entry point that imports and registers all sidepanel functionality
 */

import { SidePanelUI } from './panel-ui.js';

// Import side-effect modules that register methods on SidePanelUI.prototype
// These modules split the original 1542-line panel-core.ts into focused modules

// 1. DOM utilities (debounce, autoResizeTextArea)
import './dom-utils.js';

// 2. Trace sanitization (sanitizeTracePayload)
import './trace-sanitizer.js';

// 3. History management (clampHistoryTurnMap, capTurnToolEvents)
import './history-manager.js';

// 4. State management (init, connectLifecyclePort, requestRunStop, watchdog)
import './state-manager.js';

// 5. Event handling (setupEventListeners)
import './event-handler.js';

// 6. Message processing (handleRuntimeMessage and all message handlers)
import './message-processor.js';

// 7. Context handling (handleContextCompaction, appendContextMessages)
import './context-handler.js';

// Re-export types for consumers
export type { SidePanelUI };

// Default export for the prototype (methods are registered by imported modules)
export default SidePanelUI.prototype;
