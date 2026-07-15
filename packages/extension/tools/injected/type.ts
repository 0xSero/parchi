import type { SelectorSpec } from '../selector-spec.js';
import type { resolveSelectorSpecElement as ResolveSelectorSpecElement } from './shared.js';

export type InjectedTypeResult =
  | { success: true }
  | {
      success: false;
      error: string;
      hint?: string;
    };

export const injectedType = async (
  spec: SelectorSpec | null,
  value: string,
  waitMs: number,
  resolveElementFn: (
    selectorSpec: Parameters<typeof ResolveSelectorSpecElement>[0],
    allowDeepSearch: boolean,
  ) => ReturnType<typeof ResolveSelectorSpecElement>,
): Promise<InjectedTypeResult> => {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const pollIntervalMs = 200;

  const isVisible = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  };

  const safeQueryAll = (css: string) => {
    try {
      return Array.from(document.querySelectorAll<HTMLElement>(css));
    } catch {
      return [] as HTMLElement[];
    }
  };

  const resolveEditable = (candidate: HTMLElement | null) => {
    if (!candidate) return null;
    if (
      candidate instanceof HTMLInputElement ||
      candidate instanceof HTMLTextAreaElement ||
      (candidate as HTMLElement).isContentEditable
    ) {
      return candidate;
    }
    const descendant =
      candidate.querySelector<HTMLElement>(
        'textarea, input, [contenteditable="true"], [contenteditable=""], [role="textbox"]',
      ) || null;
    return descendant || null;
  };

  let el: HTMLElement | null = null;
  const deepQueryMinIntervalMs = 700;
  let lastDeepQueryAt = 0;
  const start = performance.now();
  const deadline = start + Math.max(0, waitMs || 0);
  while (performance.now() <= deadline) {
    if (spec) {
      const now = performance.now();
      const allowDeepSearch = now - lastDeepQueryAt >= deepQueryMinIntervalMs;
      if (allowDeepSearch) lastDeepQueryAt = now;
      const resolved = resolveElementFn(spec, allowDeepSearch);
      if (resolved.error === 'Invalid selector.') {
        return { success: false, error: `${resolved.error} ${resolved.hint || ''}`.trim() };
      }
      el = resolveEditable(resolved.el);
    }

    if (!el) {
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active.isContentEditable)
      ) {
        el = active;
      }
    }

    if (!el) {
      const candidates = safeQueryAll(
        'input, textarea, [contenteditable="true"], [contenteditable=""], [role="textbox"]',
      );
      const fallback = candidates.find(isVisible) || candidates[0] || null;
      if (fallback) el = fallback;
    }

    if (el) break;
    await sleep(pollIntervalMs);
  }

  if (!el) {
    return {
      success: false,
      error: 'Element not found.',
      hint: 'Try a more specific selector or increase timeoutMs.',
    };
  }

  const dispatchInputEvents = (target: HTMLElement) => {
    try {
      target.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: value,
        }),
      );
    } catch {
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
    target.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const setNativeValue = (target: HTMLInputElement | HTMLTextAreaElement, nextValue: string) => {
    const proto = Object.getPrototypeOf(target);
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor?.set) {
      descriptor.set.call(target, nextValue);
    } else {
      target.value = nextValue;
    }
  };

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const inputType = el instanceof HTMLInputElement ? el.type : 'text';
    if (inputType === 'checkbox' || inputType === 'radio') {
      return { success: false, error: 'Element is a checkbox/radio. Use click instead.' };
    }
    try {
      el.scrollIntoView({ block: 'center', inline: 'center' } as any);
    } catch {}
    el.focus();
    if (typeof el.select === 'function') {
      el.select();
    }
    setNativeValue(el, value);
    dispatchInputEvents(el);
    return { success: true };
  }

  if ((el as HTMLElement).isContentEditable) {
    try {
      el.scrollIntoView({ block: 'center', inline: 'center' } as any);
    } catch {}
    el.focus();
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      const range = document.createRange();
      range.selectNodeContents(el);
      selection.addRange(range);
    }
    document.execCommand?.('insertText', false, value);
    if (el.textContent !== value) {
      el.textContent = value;
    }
    dispatchInputEvents(el);
    return { success: true };
  }

  return {
    success: false,
    error: 'Target is not an input or editable element.',
    hint: 'Use a selector that targets an <input>, <textarea>, or [contenteditable] node (or click to focus it first).',
  };
};
