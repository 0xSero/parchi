import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  ...authTables,

  subscriptions: defineTable({
    userId: v.id('users'),
    plan: v.union(v.literal('free'), v.literal('pro')),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    status: v.union(v.literal('active'), v.literal('canceled'), v.literal('past_due'), v.literal('inactive')),
    currentPeriodEnd: v.optional(v.number()),
  })
    .index('by_userId', ['userId'])
    .index('by_stripeCustomerId', ['stripeCustomerId'])
    .index('by_stripeSubscriptionId', ['stripeSubscriptionId']),

  usage: defineTable({
    userId: v.id('users'),
    month: v.string(),
    requestCount: v.number(),
    tokensUsed: v.number(),
  }).index('by_userId_month', ['userId', 'month']),
});
