import { v } from 'convex/values';
import { mutation } from './_generated/server.js';
import { insertCreditTransaction, normalizeCents } from './subscription-utils.js';

export const addCredits = mutation({
  args: {
    userId: v.id('users'),
    amountCents: v.number(),
  },
  handler: async (ctx, args) => {
    const amountCents = normalizeCents(args.amountCents);
    if (amountCents <= 0) {
      const existingBalance = await ctx.db
        .query('subscriptions')
        .withIndex('by_userId', (q) => q.eq('userId', args.userId))
        .first();
      return { creditBalanceCents: normalizeCents(existingBalance?.creditBalanceCents ?? 0) };
    }

    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();

    if (existing?._id) {
      const newBalance = normalizeCents((existing.creditBalanceCents ?? 0) + amountCents);
      await ctx.db.patch(existing._id, { creditBalanceCents: newBalance });
      await insertCreditTransaction(ctx, {
        userId: args.userId,
        direction: 'credit',
        type: 'manual_credit',
        status: 'posted',
        amountCents,
        balanceAfterCents: newBalance,
      });
      return { creditBalanceCents: newBalance };
    }

    await ctx.db.insert('subscriptions', {
      userId: args.userId,
      plan: 'free',
      status: 'inactive',
      creditBalanceCents: amountCents,
    });
    await insertCreditTransaction(ctx, {
      userId: args.userId,
      direction: 'credit',
      type: 'manual_credit',
      status: 'posted',
      amountCents,
      balanceAfterCents: amountCents,
    });
    return { creditBalanceCents: amountCents };
  },
});

export const applyCreditCheckoutSession = mutation({
  args: {
    userId: v.id('users'),
    stripeCheckoutSessionId: v.string(),
    amountCents: v.number(),
    stripeEventId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const amountCents = normalizeCents(args.amountCents);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw new Error(`Invalid amountCents: ${args.amountCents}`);
    }

    const stripeEventId = args.stripeEventId;
    if (stripeEventId) {
      const existingByEvent = await ctx.db
        .query('stripeCreditPurchases')
        .withIndex('by_eventId', (q) => q.eq('stripeEventId', stripeEventId))
        .first();
      if (existingByEvent) {
        const sub = await ctx.db
          .query('subscriptions')
          .withIndex('by_userId', (q) => q.eq('userId', existingByEvent.userId))
          .first();
        return {
          applied: false,
          alreadyApplied: true,
          creditBalanceCents: sub?.creditBalanceCents ?? 0,
        };
      }
    }

    const existingBySession = await ctx.db
      .query('stripeCreditPurchases')
      .withIndex('by_checkoutSessionId', (q) => q.eq('stripeCheckoutSessionId', args.stripeCheckoutSessionId))
      .first();
    if (existingBySession) {
      const sub = await ctx.db
        .query('subscriptions')
        .withIndex('by_userId', (q) => q.eq('userId', existingBySession.userId))
        .first();
      return {
        applied: false,
        alreadyApplied: true,
        creditBalanceCents: sub?.creditBalanceCents ?? 0,
      };
    }

    const existingSubscription = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();

    const nextBalance = (existingSubscription?.creditBalanceCents ?? 0) + amountCents;
    if (existingSubscription?._id) {
      await ctx.db.patch(existingSubscription._id, { creditBalanceCents: nextBalance });
    } else {
      await ctx.db.insert('subscriptions', {
        userId: args.userId,
        plan: 'free',
        status: 'inactive',
        creditBalanceCents: nextBalance,
      });
    }

    await ctx.db.insert('stripeCreditPurchases', {
      userId: args.userId,
      stripeCheckoutSessionId: args.stripeCheckoutSessionId,
      stripeEventId: args.stripeEventId,
      amountCents,
      creditedAt: Date.now(),
    });

    await insertCreditTransaction(ctx, {
      userId: args.userId,
      direction: 'credit',
      type: 'stripe_credit_purchase',
      status: 'posted',
      amountCents,
      balanceAfterCents: nextBalance,
      stripeCheckoutSessionId: args.stripeCheckoutSessionId,
      stripeEventId: args.stripeEventId,
      note: 'Stripe checkout completed',
    });

    return {
      applied: true,
      alreadyApplied: false,
      creditBalanceCents: nextBalance,
    };
  },
});

export const deductCredits = mutation({
  args: {
    userId: v.id('users'),
    amountCents: v.number(),
  },
  handler: async (ctx, args) => {
    const amountCents = normalizeCents(args.amountCents);
    if (amountCents <= 0) {
      const existingBalance = await ctx.db
        .query('subscriptions')
        .withIndex('by_userId', (q) => q.eq('userId', args.userId))
        .first();
      return { success: true, remainingCents: normalizeCents(existingBalance?.creditBalanceCents ?? 0) };
    }
    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();

    const currentBalance = existing?.creditBalanceCents ?? 0;
    if (currentBalance < amountCents) {
      return { success: false, remainingCents: currentBalance };
    }

    const newBalance = normalizeCents(currentBalance - amountCents);
    if (existing?._id) {
      await ctx.db.patch(existing._id, { creditBalanceCents: newBalance });
      await insertCreditTransaction(ctx, {
        userId: args.userId,
        direction: 'debit',
        type: 'manual_debit',
        status: 'posted',
        amountCents,
        balanceAfterCents: newBalance,
      });
    }
    return { success: true, remainingCents: newBalance };
  },
});
