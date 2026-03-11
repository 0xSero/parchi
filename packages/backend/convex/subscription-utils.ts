import type { GenericMutationCtx } from 'convex/server';
import { v } from 'convex/values';
import type { DataModel, Id } from './_generated/dataModel.js';

export const currentMonthKey = () => {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${now.getUTCFullYear()}-${month}`;
};

export const currentMonthStartMs = () => {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0);
};

export const normalizeCents = (value: number) => {
  const amount = Math.floor(Number(value));
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return amount;
};

export const normalizeTokens = (value: number) => {
  const amount = Math.floor(Number(value));
  if (!Number.isFinite(amount)) return 0;
  return amount;
};

export const insertCreditTransaction = async (
  ctx: GenericMutationCtx<DataModel>,
  args: {
    userId: Id<'users'>;
    direction: 'credit' | 'debit';
    type: string;
    status: 'posted' | 'reserved' | 'voided' | 'denied';
    amountCents: number;
    balanceAfterCents: number;
    requestId?: string;
    provider?: string;
    model?: string;
    tokenEstimate?: number;
    tokenActual?: number;
    note?: string;
    stripeCheckoutSessionId?: string;
    stripeEventId?: string;
  },
) =>
  ctx.db.insert('creditTransactions', {
    userId: args.userId,
    createdAt: Date.now(),
    direction: args.direction,
    type: args.type,
    status: args.status,
    amountCents: normalizeCents(args.amountCents),
    balanceAfterCents: normalizeCents(args.balanceAfterCents),
    requestId: args.requestId,
    provider: args.provider,
    model: args.model,
    tokenEstimate: args.tokenEstimate,
    tokenActual: args.tokenActual,
    note: args.note,
    stripeCheckoutSessionId: args.stripeCheckoutSessionId,
    stripeEventId: args.stripeEventId,
  });

export const userIdValidator = v.id('users');
