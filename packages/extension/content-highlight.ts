import type { HighlightEntry } from './content-types.js';

export function highlightElement(highlightedElements: Set<HighlightEntry>, selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) return;

  const originalOutline = element.style.outline;
  const originalOutlineOffset = element.style.outlineOffset;
  element.style.outline = '3px solid #4f46e5';
  element.style.outlineOffset = '2px';

  const entry: HighlightEntry = { element, originalOutline, originalOutlineOffset };
  highlightedElements.add(entry);

  setTimeout(() => {
    if (element.isConnected) {
      element.style.outline = originalOutline;
      element.style.outlineOffset = originalOutlineOffset;
    }
    highlightedElements.delete(entry);
  }, 3000);
}

export function unhighlightAll(highlightedElements: Set<HighlightEntry>) {
  highlightedElements.forEach(({ element, originalOutline, originalOutlineOffset }) => {
    if (element.isConnected) {
      element.style.outline = originalOutline;
      element.style.outlineOffset = originalOutlineOffset;
    }
  });
  highlightedElements.clear();
}
