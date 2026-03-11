import { ACCOUNT_MODE_KEY } from './account-mode.js';

export const PARCHI_PAID_DEFAULT_MODEL = 'moonshotai/kimi-k2.5';
export const LEGACY_MANAGED_DEFAULT_MODEL = 'openai/gpt-4o-mini';
export const PARCHI_RUNTIME_STATUS_KEY = 'parchiRuntimeStatus';
export const PARCHI_RUNTIME_STATUS_TTL_MS = 30 * 60 * 1000;
export const CREDIT_REFRESH_POLL_MS = 5000;
export const CREDIT_REFRESH_ATTEMPTS = 24;

export const ACCOUNT_SETUP_STORAGE_KEYS = [
  ACCOUNT_MODE_KEY,
  'configs',
  'activeConfig',
  'provider',
  'apiKey',
  'model',
  'customEndpoint',
  'convexUrl',
  'convexAccessToken',
  'convexCreditBalanceCents',
  'convexSubscriptionPlan',
  'convexSubscriptionStatus',
  PARCHI_RUNTIME_STATUS_KEY,
] as const;

export const setHidden = (element: Element | null | undefined, hidden: boolean) => {
  if (!element) return;
  element.classList.toggle('hidden', hidden);
};

export const toUsageLabel = (usage: unknown) => {
  const u = usage as { requestCount?: unknown; tokensUsed?: unknown };
  const requestCount = Number(u?.requestCount || 0);
  const tokensUsed = Number(u?.tokensUsed || 0);
  return `${requestCount} req · ${tokensUsed} tokens`;
};

export const formatCreditBalance = (cents: number) => {
  const dollars = (cents / 100).toFixed(2);
  return `$${dollars}`;
};

export const formatSignedCurrency = (cents: number, direction: 'credit' | 'debit') => {
  const sign = direction === 'credit' ? '+' : '-';
  return `${sign}${formatCreditBalance(cents)}`;
};

export const toReadableTransactionType = (type: string) =>
  String(type || '')
    .replace(/^proxy_/, 'proxy ')
    .replace(/^stripe_/, 'stripe ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

export const toTimestampLabel = (timestamp: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '-';
  try {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } catch {
    return '-';
  }
};

export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

export const normalizeManagedModelId = (modelId: string) => {
  let model = String(modelId || '').trim();
  if (/^(parchi|openrouter)\//i.test(model)) {
    const parts = model.split('/');
    if (parts.length >= 2) {
      model = parts.slice(1).join('/');
    }
  }
  if (!model) return PARCHI_PAID_DEFAULT_MODEL;
  if (model.includes('/')) return model;
  const lower = model.toLowerCase();
  if (lower.startsWith('gpt-') || lower.startsWith('o1') || lower.startsWith('o3') || lower.startsWith('o4')) {
    return `openai/${model}`;
  }
  if (lower.startsWith('claude')) return `anthropic/${model}`;
  if (lower.startsWith('gemini')) return `google/${model}`;
  if (lower.startsWith('deepseek')) return `deepseek/${model}`;
  if (lower.startsWith('qwen')) return `qwen/${model}`;
  if (lower.includes('llama')) return `meta-llama/${model}`;
  return model;
};

export const hasConfiguredModel = (profile: Record<string, any> | null | undefined) =>
  Boolean(String(profile?.model || '').trim());

export const hasConfiguredApiKey = (profile: Record<string, any> | null | undefined) =>
  Boolean(String(profile?.apiKey || '').trim());

export const isOAuthProvider = (provider: unknown) =>
  String(provider || '')
    .trim()
    .toLowerCase()
    .endsWith('-oauth');

export const isManagedProvider = (provider: unknown) => {
  const normalized = String(provider || '')
    .trim()
    .toLowerCase();
  return normalized === 'parchi' || normalized === 'openrouter';
};

export const updateStatusCopy = (ui: any, text: string) => {
  if (ui.elements.accountStatusText) {
    ui.elements.accountStatusText.textContent = text;
  }
  const signedInStatus = document.getElementById('accountStatusTextSignedIn');
  if (signedInStatus) {
    signedInStatus.textContent = text;
  }
};

export const clampPercent = (value: number) => Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

export const normalizeTimestampMs = (value: unknown) => {
  const raw = Number(value || 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw > 10_000_000_000 ? raw : raw * 1000;
};

export const dayStartMs = (value: number) => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};
