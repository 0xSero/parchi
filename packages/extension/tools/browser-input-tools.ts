import {
  type BrowserToolArgs,
  type BrowserToolsDelegate,
  MAX_WAIT_TIMEOUT_MS,
  isToolFailure,
  missingSessionTabError,
  resolveWaitTimeoutMs,
} from './browser-tool-shared.js';
import { resolveSelectorSpecElement } from './injected/shared.js';
import { injectedType } from './injected/type.js';
import { parseSelectorSpec } from './selector-spec.js';

export async function typeTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();

  const selector = String(args.selector || '');
  const text = String(args.text ?? '');
  const timeout = resolveWaitTimeoutMs(args.timeoutMs);
  const timeoutMs = timeout.timeoutMs;

  const preview = text.length > 28 ? `${text.slice(0, 28)}…` : text;
  await ctx.sendOverlay(tabId, {
    label: 'Type',
    selector,
    note: preview ? `"${preview}"` : undefined,
    bringIntoView: true,
    durationMs: 2200,
  });

  const spec = selector ? parseSelectorSpec(selector) : null;
  let result = await ctx.runInTab(tabId, injectedType, [spec, text, timeoutMs, resolveSelectorSpecElement] as const);
  if (isToolFailure(result) && result.error === 'Element not found.') {
    result = await ctx.runInAllFrames(tabId, injectedType, [
      spec,
      text,
      timeoutMs,
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

export async function pressKeyTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();
  const key = String(args.key || '');
  const selector = args.selector ? String(args.selector) : '';
  await ctx.sendOverlay(tabId, {
    label: 'Press key',
    selector: selector || undefined,
    note: key,
    bringIntoView: Boolean(selector),
    durationMs: 1500,
  });
  const result = await ctx.runInTab(
    tabId,
    (k: string, sel: string) => {
      const target = sel
        ? document.querySelector<HTMLElement>(sel)
        : (document.activeElement as HTMLElement | null) || document.body;
      if (!target) return { success: false, error: 'Target not found.' };
      target.focus?.();

      const keyEventInit: KeyboardEventInit = {
        key: k,
        code: k === 'Enter' ? 'Enter' : undefined,
        bubbles: true,
        cancelable: true,
        composed: true,
        keyCode: k === 'Enter' ? 13 : undefined,
        which: k === 'Enter' ? 13 : undefined,
      };

      const dispatch = (type: 'keydown' | 'keypress' | 'keyup') => {
        target.dispatchEvent(new KeyboardEvent(type, keyEventInit));
      };

      dispatch('keydown');
      if (k === 'Enter') {
        dispatch('keypress');
      }
      dispatch('keyup');

      if (k === 'Enter') {
        const active = target as HTMLElement;
        const maybeForm = active.closest?.('form') || ((active as HTMLInputElement | HTMLTextAreaElement).form ?? null);
        if (maybeForm && typeof (maybeForm as HTMLFormElement).requestSubmit === 'function') {
          try {
            (maybeForm as HTMLFormElement).requestSubmit();
          } catch {}
        }

        const clickish =
          active instanceof HTMLButtonElement ||
          (active as HTMLInputElement).type === 'submit' ||
          active.getAttribute?.('role') === 'button';
        if (clickish && typeof (active as HTMLButtonElement).click === 'function') {
          try {
            (active as HTMLButtonElement).click();
          } catch {}
        }
      }

      return { success: true };
    },
    [key, selector] as const,
  );
  return result || { success: false, error: 'Script execution failed.' };
}

export async function scrollTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();
  const direction = String(args.direction || 'down');
  const amount = typeof args.amount === 'number' ? args.amount : 600;
  const selector = args.selector ? String(args.selector) : '';
  await ctx.sendOverlay(tabId, {
    label: 'Scroll',
    note: direction === 'down' || direction === 'up' ? `${direction} ${amount}px` : direction,
    durationMs: 1200,
  });
  const result = await ctx.runInTab(
    tabId,
    (dir: string, amt: number, sel: string) => {
      const resolveScroller = () => {
        if (sel) {
          const el = document.querySelector(sel);
          if (el && (el as HTMLElement).scrollHeight - (el as HTMLElement).clientHeight > 24) {
            return el as HTMLElement;
          }
        }

        const root = (document.scrollingElement || document.documentElement) as HTMLElement | null;
        if (root && root.scrollHeight - root.clientHeight > 24) return root;

        const nodes = Array.from(
          document.querySelectorAll<HTMLElement>(
            'main, [role="main"], [data-scroll], .scroll, .scroller, .scroll-container, .cm-scroller, .CodeMirror-scroll',
          ),
        );
        const extras = Array.from(document.querySelectorAll<HTMLElement>('body *')).slice(0, 1200);
        const candidates = nodes.length ? nodes.concat(extras) : extras;

        let best: HTMLElement | null = null;
        let bestScore = 0;
        for (const el of candidates) {
          if (!el || el === document.body) continue;
          const ch = el.clientHeight || 0;
          if (ch < 80) continue;
          const overflow = getComputedStyle(el).overflowY;
          if (!(overflow === 'auto' || overflow === 'scroll')) continue;
          const delta = (el.scrollHeight || 0) - ch;
          if (delta < 40) continue;
          const score = delta + ch * 0.25;
          if (score > bestScore) {
            bestScore = score;
            best = el;
          }
        }

        return best || root || (document.documentElement as HTMLElement);
      };

      const scroller = resolveScroller();
      const before = scroller.scrollTop;
      const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);

      const normalized = String(dir || 'down').toLowerCase();
      if (normalized === 'top') {
        scroller.scrollTop = 0;
      } else if (normalized === 'bottom') {
        scroller.scrollTop = maxTop;
      } else if (normalized === 'up') {
        scroller.scrollTop = Math.max(0, before - amt);
      } else {
        scroller.scrollTop = Math.min(maxTop, before + amt);
      }

      const after = scroller.scrollTop;
      return {
        success: true,
        scroller: {
          tag: scroller.tagName,
          id: scroller.id || null,
          className: scroller.className || null,
        },
        before,
        after,
        moved: after !== before,
      };
    },
    [direction, amount, selector] as const,
  );
  return result || { success: false, error: 'Script execution failed.' };
}
