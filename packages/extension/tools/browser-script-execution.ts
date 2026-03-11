import { type BrowserToolResult, formatToolError, isToolSuccess } from './browser-tool-shared.js';

/**
 * Execute a function in a specific tab's content script context.
 */
export async function runInTab<TArgs extends unknown[], TResult>(
  tabId: number,
  func: (...args: TArgs) => TResult | Promise<TResult>,
  args: TArgs,
): Promise<BrowserToolResult<TResult>> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: func as (...args: unknown[]) => unknown,
      args: [...args],
    });
    return (results?.[0]?.result ?? null) as TResult;
  } catch (error) {
    return {
      success: false,
      error: 'executeScript failed.',
      details: formatToolError(error),
    };
  }
}

/**
 * Execute a function in all frames of a tab.
 * Returns the first successful result, or the first result if none succeed.
 */
export async function runInAllFrames<TArgs extends unknown[], TResult>(
  tabId: number,
  func: (...args: TArgs) => TResult | Promise<TResult>,
  args: TArgs,
): Promise<BrowserToolResult<TResult>> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: func as (...args: unknown[]) => unknown,
      args: [...args],
    });
    const successEntry = results.find((entry) => isToolSuccess(entry?.result));
    if (successEntry?.result) return successEntry.result as TResult;
    const first = results.find((entry) => entry?.result);
    return (first?.result ?? null) as TResult;
  } catch (error) {
    return {
      success: false,
      error: 'executeScript failed (allFrames).',
      details: formatToolError(error),
    };
  }
}

/**
 * Send an overlay action message to a tab with retry logic.
 */
export async function sendOverlay(
  tabId: number,
  payload: {
    label: string;
    selector?: string;
    note?: string;
    status?: 'running' | 'done' | 'error';
    durationMs?: number;
    bringIntoView?: boolean;
  },
  retries = 0,
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'action_overlay', ...payload });
  } catch {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return sendOverlay(tabId, payload, retries - 1);
    }
  }
}
