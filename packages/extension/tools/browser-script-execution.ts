import {
  type BrowserToolErrorResult,
  type BrowserToolResult,
  formatToolError,
  isToolSuccess,
} from './browser-tool-shared.js';

const FRAME_REMOVED_PATTERNS = [
  'frame with id',
  'frame was removed',
  'cannot access contents of url',
  'no frame with id',
];

function isFrameRemovedError(message: string): boolean {
  const lower = message.toLowerCase();
  return FRAME_REMOVED_PATTERNS.some((p) => lower.includes(p));
}

function classifyExecuteScriptError(error: unknown): {
  code: string;
  message: string;
  hint?: string;
} {
  const msg = formatToolError(error).toLowerCase();
  if (isFrameRemovedError(msg)) {
    return {
      code: 'frame_detached',
      message: 'Frame was removed during execution.',
      hint: 'The page may be navigating. Wait briefly and retry.',
    };
  }
  if (msg.includes('csp') || msg.includes('unsafe-eval') || msg.includes('eval')) {
    return {
      code: 'csp_blocked',
      message: 'Script execution blocked by page Content Security Policy.',
      hint: 'Avoid evaluate/script conditions on this page. Use selector, text, or screenshot instead.',
    };
  }
  if (msg.includes('cannot access') || msg.includes('url')) {
    return {
      code: 'tab_inaccessible',
      message: 'Cannot access the tab.',
      hint: 'The tab may be on a restricted URL (chrome://, etc.).',
    };
  }
  return { code: 'executeScript_failed', message: formatToolError(error) };
}

/**
 * Execute a function in a specific tab's content script context.
 * Retries once on frame-removed races.
 */
export async function runInTab<TArgs extends unknown[], TResult>(
  tabId: number,
  func: (...args: TArgs) => TResult | Promise<TResult>,
  args: TArgs,
): Promise<BrowserToolResult<TResult>> {
  const maxAttempts = 2;
  const retryDelayMs = 400;
  let lastError: { code: string; message: string; hint?: string } | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: func as (...args: unknown[]) => unknown,
        args: [...args],
      });
      const raw = results?.[0]?.result;
      if (raw && typeof raw === 'object' && 'success' in raw && raw.success === false) {
        return raw as BrowserToolErrorResult;
      }
      return (raw ?? null) as TResult;
    } catch (error) {
      const classified = classifyExecuteScriptError(error);
      lastError = classified;
      if (classified.code === 'frame_detached' && attempt + 1 < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }
      return {
        success: false,
        error: classified.message,
        code: classified.code,
        hint: classified.hint,
        details: formatToolError(error),
      };
    }
  }

  return {
    success: false,
    error: lastError!.message,
    code: lastError!.code,
    hint: lastError!.hint,
  };
}

/**
 * Execute a function in all frames of a tab.
 * Returns the first successful result, or the first result if none succeed.
 * Retries once on frame-removed races.
 */
export async function runInAllFrames<TArgs extends unknown[], TResult>(
  tabId: number,
  func: (...args: TArgs) => TResult | Promise<TResult>,
  args: TArgs,
): Promise<BrowserToolResult<TResult>> {
  const maxAttempts = 2;
  const retryDelayMs = 400;
  let lastError: { code: string; message: string; hint?: string } | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
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
      const classified = classifyExecuteScriptError(error);
      lastError = classified;
      if (classified.code === 'frame_detached' && attempt + 1 < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }
      return {
        success: false,
        error: classified.message,
        code: classified.code,
        hint: classified.hint,
        details: formatToolError(error),
      };
    }
  }

  return {
    success: false,
    error: lastError!.message,
    code: lastError!.code,
    hint: lastError!.hint,
  };
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
