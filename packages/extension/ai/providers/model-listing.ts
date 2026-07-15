import { resolveModelCapabilities } from './model-capabilities.js';
import type { ModelEntry } from './types.js';

const MODEL_FETCH_TIMEOUT = 8000;

export async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function extractModelEntries(payload: unknown, providerKey?: string): ModelEntry[] {
  if (!payload) return [];
  const p = payload as { data?: unknown; models?: unknown };
  const source = Array.isArray(p.data)
    ? p.data
    : Array.isArray(p.models)
      ? p.models
      : Array.isArray(payload)
        ? payload
        : [];

  const withVision = (base: ModelEntry): ModelEntry => {
    if (!providerKey) return base;
    const { supportsVision } = resolveModelCapabilities(providerKey, base.id);
    return supportsVision ? { ...base, supportsVision: true } : base;
  };

  const out: ModelEntry[] = [];
  for (const entry of source) {
    if (typeof entry === 'string') {
      const id = entry.trim();
      if (id) out.push(withVision({ id }));
      continue;
    }

    if (entry && typeof entry === 'object') {
      const e = entry as {
        id?: unknown;
        slug?: unknown;
        name?: unknown;
        display_name?: unknown;
        context_length?: unknown;
        contextWindow?: unknown;
      };
      const id = typeof e.id === 'string' ? e.id.trim() : typeof e.slug === 'string' ? e.slug.trim() : '';
      if (!id) continue;
      out.push(
        withVision({
          id,
          label: typeof e.display_name === 'string' ? e.display_name : typeof e.name === 'string' ? e.name : id,
          contextWindow:
            typeof e.context_length === 'number'
              ? e.context_length
              : typeof e.contextWindow === 'number'
                ? e.contextWindow
                : undefined,
        }),
      );
    }
  }
  return out;
}
