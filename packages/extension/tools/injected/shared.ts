export type StructuredError = {
  success: false;
  error: string;
  hint?: string;
  details?: string;
};

export type StructuredSuccess<T extends Record<string, unknown> = Record<string, never>> = {
  success: true;
} & T;

// Mirrors ../selector-spec.js's SelectorSpec shape (type-only import isn't available inside
// injected closures reconstructed via `new Function`, so this is redeclared structurally).
export type InjectedSelectorSpec =
  | { kind: 'css'; selector: string }
  | { kind: 'xpath'; xpath: string }
  | { kind: 'text'; text: string }
  | { kind: 'contains'; base: string; text: string };

export type SelectorResolution = {
  el: HTMLElement | null;
  strategy: string;
  candidates: number;
  error?: string;
  hint?: string;
};

// Resolves the extended selector syntax (`css=`, `xpath=`, `text=`, `:contains()`/`.contains()`)
// that `click` supports, including a shadow-DOM-aware deep query fallback for CSS/contains lookups.
//
// NOTE: this must stay a fully self-contained function (no references to imports or outer scope).
// chrome.scripting.executeScript serializes injected functions via Function.prototype.toString()
// and re-runs them with no closure, so callers reconstruct this via `new Function` from
// resolveSelectorSpecElement.toString() passed in as an arg — see click.ts / injected/type.ts.
export function resolveSelectorSpecElement(
  selectorSpec: InjectedSelectorSpec,
  allowDeepSearch: boolean,
): SelectorResolution {
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
        } catch {}
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
    allowDeepSearch2 = true,
  ): { el: HTMLElement | null; candidates: number; hint?: string } => {
    const wanted = normalizeText(text);
    if (!wanted) return { el: null, candidates: 0 };

    const preferred = baseSelector
      ? (() => {
          try {
            return Array.from(document.querySelectorAll<HTMLElement>(baseSelector));
          } catch {
            if (!allowDeepSearch2) return [];
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
}

export type SyntheticClickOptions = {
  button?: 0 | 1 | 2;
  doubleClick?: boolean;
  contextMenu?: boolean;
};

// Fires the pointerover/mouseover/pointerdown/mousedown/pointerup/mouseup/click sequence a real
// user interaction produces, plus optional dblclick/contextmenu, ending with a native .click().
//
// NOTE: this must stay a fully self-contained function (no references to imports or outer scope).
// chrome.scripting.executeScript serializes injected functions via Function.prototype.toString()
// and re-runs them with no closure, so callers reconstruct this via `new Function` from
// dispatchSyntheticClick.toString() passed in as an arg — see click.ts / browser-click-tools.ts.
export function dispatchSyntheticClick(
  target: Element,
  clientX: number,
  clientY: number,
  options: SyntheticClickOptions = {},
): void {
  const buttonCode = options.button ?? 0;

  const firePointer = (type: string) => {
    try {
      target.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX,
          clientY,
          button: buttonCode,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
        }),
      );
    } catch {}
  };

  const fireMouse = (type: string) => {
    target.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX,
        clientY,
        button: buttonCode,
      }),
    );
  };

  firePointer('pointerover');
  fireMouse('mouseover');
  firePointer('pointerdown');
  fireMouse('mousedown');
  firePointer('pointerup');
  fireMouse('mouseup');
  fireMouse('click');

  if (options.doubleClick) {
    firePointer('pointerdown');
    fireMouse('mousedown');
    firePointer('pointerup');
    fireMouse('mouseup');
    fireMouse('click');
    fireMouse('dblclick');
  }

  if (options.contextMenu) {
    fireMouse('contextmenu');
  }

  const clickable = target as Element & { click?: () => void };
  if (buttonCode === 0 && typeof clickable.click === 'function') {
    clickable.click();
  }
}
