import type { SelectorSpec } from '../selector-spec.js';
import type { resolveSelectorSpecElement as ResolveSelectorSpecElement } from './shared.js';

export type InjectedClickResult =
  | {
      success: true;
      strategy: string;
      candidates: number;
    }
  | {
      success: false;
      error: string;
      hint?: string;
      strategy?: string;
      candidates?: number;
    };

export const injectedClick = async (
  spec: SelectorSpec,
  waitMs: number,
  dispatchSyntheticClickFn: (
    target: Element,
    clientX: number,
    clientY: number,
    options?: { button?: 0 | 1 | 2; doubleClick?: boolean; contextMenu?: boolean },
  ) => void,
  resolveElementFn: (
    selectorSpec: Parameters<typeof ResolveSelectorSpecElement>[0],
    allowDeepSearch: boolean,
  ) => ReturnType<typeof ResolveSelectorSpecElement>,
): Promise<InjectedClickResult> => {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const pollIntervalMs = 200;
  const deepQueryMinIntervalMs = 700;
  let lastDeepQueryAt = 0;

  const clickElement = (el: HTMLElement) => {
    try {
      el.scrollIntoView({ block: 'center', inline: 'center' } as any);
    } catch {}
    el.focus?.();

    const rect = el.getBoundingClientRect();
    const cx = Math.max(1, Math.min(window.innerWidth - 2, rect.left + rect.width / 2));
    const cy = Math.max(1, Math.min(window.innerHeight - 2, rect.top + rect.height / 2));
    const top = document.elementFromPoint(cx, cy) as HTMLElement | null;
    const target = top && (top === el || el.contains(top)) ? top : el;

    dispatchSyntheticClickFn(target, cx, cy);
    return { success: true as const };
  };

  const start = performance.now();
  const deadline = start + Math.max(0, waitMs || 0);
  while (performance.now() <= deadline) {
    const now = performance.now();
    const allowDeepSearch = now - lastDeepQueryAt >= deepQueryMinIntervalMs;
    if (allowDeepSearch) lastDeepQueryAt = now;

    const resolved = resolveElementFn(spec as Parameters<typeof ResolveSelectorSpecElement>[0], allowDeepSearch);
    if (resolved.el) {
      const result = clickElement(resolved.el);
      return { ...result, strategy: resolved.strategy, candidates: resolved.candidates };
    }

    await sleep(pollIntervalMs);
  }

  const resolved = resolveElementFn(spec as Parameters<typeof ResolveSelectorSpecElement>[0], true);
  if (resolved.el) {
    const result = clickElement(resolved.el);
    return { ...result, strategy: resolved.strategy, candidates: resolved.candidates };
  }

  return {
    success: false,
    error: resolved.error || 'Element not found.',
    hint:
      resolved.hint ||
      (spec.kind === 'contains' || spec.kind === 'text'
        ? 'Use a CSS selector, `text=...`, `tag.contains("...")`, or `button:has-text("...")`.'
        : 'Try a more specific selector or increase timeoutMs.'),
    strategy: resolved.strategy,
    candidates: resolved.candidates,
  };
};
