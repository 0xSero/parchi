import { ACCOUNT_MODE_KEY, ACCOUNT_MODE_PAID, hasConfiguredByokProvider } from './account-mode.js';

export const MANAGED_PROFILE_NAME = 'parchi-managed';
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

export const hasRunnableExternalProfile = (profile: Record<string, any> | null | undefined) => {
  if (!hasConfiguredModel(profile)) return false;
  const provider = String(profile?.provider || '')
    .trim()
    .toLowerCase();
  if (!provider || isManagedProvider(provider)) return false;
  if (isOAuthProvider(provider)) return true;
  return hasConfiguredApiKey(profile);
};

export const hasRunnableByokProfile = (profiles: Array<Record<string, any>>) =>
  profiles.some((profile) => hasRunnableExternalProfile(profile));

export const collectCandidateProfiles = (stored: Record<string, any>) => {
  const configs = isRecord(stored.configs) ? stored.configs : {};
  const configProfiles = Object.values(configs).filter((profile) => isRecord(profile)) as Array<Record<string, any>>;
  const topLevelProfile = {
    provider: stored.provider,
    apiKey: stored.apiKey,
    model: stored.model,
    customEndpoint: stored.customEndpoint,
  };
  return [...configProfiles, topLevelProfile];
};

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

export const buildSpendSeries = (transactions: any[], days = 7) => {
  const now = Date.now();
  const points: Array<{ key: number; label: string; cents: number }> = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now - offset * 24 * 60 * 60 * 1000);
    const key = dayStartMs(date.getTime());
    const label = date.toLocaleDateString([], { weekday: 'short' }).slice(0, 1);
    points.push({ key, label, cents: 0 });
  }

  const byDay = new Map(points.map((point) => [point.key, point]));
  for (const transaction of Array.isArray(transactions) ? transactions : []) {
    const direction = String(transaction?.direction || '').toLowerCase();
    const status = String(transaction?.status || '').toLowerCase();
    if (direction !== 'debit' || status === 'denied') continue;
    const amountCents = Math.max(0, Number(transaction?.amountCents ?? 0));
    const createdAtMs = normalizeTimestampMs(transaction?.createdAt);
    if (!amountCents || !createdAtMs) continue;
    const dayKey = dayStartMs(createdAtMs);
    const point = byDay.get(dayKey);
    if (point) point.cents += amountCents;
  }

  return points;
};

export const renderLedgerRows = (container: HTMLElement | null | undefined, transactions: any[]) => {
  if (!container) return;
  container.innerHTML = '';
  if (!Array.isArray(transactions) || transactions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'account-ledger-empty';
    empty.textContent = 'No transactions yet.';
    container.appendChild(empty);
    return;
  }

  transactions.slice(0, 12).forEach((transaction) => {
    const amountCents = Number(transaction?.amountCents ?? 0);
    const direction = String(transaction?.direction || 'debit') === 'credit' ? 'credit' : 'debit';
    const row = document.createElement('div');
    row.className = 'account-ledger-row';

    const time = document.createElement('div');
    time.className = 'account-ledger-time';
    time.textContent = toTimestampLabel(Number(transaction?.createdAt ?? 0));

    const main = document.createElement('div');
    main.className = 'account-ledger-main';
    const type = document.createElement('div');
    type.className = 'account-ledger-type';
    type.textContent = toReadableTransactionType(String(transaction?.type || 'unknown'));
    const status = String(transaction?.status || '').toUpperCase();
    const provider = String(transaction?.provider || '').trim();
    const tokenActual = Number(transaction?.tokenActual ?? 0);
    const tokenEstimate = Number(transaction?.tokenEstimate ?? 0);
    const tokenPart = tokenActual > 0 ? `${tokenActual} tokens` : tokenEstimate > 0 ? `~${tokenEstimate} tokens` : '';
    const providerPart = provider ? provider : '';
    const meta = [status, providerPart, tokenPart].filter((part) => part.length > 0).join(' · ');
    const metaRow = document.createElement('div');
    metaRow.className = 'account-ledger-meta';
    metaRow.textContent = meta || ' ';
    main.appendChild(type);
    main.appendChild(metaRow);

    const amount = document.createElement('div');
    amount.className = `account-ledger-amount ${direction}`;
    amount.textContent = formatSignedCurrency(amountCents, direction);

    row.appendChild(time);
    row.appendChild(main);
    row.appendChild(amount);
    container.appendChild(row);
  });
};

