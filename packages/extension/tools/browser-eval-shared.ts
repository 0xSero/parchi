export const EVALUATE_TOOL_MAX_SCRIPT_LENGTH = 20_000;

export const DEFAULT_WAIT_POLL_INTERVAL_MS = 250;
export const MIN_WAIT_POLL_INTERVAL_MS = 50;

export async function runPageScript(source: string, runtimeArgs: unknown[]) {
  try {
    const bodyFactory = new Function('args', `return (async () => {\n${source}\n})();`);
    return await bodyFactory(runtimeArgs);
  } catch {
    const expressionFactory = new Function('args', `return (${source});`);
    return await expressionFactory(runtimeArgs);
  }
}

export function toJsonSafe(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'function') {
    return '[Function]';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof RegExp) {
    return String(value);
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (typeof Node !== 'undefined' && value instanceof Node) {
    if (value instanceof Element) {
      return {
        nodeType: value.nodeType,
        tagName: value.tagName,
        id: value.id || undefined,
        className: value.className || undefined,
        textContent: value.textContent?.slice(0, 500) || '',
      };
    }
    return {
      nodeType: value.nodeType,
      textContent: value.textContent?.slice(0, 500) || '',
    };
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toJsonSafe(entry, seen));
  }
  if (value instanceof Map) {
    return Array.from(value.entries()).map(([key, entry]) => [toJsonSafe(key, seen), toJsonSafe(entry, seen)]);
  }
  if (value instanceof Set) {
    return Array.from(value.values()).map((entry) => toJsonSafe(entry, seen));
  }
  if (typeof value === 'object') {
    if (seen.has(value as object)) {
      return '[Circular]';
    }
    seen.add(value as object);
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = toJsonSafe(entry, seen);
    }
    seen.delete(value as object);
    return output;
  }
  return String(value);
}
