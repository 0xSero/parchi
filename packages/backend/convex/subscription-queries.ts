import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { query } from './_generated/server.js';
import { currentMonthKey, currentMonthStartMs, normalizeCents } from './subscription-utils.js';

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first();

    const usage = await ctx.db
      .query('usage')
      .withIndex('by_userId_month', (q) => q.eq('userId', userId).eq('month', currentMonthKey()))
      .first();

    const transactions = await ctx.db
      .query('creditTransactions')
      .withIndex('by_userId_createdAt', (q) => q.eq('userId', userId))
      .order('desc')
      .take(120);

    const monthStartMs = currentMonthStartMs();
    let monthDebitCents = 0;
    let monthRefundCents = 0;
    let monthPurchasedCents = 0;

    for (const tx of transactions) {
      if (Number(tx?.createdAt || 0) < monthStartMs) continue;
      const amount = normalizeCents(Number(tx?.amountCents || 0));
      if (tx.direction === 'debit' && tx.status !== 'denied' && tx.status !== 'voided') {
        monthDebitCents += amount;
      }
      if (tx.direction === 'credit' && String(tx.type || '').includes('refund')) {
        monthRefundCents += amount;
      }
      if (tx.direction === 'credit' && String(tx.type || '') === 'stripe_credit_purchase') {
        monthPurchasedCents += amount;
      }
    }

    return {
      ...(subscription || {
        userId,
        plan: 'free',
        status: 'inactive',
      }),
      creditBalanceCents: subscription?.creditBalanceCents ?? 0,
      usage: usage || {
        requestCount: 0,
        tokensUsed: 0,
        month: currentMonthKey(),
      },
      cost: {
        month: currentMonthKey(),
        debitCents: monthDebitCents,
        refundedCents: monthRefundCents,
        netSpendCents: Math.max(0, monthDebitCents - monthRefundCents),
        purchasedCents: monthPurchasedCents,
      },
      recentTransactions: transactions.slice(0, 30).map((tx) => ({
        createdAt: tx.createdAt,
        direction: tx.direction,
        type: tx.type,
        status: tx.status,
        amountCents: tx.amountCents,
        balanceAfterCents: tx.balanceAfterCents,
        requestId: tx.requestId,
        provider: tx.provider,
        model: tx.model,
        tokenEstimate: tx.tokenEstimate,
        tokenActual: tx.tokenActual,
        note: tx.note,
      })),
    };
  },
});

export const getByUserId = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    if (authUserId && String(authUserId) !== String(args.userId)) {
      throw new Error('Unauthorized');
    }
    return ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();
  },
});

export const getByStripeCustomerId = query({
  args: {
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('subscriptions')
      .withIndex('by_stripeCustomerId', (q) => q.eq('stripeCustomerId', args.stripeCustomerId))
      .first();
  },
});

export const getByStripeSubscriptionId = query({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('subscriptions')
      .withIndex('by_stripeSubscriptionId', (q) => q.eq('stripeSubscriptionId', args.stripeSubscriptionId))
      .first();
  },
});

export const getBalance = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { creditBalanceCents: 0 };

    const subscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .first();

    return { creditBalanceCents: subscription?.creditBalanceCents ?? 0 };
  },
});
