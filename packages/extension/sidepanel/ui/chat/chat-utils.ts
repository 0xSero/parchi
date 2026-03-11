import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

export const formatTraceNumber = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return '—';
  const rounded = Math.round(num);
  return rounded >= 1000 ? rounded.toLocaleString() : String(rounded);
};

export const formatTraceSignedDelta = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  const rounded = Math.round(num);
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString()}`;
};

export const formatTracePercent = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return '—';
  return `${Math.round(num)}%`;
};

export const MAX_DISPLAY_HISTORY = 400;

export const truncate = (value: string, max = 12000) => {
  const text = String(value || '');
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
};

// Chrome runtime messaging can fail on large payloads or non-cloneable values.
// Keep history compact and remove heavy fields (e.g. screenshots/dataUrls) before sending to background.
export const sanitizeForMessaging = (value: unknown, depth = 0): unknown => {
  if (value == null) return value;
  if (typeof value === 'string') {
    const s = value;
    if (s.startsWith('data:image/') || s.startsWith('data:application/octet-stream')) {
      return '[omitted dataUrl]';
    }
    return truncate(s, 12000);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'function') return undefined;
  if (depth > 6) return '[truncated]';

  if (Array.isArray(value)) {
    const looksLikeMessageHistory = value.every(
      (entry) =>
        entry &&
        typeof entry === 'object' &&
        !Array.isArray(entry) &&
        ('role' in (entry as any) || 'content' in (entry as any)),
    );
    if (looksLikeMessageHistory) {
      const historyLimit = 240;
      const start = Math.max(0, value.length - historyLimit);
      const out: unknown[] = [];
      for (let i = start; i < value.length; i += 1) {
        out.push(sanitizeForMessaging(value[i], depth + 1));
      }
      return out;
    }

    const out: unknown[] = [];
    const limit = Math.min(value.length, 80);
    for (let i = 0; i < limit; i += 1) {
      out.push(sanitizeForMessaging(value[i], depth + 1));
    }
    if (value.length > limit) out.push(`[+${value.length - limit} items truncated]`);
    return out;
  }

  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: truncate(value.stack || '', 2000) };
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'dataUrl') {
        out[k] = '[omitted dataUrl]';
        continue;
      }
      out[k] = sanitizeForMessaging(v, depth + 1);
    }
    return out;
  }

  return String(value);
};

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const isMissingReceiverError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /Receiving end does not exist|Could not establish connection/i.test(message);
};

export const sendRuntimeMessageWithRetry = async (payload: Record<string, unknown>, retries = 1) => {
  let attempt = 0;
  while (true) {
    try {
      return await chrome.runtime.sendMessage(payload);
    } catch (error) {
      if (attempt >= retries || !isMissingReceiverError(error)) {
        throw error;
      }
      attempt += 1;
      await sleep(250);
    }
  }
};

sidePanelProto.getSendableContextHistory = function getSendableContextHistory() {
  return sanitizeForMessaging(this.contextHistory || []);
};
