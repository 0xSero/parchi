// AI Proxy Utilities - Helper functions for AI proxy functionality

import { CHARS_PER_TOKEN_ESTIMATE, COST_CENTS_PER_TOKEN, MIN_REQUEST_COST_CENTS } from './ai-proxy-config.js';

export const createRequestId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const toSafeInt = (value: unknown) => {
  const next = Math.floor(Number(value));
  if (!Number.isFinite(next) || next < 0) return 0;
  return next;
};

export const costFromTokens = (tokens: number) => {
  const tokenCount = Math.max(0, toSafeInt(tokens));
  if (tokenCount === 0) return MIN_REQUEST_COST_CENTS;
  return Math.max(MIN_REQUEST_COST_CENTS, Math.ceil(tokenCount * COST_CENTS_PER_TOKEN));
};

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

export const estimatePromptTokens = (payload: Record<string, unknown>) => {
  const source = payload.messages ?? payload.input ?? payload.prompt ?? payload;
  try {
    const serialized = typeof source === 'string' ? source : JSON.stringify(source);
    return Math.ceil(String(serialized || '').length / CHARS_PER_TOKEN_ESTIMATE);
  } catch {
    return 0;
  }
};

export const usageObjectToTokenCount = (usage: unknown): number | null => {
  const row = asRecord(usage);
  if (!row) return null;

  const totalTokens = toSafeInt(row.total_tokens ?? row.totalTokens);
  if (totalTokens > 0) return totalTokens;

  const promptTokens = toSafeInt(row.prompt_tokens ?? row.promptTokens ?? row.input_tokens ?? row.inputTokens ?? 0);
  const completionTokens = toSafeInt(
    row.completion_tokens ?? row.completionTokens ?? row.output_tokens ?? row.outputTokens ?? 0,
  );
  const cacheTokens = toSafeInt(row.cache_creation_input_tokens ?? row.cache_read_input_tokens ?? 0);
  const sum = promptTokens + completionTokens + cacheTokens;
  return sum > 0 ? sum : null;
};

export const extractUsageTokens = (payload: unknown): number | null => {
  if (!payload || typeof payload !== 'object') return null;
  const queue: unknown[] = [payload];
  const seen = new Set<object>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (seen.has(current)) continue;
    seen.add(current);

    const currentRecord = asRecord(current);
    const directUsage = usageObjectToTokenCount(currentRecord?.usage);
    if (directUsage !== null) return directUsage;

    const selfUsage = usageObjectToTokenCount(current);
    if (selfUsage !== null) return selfUsage;

    if (Array.isArray(current)) {
      for (const item of current) queue.push(item);
      continue;
    }

    for (const value of Object.values(currentRecord || {})) {
      if (value && typeof value === 'object') queue.push(value);
    }
  }

  return null;
};

export const parseSseUsageTokens = (rawSseText: string) => {
  let usageTokens: number | null = null;
  const lines = rawSseText.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    try {
      const parsed = JSON.parse(data);
      const parsedUsage = extractUsageTokens(parsed);
      if (parsedUsage !== null) usageTokens = parsedUsage;
    } catch {
      // Ignore non-JSON data lines.
    }
  }
  return usageTokens;
};

export const isModelUnavailableError = (status: number, bodyText: string) => {
  if (status !== 400 && status !== 404) return false;
  const combined = String(bodyText || '').toLowerCase();
  return (
    combined.includes('model not found') ||
    combined.includes('not available') ||
    combined.includes('does not exist') ||
    combined.includes('invalid model') ||
    combined.includes('model is unavailable')
  );
};
