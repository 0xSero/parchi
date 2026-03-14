import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { query } from './_generated/server.js';
import { currentMonthKey } from './subscription-utils.js';

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

    return {
      ...(subscription || {
        userId,
        plan: 'free',
        status: 'inactive',
      }),
      usage: usage || {
        requestCount: 0,
        tokensUsed: 0,
        month: currentMonthKey(),
      },
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
