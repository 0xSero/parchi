import { v } from 'convex/values';
import { mutation } from './_generated/server.js';
import { insertCreditTransaction, normalizeCents } from './subscription-utils.js';

export { settleReservedCredits } from './subscription-settlement.js';

export const reserveCredits = mutation({
  args: {
    userId: v.id('users'),
    amountCents: v.number(),
    requestId: v.string(),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    tokenEstimate: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const amountCents = normalizeCents(args.amountCents);
    if (amountCents <= 0) {
      return { success: false, remainingCents: 0 };
    }

    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();
    const currentBalance = normalizeCents(existing?.creditBalanceCents ?? 0);
    if (currentBalance < amountCents || !existing?._id) {
      return { success: false, remainingCents: currentBalance };
    }

    const newBalance = normalizeCents(currentBalance - amountCents);
    await ctx.db.patch(existing._id, { creditBalanceCents: newBalance });
    await insertCreditTransaction(ctx, {
      userId: args.userId,
      direction: 'debit',
      type: 'proxy_reservation',
      status: 'reserved',
      amountCents,
      balanceAfterCents: newBalance,
      requestId: args.requestId,
      provider: args.provider,
      model: args.model,
      tokenEstimate: args.tokenEstimate,
      note: args.note || 'Reserved credits before proxy call',
    });
    return { success: true, remainingCents: newBalance };
  },
});

export const releaseReservedCredits = mutation({
  args: {
    userId: v.id('users'),
    requestId: v.string(),
    amountCents: v.number(),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    tokenEstimate: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const amountCents = normalizeCents(args.amountCents);
    if (amountCents <= 0) {
      const existingBalance = await ctx.db
        .query('subscriptions')
        .withIndex('by_userId', (q) => q.eq('userId', args.userId))
        .first();
      return {
        success: true,
        creditBalanceCents: normalizeCents(existingBalance?.creditBalanceCents ?? 0),
      };
    }

    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();

    const currentBalance = normalizeCents(existing?.creditBalanceCents ?? 0);
    const nextBalance = normalizeCents(currentBalance + amountCents);
    if (existing?._id) {
      await ctx.db.patch(existing._id, { creditBalanceCents: nextBalance });
    } else {
      await ctx.db.insert('subscriptions', {
        userId: args.userId,
        plan: 'free',
        status: 'inactive',
        creditBalanceCents: nextBalance,
      });
    }

    const reservation = await ctx.db
      .query('creditTransactions')
      .withIndex('by_requestId', (q) => q.eq('requestId', args.requestId))
      .first();
    if (reservation?._id && reservation.status === 'reserved') {
      await ctx.db.patch(reservation._id, {
        status: 'voided',
        note: args.note || reservation.note || 'Reservation released',
      });
    }

    await insertCreditTransaction(ctx, {
      userId: args.userId,
      direction: 'credit',
      type: 'proxy_refund',
      status: 'posted',
      amountCents,
      balanceAfterCents: nextBalance,
      requestId: args.requestId,
      provider: args.provider,
      model: args.model,
      tokenEstimate: args.tokenEstimate,
      note: args.note || 'Reservation released after failed request',
    });

    return {
      success: true,
      creditBalanceCents: nextBalance,
    };
  },
});
