/**
 * DOM Utilities Module
 * Helper functions for DOM manipulation and text area auto-resizing
 */

/**
 * Creates a debounced function that delays invoking fn until after wait milliseconds
 */
export const debounce = <T extends (...args: any[]) => void>(fn: T, ms: number): ((...args: Parameters<T>) => void) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

/**
 * Resolves the max height of a textarea, falling back to provided value if not set
 */
export const resolveTextAreaMaxHeight = (textarea: HTMLTextAreaElement, fallbackHeight: number): number => {
  const computedMaxHeight = Number.parseFloat(getComputedStyle(textarea).maxHeight);
  if (Number.isFinite(computedMaxHeight) && computedMaxHeight > 0) {
    return computedMaxHeight;
  }
  return fallbackHeight;
};

/**
 * Auto-resizes a textarea based on its content
 */
export const autoResizeTextArea = (textarea: HTMLTextAreaElement | null, maxHeight: number, minHeight = 0): void => {
  if (!textarea) return;
  const resolvedMaxHeight = resolveTextAreaMaxHeight(textarea, maxHeight);
  const resolvedMinHeight = Math.min(Math.max(0, minHeight), resolvedMaxHeight);
  textarea.style.height = 'auto';
  const nextHeight = Math.min(textarea.scrollHeight, resolvedMaxHeight);
  const clampedHeight = Math.max(nextHeight, resolvedMinHeight);
  textarea.style.height = `${clampedHeight}px`;
  textarea.style.overflowY =
    textarea.scrollHeight > resolvedMaxHeight || clampedHeight >= resolvedMaxHeight ? 'auto' : 'hidden';
};
