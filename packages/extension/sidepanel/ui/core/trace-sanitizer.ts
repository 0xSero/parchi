/**
 * Trace Sanitizer Module
 * Sanitizes trace payloads for storage and display
 */

export const MAX_TRACE_STRING_LENGTH = 4000;
export const MAX_TRACE_ARRAY_ITEMS = 40;
export const MAX_TRACE_OBJECT_KEYS = 60;

/**
 * Sanitizes a value for trace storage, handling:
 * - Data URL omission
 * - String length capping
 * - Array item limiting
 * - Object key limiting
 * - Circular reference prevention via depth limit
 */
export const sanitizeTracePayload = (value: any, depth = 0): any => {
  if (value == null) return value;

  if (typeof value === 'string') {
    if (value.startsWith('data:image/') || value.startsWith('data:application/octet-stream')) {
      return '[omitted dataUrl]';
    }
    if (value.length <= MAX_TRACE_STRING_LENGTH) return value;
    return `${value.slice(0, MAX_TRACE_STRING_LENGTH)}…`;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'function') return undefined;
  if (depth > 5) return '[truncated]';

  if (Array.isArray(value)) {
    const cap = Math.min(value.length, MAX_TRACE_ARRAY_ITEMS);
    const out = new Array(cap);
    for (let i = 0; i < cap; i += 1) {
      out[i] = sanitizeTracePayload(value[i], depth + 1);
    }
    if (value.length > cap) {
      out.push(`[+${value.length - cap} items truncated]`);
    }
    return out;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: sanitizeTracePayload(value.stack || '', depth + 1),
    };
  }

  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    let keysSeen = 0;
    for (const [key, raw] of Object.entries(value)) {
      keysSeen += 1;
      if (keysSeen > MAX_TRACE_OBJECT_KEYS) {
        out.__truncatedKeys = `[+${Object.keys(value).length - MAX_TRACE_OBJECT_KEYS} keys truncated]`;
        break;
      }
      const lower = key.toLowerCase();
      if (lower.includes('dataurl') || lower === 'dataurl' || lower.endsWith('base64')) {
        out[key] = '[omitted dataUrl]';
        continue;
      }
      if (lower === 'frames' && Array.isArray(raw)) {
        out[key] = { count: raw.length, omitted: true };
        continue;
      }
      out[key] = sanitizeTracePayload(raw, depth + 1);
    }
    return out;
  }

  return String(value);
};
