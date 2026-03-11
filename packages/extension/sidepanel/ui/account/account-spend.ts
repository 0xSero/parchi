import { dayStartMs, normalizeTimestampMs } from './account-formatters.js';

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
