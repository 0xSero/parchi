import {
  type BrowserToolArgs,
  type BrowserToolsDelegate,
  MAX_WAIT_TIMEOUT_MS,
  isToolFailure,
  missingSessionTabError,
  resolveWaitTimeoutMs,
} from './browser-tool-shared.js';
import { injectedClick } from './injected/click.js';
import { dispatchSyntheticClick, resolveSelectorSpecElement } from './injected/shared.js';
import { parseSelectorSpec } from './selector-spec.js';

export async function clickTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();

  const rawSelector = String(args.selector || '');
  if (!rawSelector) {
    return { success: false, error: 'Missing selector.' };
  }

  const timeout = resolveWaitTimeoutMs(args.timeoutMs);
  const timeoutMs = timeout.timeoutMs;

  await ctx.sendOverlay(tabId, {
    label: 'Click',
    selector: rawSelector,
    bringIntoView: true,
    durationMs: 2000,
  });

  const spec = parseSelectorSpec(rawSelector);

  let result = await ctx.runInTab(tabId, injectedClick, [
    spec,
    timeoutMs,
    dispatchSyntheticClick,
    resolveSelectorSpecElement,
  ] as const);
  if (isToolFailure(result) && result.error === 'Element not found.') {
    result = await ctx.runInAllFrames(tabId, injectedClick, [
      spec,
      timeoutMs,
      dispatchSyntheticClick,
      resolveSelectorSpecElement,
    ] as const);
  }

  if (timeout.wasClamped && result && typeof result === 'object') {
    return {
      ...result,
      warning: `timeoutMs capped at ${MAX_WAIT_TIMEOUT_MS}ms to prevent runaway polling.`,
      timeoutMsRequested: args.timeoutMs,
      timeoutMsUsed: timeoutMs,
    };
  }

  return result || { success: false, error: 'Script execution failed.' };
}

export async function clickAtTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();

  const x = typeof args.x === 'number' ? args.x : Number.NaN;
  const y = typeof args.y === 'number' ? args.y : Number.NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return { success: false, error: 'Missing or invalid x/y coordinates.' };
  }

  const button = ['left', 'right', 'middle'].includes(String(args.button)) ? String(args.button) : 'left';
  const doubleClick = args.doubleClick === true;

  await ctx.sendOverlay(tabId, {
    label: doubleClick ? 'Double-click' : 'Click',
    note: `(${Math.round(x)}, ${Math.round(y)})`,
    durationMs: 1500,
  });

  const clickAtScript = (cx: number, cy: number, btn: string, dblClick: boolean) => {
    // Inline dispatchSyntheticClick logic to avoid new Function reconstruction on CSP-strict pages
    const buttonCode = btn === 'right' ? 2 : btn === 'middle' ? 1 : 0;

    const firePointer = (type: string, target: Element) => {
      try {
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: cx,
            clientY: cy,
            button: buttonCode,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
          }),
        );
      } catch {}
    };

    const fireMouse = (type: string, target: Element) => {
      target.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: cx,
          clientY: cy,
          button: buttonCode,
        }),
      );
    };

    const syntheticClick = (target: Element) => {
      firePointer('pointerover', target);
      fireMouse('mouseover', target);
      firePointer('pointerdown', target);
      fireMouse('mousedown', target);
      firePointer('pointerup', target);
      fireMouse('mouseup', target);
      fireMouse('click', target);

      if (dblClick) {
        firePointer('pointerdown', target);
        fireMouse('mousedown', target);
        firePointer('pointerup', target);
        fireMouse('mouseup', target);
        fireMouse('click', target);
        fireMouse('dblclick', target);
      }

      if (btn === 'right') {
        fireMouse('contextmenu', target);
      }

      if (buttonCode === 0 && typeof (target as Element & { click?: () => void }).click === 'function') {
        (target as Element & { click: () => void }).click();
      }
    };

    if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) {
      return {
        success: false,
        error: `Coordinates (${cx}, ${cy}) are outside the visible viewport (${window.innerWidth}x${window.innerHeight}). Coordinates must be CSS/viewport pixels, not device pixels.`,
      };
    }

    const el = document.elementFromPoint(cx, cy) as HTMLElement | null;

    const tag = el ? el.tagName.toLowerCase() : null;
    const id = el?.id || null;
    const text = el?.textContent?.trim().slice(0, 80) || null;

    const target: Element = el || document.documentElement;

    if (el && typeof el.focus === 'function') {
      el.focus();
    }

    syntheticClick(target);

    return {
      success: true,
      x: cx,
      y: cy,
      button: btn,
      doubleClick: dblClick,
      elementHit: el
        ? {
            tag,
            id,
            className: el.className ? String(el.className).slice(0, 120) : null,
            text: text ? (text.length > 80 ? text.slice(0, 77) + '…' : text) : null,
          }
        : null,
    };
  };

  const result = await ctx.runInTab(tabId, clickAtScript, [x, y, button, doubleClick] as const);
  return result || { success: false, error: 'Script execution failed.' };
}
