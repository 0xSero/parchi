import {
  clampPercent,
  formatCreditBalance,
  formatSignedCurrency,
  normalizeTimestampMs,
  toReadableTransactionType,
  toTimestampLabel,
} from './account-formatters.js';
import { buildSpendSeries } from './account-spend.js';

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
