import { clickAtTool, clickTool } from './browser-click-tools.js';
import { pressKeyTool, scrollTool, typeTool } from './browser-input-tools.js';
import { getVideoInfoTool, screenshotTool, watchVideoTool } from './browser-media-tools.js';
import { evaluateTool, findHtmlTool, getContentTool } from './browser-read-tools.js';
import {
  closeTabTool,
  describeSessionTabsTool,
  focusTabTool,
  getTabsTool,
  groupTabsTool,
  navigateTool,
  openTabTool,
} from './browser-tab-tools.js';
import type { BrowserToolName } from './browser-tool-definitions.js';
import type { BrowserToolArgs, BrowserToolsDelegate } from './browser-tool-shared.js';
import { waitForTool } from './browser-wait-tools.js';

/** Tool handler function type */
export type ToolHandler = (args: BrowserToolArgs) => Promise<unknown>;

/** Map of tool names to their handler functions */
export type ToolHandlerMap = Record<BrowserToolName, ToolHandler>;

/**
 * Create the tool handler map for a BrowserTools instance.
 * Each handler is bound to the provided delegate context.
 */
export function createToolHandlers(delegate: BrowserToolsDelegate): ToolHandlerMap {
  return {
    navigate: (args) => navigateTool(delegate, args),
    openTab: (args) => openTabTool(delegate, args),
    click: (args) => clickTool(delegate, args),
    clickAt: (args) => clickAtTool(delegate, args),
    type: (args) => typeTool(delegate, args),
    pressKey: (args) => pressKeyTool(delegate, args),
    scroll: (args) => scrollTool(delegate, args),
    waitFor: (args) => waitForTool(delegate, args),
    evaluate: (args) => evaluateTool(delegate, args),
    getContent: (args) => getContentTool(delegate, args),
    findHtml: (args) => findHtmlTool(delegate, args),
    screenshot: (args) => screenshotTool(delegate, args),
    getTabs: () => getTabsTool(),
    closeTab: (args) => closeTabTool(delegate, args),
    switchTab: (args) => focusTabTool(delegate, args),
    focusTab: (args) => focusTabTool(delegate, args),
    groupTabs: (args) => groupTabsTool(delegate, args),
    describeSessionTabs: () => describeSessionTabsTool(delegate),
    watchVideo: (args) => watchVideoTool(delegate, args),
    getVideoInfo: (args) => getVideoInfoTool(delegate, args),
  };
}

/**
 * Check if a tool name has a registered handler.
 */
export function hasToolHandler(handlers: ToolHandlerMap, toolName: string): toolName is BrowserToolName {
  return Object.hasOwn(handlers, toolName);
}

/**
 * Execute a tool by name with the given arguments.
 * Returns an error result if the tool is unknown or throws.
 */
export async function executeTool(
  handlers: ToolHandlerMap,
  toolName: string,
  args: BrowserToolArgs = {},
): Promise<unknown> {
  if (!hasToolHandler(handlers, toolName)) {
    return { success: false, error: `Unknown tool: ${toolName}` };
  }

  try {
    return await handlers[toolName](args);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Tool execution error (${toolName}):`, error);
    return {
      success: false,
      error: `Tool "${toolName}" failed: ${errorMessage}`,
      hint: 'Try a different approach or check the arguments.',
    };
  }
}
