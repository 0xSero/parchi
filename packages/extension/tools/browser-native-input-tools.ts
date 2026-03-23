import {
  type BrowserToolArgs,
  type BrowserToolsDelegate,
  formatToolError,
  missingSessionTabError,
} from './browser-tool-shared.js';

type DebugTarget = chrome.debugger.Debuggee;

const KEY_MAP: Record<string, { code: string; key: string; keyCode: number; windowsVirtualKeyCode: number }> = {
  Enter: { code: 'Enter', key: 'Enter', keyCode: 13, windowsVirtualKeyCode: 13 },
  Tab: { code: 'Tab', key: 'Tab', keyCode: 9, windowsVirtualKeyCode: 9 },
  Escape: { code: 'Escape', key: 'Escape', keyCode: 27, windowsVirtualKeyCode: 27 },
  Backspace: { code: 'Backspace', key: 'Backspace', keyCode: 8, windowsVirtualKeyCode: 8 },
  Delete: { code: 'Delete', key: 'Delete', keyCode: 46, windowsVirtualKeyCode: 46 },
  ArrowUp: { code: 'ArrowUp', key: 'ArrowUp', keyCode: 38, windowsVirtualKeyCode: 38 },
  ArrowDown: { code: 'ArrowDown', key: 'ArrowDown', keyCode: 40, windowsVirtualKeyCode: 40 },
  ArrowLeft: { code: 'ArrowLeft', key: 'ArrowLeft', keyCode: 37, windowsVirtualKeyCode: 37 },
  ArrowRight: { code: 'ArrowRight', key: 'ArrowRight', keyCode: 39, windowsVirtualKeyCode: 39 },
  Space: { code: 'Space', key: ' ', keyCode: 32, windowsVirtualKeyCode: 32 },
};

async function sendDebugCommand(tabId: number, method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const target: DebugTarget = { tabId };
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, params, (result) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(result);
    });
  });
}

async function ensureDebuggerAttached(tabId: number): Promise<void> {
  const target: DebugTarget = { tabId };
  return new Promise((resolve, reject) => {
    chrome.debugger.attach(target, '1.3', () => {
      const err = chrome.runtime.lastError;
      if (err && !err.message?.includes('Another debugger is already attached')) {
        reject(new Error(err.message));
        return;
      }
      resolve();
    });
  });
}

export async function nativeClickTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();

  const action = String(args.action || 'click');

  try {
    await ensureDebuggerAttached(tabId);

    if (action === 'click') {
      const x = typeof args.x === 'number' ? args.x : 0;
      const y = typeof args.y === 'number' ? args.y : 0;

      await ctx.sendOverlay(tabId, {
        label: 'Native click',
        note: `(${Math.round(x)}, ${Math.round(y)})`,
        durationMs: 1000,
      });

      await sendDebugCommand(tabId, 'Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x,
        y,
        button: 'left',
        clickCount: 1,
      });
      await sendDebugCommand(tabId, 'Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x,
        y,
        button: 'left',
        clickCount: 1,
      });

      return { success: true, action: 'click', x, y, trusted: true };
    }

    if (action === 'type') {
      const text = typeof args.text === 'string' ? args.text : '';
      if (!text) return { success: false, error: 'Missing text parameter for type action.' };

      await ctx.sendOverlay(tabId, {
        label: 'Native type',
        note: text.slice(0, 30),
        durationMs: 1200,
      });

      for (const char of text) {
        await sendDebugCommand(tabId, 'Input.dispatchKeyEvent', {
          type: 'keyDown',
          text: char,
          key: char,
          code: `Key${char.toUpperCase()}`,
          windowsVirtualKeyCode: char.charCodeAt(0),
          nativeVirtualKeyCode: char.charCodeAt(0),
        });
        await sendDebugCommand(tabId, 'Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: char,
          code: `Key${char.toUpperCase()}`,
          windowsVirtualKeyCode: char.charCodeAt(0),
          nativeVirtualKeyCode: char.charCodeAt(0),
        });
      }

      return { success: true, action: 'type', length: text.length, trusted: true };
    }

    if (action === 'press') {
      const key = typeof args.key === 'string' ? args.key : '';
      if (!key) return { success: false, error: 'Missing key parameter for press action.' };

      await ctx.sendOverlay(tabId, {
        label: 'Native press',
        note: key,
        durationMs: 800,
      });

      const mapped = KEY_MAP[key];
      const keyParams = mapped || {
        code: `Key${key.toUpperCase()}`,
        key,
        keyCode: key.charCodeAt(0),
        windowsVirtualKeyCode: key.charCodeAt(0),
      };

      await sendDebugCommand(tabId, 'Input.dispatchKeyEvent', {
        type: 'keyDown',
        ...keyParams,
      });
      await sendDebugCommand(tabId, 'Input.dispatchKeyEvent', {
        type: 'keyUp',
        ...keyParams,
      });

      return { success: true, action: 'press', key, trusted: true };
    }

    return { success: false, error: `Unknown action: ${action}. Use click, type, or press.` };
  } catch (error) {
    return {
      success: false,
      error: 'Native input event failed.',
      details: formatToolError(error),
      hint: 'The debugger may need to be attached first. A banner will appear in the browser.',
    };
  }
}
