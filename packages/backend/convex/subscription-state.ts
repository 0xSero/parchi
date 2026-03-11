import { v } from 'convex/values';
import { mutation } from './_generated/server.js';

export const upsertForUser = mutation({
  args: {
    userId: v.id('users'),
    plan: v.union(v.literal('free'), v.literal('pro')),
    status: v.union(v.literal('active'), v.literal('canceled'), v.literal('past_due'), v.literal('inactive')),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();

    if (existing?._id) {
      await ctx.db.patch(existing._id, {
        plan: args.plan,
        status: args.status,
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        currentPeriodEnd: args.currentPeriodEnd,
      });
      return ctx.db.get(existing._id);
    }

    const createdId = await ctx.db.insert('subscriptions', {
      userId: args.userId,
      plan: args.plan,
      status: args.status,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      currentPeriodEnd: args.currentPeriodEnd,
    });
    return ctx.db.get(createdId);
  },
});

export const markInactiveForUser = mutation({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();
    if (!existing?._id) return null;
    await ctx.db.patch(existing._id, {
      plan: 'free',
      status: 'inactive',
      stripeSubscriptionId: undefined,
      currentPeriodEnd: undefined,
    });
    return ctx.db.get(existing._id);
  },
});
