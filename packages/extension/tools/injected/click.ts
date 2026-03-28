import type { SelectorSpec } from '../selector-spec.js';

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

export const injectedClick = async (spec: SelectorSpec, waitMs: number): Promise<InjectedClickResult> => {
  const pollIntervalMs = 200;
  const deepQueryMinIntervalMs = 700;
  let lastDeepQueryAt = 0;

  const isVisible = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (Number.parseFloat(style.opacity || '1') === 0) return false;
    return true;
  };

  const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();

  const deepQuerySelectorAll = (css: string, maxNodes = 25000): HTMLElement[] => {
    const out: HTMLElement[] = [];
    let parsedOk = true;
    try {
      document.querySelector(css);
    } catch {
      parsedOk = false;
    }
    if (!parsedOk) return out;

    const stack: Array<Document | ShadowRoot | Element> = [document];
    let visited = 0;
    while (stack.length && visited < maxNodes) {
      const node = stack.pop()!;
      if (node instanceof Element) {
        visited += 1;
        try {
          if (node.matches(css)) out.push(node as HTMLElement);
        } catch (_matchErr) {
          // Element.matches() can throw for some selectors; skip this node.
        }
        const sr = (node as any).shadowRoot as ShadowRoot | null | undefined;
        if (sr) stack.push(sr);
        for (const child of Array.from(node.children)) stack.push(child);
      } else {
        const children = node instanceof Document ? [node.documentElement] : Array.from(node.children);
        for (const child of children) if (child) stack.push(child);
      }
    }
    return out;
  };

  const findByText = (
    text: string,
    baseSelector = '',
    allowDeepSearch = true,
  ): { el: HTMLElement | null; candidates: number; hint?: string } => {
    const wanted = normalizeText(text);
    if (!wanted) return { el: null, candidates: 0 };

    const preferred = baseSelector
      ? (() => {
          try {
            return Array.from(document.querySelectorAll<HTMLElement>(baseSelector));
          } catch (error: any) {
            if (!allowDeepSearch) return [];
            return deepQuerySelectorAll(baseSelector);
          }
        })()
      : Array.from(document.querySelectorAll<HTMLElement>('a, button, input, [role="button"], [role="link"]'));

    const pool = preferred.length > 0 ? preferred : Array.from(document.querySelectorAll<HTMLElement>('body *'));
    let best: HTMLElement | null = null;
    let bestScore = -1;
    let seen = 0;

    for (const el of pool) {
      if (!(el instanceof HTMLElement)) continue;
      if (!isVisible(el)) continue;
      const txt = normalizeText(el.innerText || el.textContent || '');
      if (!txt) continue;
      if (!txt.includes(wanted)) continue;
      seen += 1;

      const tag = el.tagName.toLowerCase();
      let score = 1;
      if (tag === 'button') score += 4;
      if (tag === 'a') score += 3;
      if (tag === 'input') score += 2;
      if (el.getAttribute('role') === 'button') score += 2;
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }

    return { el: best, candidates: seen };
  };

  const resolveElement = (
    selectorSpec: SelectorSpec,
    allowDeepSearch: boolean,
  ): { el: HTMLElement | null; strategy: string; candidates: number; error?: string; hint?: string } => {
    if (!selectorSpec) {
      return { el: null, strategy: 'none', candidates: 0, error: 'Missing selector.' };
    }

    if (selectorSpec.kind === 'xpath') {
      const expr = String(selectorSpec.xpath || '').trim();
      if (!expr) return { el: null, strategy: 'xpath', candidates: 0, error: 'Missing XPath.' };
      try {
        const res = document.evaluate(expr, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const node = res.singleNodeValue as HTMLElement | null;
        if (node && node instanceof HTMLElement) return { el: node, strategy: 'xpath', candidates: 1 };
        return { el: null, strategy: 'xpath', candidates: 0, error: 'Element not found.' };
      } catch (error: any) {
        return {
          el: null,
          strategy: 'xpath',
          candidates: 0,
          error: 'Invalid selector.',
          hint: `XPath failed: ${error?.message || String(error)}`,
        };
      }
    }

    if (selectorSpec.kind === 'text') {
      const { el, candidates } = findByText(selectorSpec.text, '', allowDeepSearch);
      return el
        ? { el, strategy: 'text', candidates }
        : { el: null, strategy: 'text', candidates, error: 'Element not found.' };
    }

    if (selectorSpec.kind === 'contains') {
      const { el, candidates } = findByText(selectorSpec.text, selectorSpec.base, allowDeepSearch);
      return el
        ? { el, strategy: 'contains/text', candidates }
        : { el: null, strategy: 'contains', candidates, error: 'Element not found.' };
    }

    const css = String(selectorSpec.selector || '').trim();
    if (!css) return { el: null, strategy: 'css', candidates: 0, error: 'Missing selector.' };

    try {
      const matches = Array.from(document.querySelectorAll<HTMLElement>(css));
      const visible = matches.filter(isVisible);
      const el = visible[0] || matches[0] || null;
      if (el) return { el, strategy: 'css', candidates: matches.length };
    } catch (error: any) {
      return {
        el: null,
        strategy: 'css',
        candidates: 0,
        error: 'Invalid selector.',
        hint: `querySelector failed: ${error?.message || String(error)}`,
      };
    }

    if (allowDeepSearch) {
      const deep = deepQuerySelectorAll(css);
      const deepVisible = deep.filter(isVisible);
      const el = deepVisible[0] || deep[0] || null;
      if (el) return { el, strategy: 'css(deep)', candidates: deep.length };
    }

    return { el: null, strategy: 'css', candidates: 0, error: 'Element not found.' };
  };

  const clickElement = (el: HTMLElement) => {
    try {
      el.scrollIntoView({ block: 'center', inline: 'center' } as any);
    } catch (_scrollErr) {
      // scrollIntoView may fail in certain contexts; proceed anyway.
    }
    el.focus?.();

    const rect = el.getBoundingClientRect();
    const cx = Math.max(1, Math.min(window.innerWidth - 2, rect.left + rect.width / 2));
    const cy = Math.max(1, Math.min(window.innerHeight - 2, rect.top + rect.height / 2));
    const top = document.elementFromPoint(cx, cy) as HTMLElement | null;
    const target = top && (top === el || el.contains(top)) ? top : el;

    const fireMouse = (type: string) => {
      target.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: cx,
          clientY: cy,
          button: 0,
        }),
      );
    };

    const firePointer = (type: string) => {
      try {
        (target as any).dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: cx,
            clientY: cy,
            button: 0,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
          }),
        );
      } catch (_pointerErr) {
        // PointerEvent may not be supported in all contexts.
      }
    };

    firePointer('pointerover');
    fireMouse('mouseover');
    firePointer('pointerdown');
    fireMouse('mousedown');
    firePointer('pointerup');
    fireMouse('mouseup');
    fireMouse('click');
    (target as any).click?.();
    return { success: true as const };
  };

  const start = performance.now();
  const deadline = start + Math.max(0, waitMs || 0);
  while (performance.now() <= deadline) {
    const now = performance.now();
    const allowDeepSearch = now - lastDeepQueryAt >= deepQueryMinIntervalMs;
    if (allowDeepSearch) lastDeepQueryAt = now;

    const resolved = resolveElement(spec, allowDeepSearch);
    if (resolved.el) {
      const result = clickElement(resolved.el);
      return { ...result, strategy: resolved.strategy, candidates: resolved.candidates };
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  const resolved = resolveElement(spec, true);
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
