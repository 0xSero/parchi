import { v } from 'convex/values';
import { mutation } from './_generated/server.js';
import { insertCreditTransaction, normalizeCents } from './subscription-utils.js';

export const settleReservedCredits = mutation({
  args: {
    userId: v.id('users'),
    requestId: v.string(),
    reservedAmountCents: v.number(),
    finalAmountCents: v.number(),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    tokenEstimate: v.optional(v.number()),
    tokenActual: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const reservedAmountCents = normalizeCents(args.reservedAmountCents);
    const finalAmountCents = normalizeCents(args.finalAmountCents);
    if (reservedAmountCents <= 0) {
      return {
        success: false,
        creditBalanceCents: 0,
        chargedAdditionalCents: 0,
        refundedCents: 0,
        shortfallCents: 0,
      };
    }

    const existing = await ctx.db
      .query('subscriptions')
      .withIndex('by_userId', (q) => q.eq('userId', args.userId))
      .first();
    if (!existing?._id) {
      return {
        success: false,
        creditBalanceCents: 0,
        chargedAdditionalCents: 0,
        refundedCents: 0,
        shortfallCents: 0,
      };
    }

    const reservation = await ctx.db
      .query('creditTransactions')
      .withIndex('by_requestId', (q) => q.eq('requestId', args.requestId))
      .first();
    if (reservation?._id && reservation.status !== 'reserved') {
      return {
        success: true,
        creditBalanceCents: normalizeCents(existing.creditBalanceCents ?? 0),
        chargedAdditionalCents: 0,
        refundedCents: 0,
        shortfallCents: 0,
      };
    }

    let balance = normalizeCents(existing.creditBalanceCents ?? 0);
    let chargedAdditionalCents = 0;
    let refundedCents = 0;
    let shortfallCents = 0;

    if (finalAmountCents < reservedAmountCents) {
      refundedCents = reservedAmountCents - finalAmountCents;
      balance = normalizeCents(balance + refundedCents);
      await ctx.db.patch(existing._id, { creditBalanceCents: balance });
      await insertCreditTransaction(ctx, {
        userId: args.userId,
        direction: 'credit',
        type: 'proxy_settlement_refund',
        status: 'posted',
        amountCents: refundedCents,
        balanceAfterCents: balance,
        requestId: args.requestId,
        provider: args.provider,
        model: args.model,
        tokenEstimate: args.tokenEstimate,
        tokenActual: args.tokenActual,
        note: args.note || 'Refunded reserved credits after settlement',
      });
    } else if (finalAmountCents > reservedAmountCents) {
      const additionalCents = finalAmountCents - reservedAmountCents;
      chargedAdditionalCents = Math.min(additionalCents, balance);
      shortfallCents = Math.max(0, additionalCents - chargedAdditionalCents);
      if (chargedAdditionalCents > 0) {
        balance = normalizeCents(balance - chargedAdditionalCents);
        await ctx.db.patch(existing._id, { creditBalanceCents: balance });
        await insertCreditTransaction(ctx, {
          userId: args.userId,
          direction: 'debit',
          type: 'proxy_settlement_debit',
          status: 'posted',
          amountCents: chargedAdditionalCents,
          balanceAfterCents: balance,
          requestId: args.requestId,
          provider: args.provider,
          model: args.model,
          tokenEstimate: args.tokenEstimate,
          tokenActual: args.tokenActual,
          note: args.note || 'Charged additional credits after settlement',
        });
      }
      if (shortfallCents > 0) {
        await insertCreditTransaction(ctx, {
          userId: args.userId,
          direction: 'debit',
          type: 'proxy_settlement_shortfall',
          status: 'denied',
          amountCents: shortfallCents,
          balanceAfterCents: balance,
          requestId: args.requestId,
          provider: args.provider,
          model: args.model,
          tokenEstimate: args.tokenEstimate,
          tokenActual: args.tokenActual,
          note: 'Settlement shortfall: insufficient credits for full final charge',
        });
      }
    }

    if (reservation?._id && reservation.status === 'reserved') {
      await ctx.db.patch(reservation._id, {
        status: 'posted',
        tokenActual: args.tokenActual,
        note: args.note || reservation.note || 'Reservation settled',
      });
    }

    return {
      success: true,
      creditBalanceCents: balance,
      chargedAdditionalCents,
      refundedCents,
      shortfallCents,
    };
  },
});
