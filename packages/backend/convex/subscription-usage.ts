import { v } from 'convex/values';
import { mutation } from './_generated/server.js';
import { currentMonthKey, normalizeTokens } from './subscription-utils.js';

export const recordUsage = mutation({
  args: {
    userId: v.id('users'),
    requestCountIncrement: v.optional(v.number()),
    tokenEstimate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const month = currentMonthKey();
    const increment = Math.max(0, Math.floor(Number(args.requestCountIncrement || 1)));
    const tokens = Math.max(0, normalizeTokens(Number(args.tokenEstimate || 0)));

    const existing = await ctx.db
      .query('usage')
      .withIndex('by_userId_month', (q) => q.eq('userId', args.userId).eq('month', month))
      .first();

    if (existing?._id) {
      await ctx.db.patch(existing._id, {
        requestCount: Number(existing.requestCount || 0) + increment,
        tokensUsed: Number(existing.tokensUsed || 0) + tokens,
      });
      return ctx.db.get(existing._id);
    }

    const createdId = await ctx.db.insert('usage', {
      userId: args.userId,
      month,
      requestCount: increment,
      tokensUsed: tokens,
    });
    return ctx.db.get(createdId);
  },
});

export const adjustUsageTokens = mutation({
  args: {
    userId: v.id('users'),
    tokenDelta: v.number(),
  },
  handler: async (ctx, args) => {
    const month = currentMonthKey();
    const delta = normalizeTokens(args.tokenDelta);
    if (delta === 0) return null;

    const existing = await ctx.db
      .query('usage')
      .withIndex('by_userId_month', (q) => q.eq('userId', args.userId).eq('month', month))
      .first();

    if (!existing?._id) {
      const createdId = await ctx.db.insert('usage', {
        userId: args.userId,
        month,
        requestCount: 0,
        tokensUsed: Math.max(0, delta),
      });
      return ctx.db.get(createdId);
    }

    const nextTokens = Math.max(0, normalizeTokens(Number(existing.tokensUsed || 0) + delta));
    await ctx.db.patch(existing._id, { tokensUsed: nextTokens });
    return ctx.db.get(existing._id);
  },
});