export const renderSpendBars = (
  container: HTMLElement | null | undefined,
  points: Array<{ key: number; label: string; cents: number }>,
) => {
  if (!container) return;
  container.innerHTML = '';
  const maxCents = points.reduce((max, point) => Math.max(max, point.cents), 0);
  points.forEach((point) => {
    const bar = document.createElement('div');
    bar.className = 'account-spend-bar';
    const fill = document.createElement('span');
    fill.className = 'account-spend-bar-fill';
    const ratio = maxCents > 0 ? point.cents / maxCents : 0;
    const heightPercent = point.cents > 0 ? Math.max(8, Math.round(ratio * 100)) : 4;
    fill.style.height = `${heightPercent}%`;
    fill.title = `${new Date(point.key).toLocaleDateString()}: ${formatCreditBalance(point.cents)}`;
    const label = document.createElement('span');
    label.className = 'account-spend-bar-label';
    label.textContent = point.label;
    bar.appendChild(fill);
    bar.appendChild(label);
    container.appendChild(bar);
  });
};

export const renderUsageCharts = (
  ui: any,
  options: {
    transactions: any[];
    usage: any;
  },
) => {
  const transactions = Array.isArray(options.transactions) ? options.transactions : [];
  const usage = options.usage || {};

  const cutoff30d = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let debit30d = 0;
  let credit30d = 0;
  for (const transaction of transactions) {
    const createdAtMs = normalizeTimestampMs(transaction?.createdAt);
    if (!createdAtMs || createdAtMs < cutoff30d) continue;
    const amountCents = Math.max(0, Number(transaction?.amountCents ?? 0));
    if (!amountCents) continue;
    const direction = String(transaction?.direction || '').toLowerCase();
    const status = String(transaction?.status || '').toLowerCase();
    if (direction === 'credit') {
      credit30d += amountCents;
    } else if (direction === 'debit' && status !== 'denied') {
      debit30d += amountCents;
    }
  }

  const flowTotal = Math.max(1, debit30d + credit30d);
  const debitWidth = clampPercent((debit30d / flowTotal) * 100);
  const creditWidth = clampPercent((credit30d / flowTotal) * 100);
  if (ui.elements.accountCreditDebitFill) {
    ui.elements.accountCreditDebitFill.style.width = `${debitWidth}%`;
  }
  if (ui.elements.accountCreditCreditFill) {
    ui.elements.accountCreditCreditFill.style.width = `${creditWidth}%`;
  }
  if (ui.elements.accountCreditFlowLabel) {
    ui.elements.accountCreditFlowLabel.textContent = `${formatCreditBalance(debit30d)} / ${formatCreditBalance(credit30d)}`;
  }

  const spendSeries = buildSpendSeries(transactions, 7);
  const spendTotal = spendSeries.reduce((sum, point) => sum + point.cents, 0);
  renderSpendBars(ui.elements.accountSpend7dChart, spendSeries);
  if (ui.elements.accountSpend7dTotal) {
    ui.elements.accountSpend7dTotal.textContent = formatCreditBalance(spendTotal);
  }

  const requestCount = Math.max(0, Number(usage?.requestCount || 0));
  const tokensUsed = Math.max(0, Number(usage?.tokensUsed || 0));
  const requestDensity = clampPercent((Math.log10(requestCount + 1) / 3) * 100);
  const tokenDensity = clampPercent((Math.log10(tokensUsed + 1) / 6) * 100);

  if (ui.elements.accountRequestDensityFill) {
    ui.elements.accountRequestDensityFill.style.width = `${requestCount > 0 ? Math.max(6, requestDensity) : 0}%`;
  }
  if (ui.elements.accountTokenDensityFill) {
    ui.elements.accountTokenDensityFill.style.width = `${tokensUsed > 0 ? Math.max(6, tokenDensity) : 0}%`;
  }
  if (ui.elements.accountDensityLabel) {
    ui.elements.accountDensityLabel.textContent = `${requestCount} req / ${tokensUsed} tok`;
  }
};
