// AI Proxy Credits - Credit handling for AI proxy

import { anyApi } from 'convex/server';
import { costFromTokens, toSafeInt } from './ai-proxy-utils.js';

export interface CreditHandlerParams {
  userId: string;
  requestId: string;
  estimatedTokens: number;
  estimatedCostCents: number;
  provider: string;
  settledModel: string;
  shouldTrackCredits: boolean;
}

export interface CreditHandlers {
  settleCredits: (actualTokens: number, note: string) => Promise<number | null>;
  releaseCredits: (note: string) => Promise<void>;
}

// Factory function to create credit handlers with closure state
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createCreditHandlers(
  ctx: { runMutation: (...args: any[]) => Promise<unknown> },
  params: CreditHandlerParams,
): CreditHandlers {
  const { userId, requestId, estimatedTokens, estimatedCostCents, provider, settledModel, shouldTrackCredits } = params;
  let settledOrReleased = false;

  const settleCredits = async (actualTokens: number, note: string): Promise<number | null> => {
    if (!shouldTrackCredits || settledOrReleased) return null;
    settledOrReleased = true;
    const finalTokens = Math.max(0, toSafeInt(actualTokens));
    const finalCostCents = costFromTokens(finalTokens);
    try {
      await ctx.runMutation(anyApi.subscriptions.settleReservedCredits, {
        userId,
        requestId,
        reservedAmountCents: estimatedCostCents,
        finalAmountCents: finalCostCents,
        provider,
        model: settledModel,
        tokenEstimate: estimatedTokens,
        tokenActual: finalTokens,
        note,
      });
      const tokenDelta = finalTokens - estimatedTokens;
      if (tokenDelta !== 0) {
        await ctx.runMutation(anyApi.subscriptions.adjustUsageTokens, {
          userId,
          tokenDelta,
        });
      }
    } catch (error) {
      console.error('[aiProxy] Failed to settle credits', { requestId, note, error });
    }
    return finalCostCents;
  };

  const releaseCredits = async (note: string): Promise<void> => {
    if (!shouldTrackCredits || settledOrReleased) return;
    settledOrReleased = true;
    try {
      await ctx.runMutation(anyApi.subscriptions.releaseReservedCredits, {
        userId,
        requestId,
        amountCents: estimatedCostCents,
        provider,
        model: settledModel,
        tokenEstimate: estimatedTokens,
        note,
      });
      await ctx.runMutation(anyApi.subscriptions.adjustUsageTokens, {
        userId,
        tokenDelta: -estimatedTokens,
      });
    } catch (error) {
      console.error('[aiProxy] Failed to release credits', { requestId, note, error });
    }
  };

  return { settleCredits, releaseCredits };
}
