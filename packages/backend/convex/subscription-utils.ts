import { v } from 'convex/values';

export const currentMonthKey = () => {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${now.getUTCFullYear()}-${month}`;
};

export const normalizeTokens = (value: number) => {
  const amount = Math.floor(Number(value));
  if (!Number.isFinite(amount)) return 0;
  return amount;
};

export const userIdValidator = v.id('users');
