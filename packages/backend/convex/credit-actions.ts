import { getAuthUserId } from '@convex-dev/auth/server';
import { actionGeneric, anyApi } from 'convex/server';
import type Stripe from 'stripe';
import { baseSiteUrl, getStripeClient, isPaidCheckoutSession, toUserId } from './stripe-utils.js';

export const CREDIT_PACKAGES_CENTS = [500, 1500, 5000] as const;

const applyCreditCheckoutSession = async (
  ctx: {
    runMutation: (api: any, args: any) => Promise<unknown>;
  },
  session: Stripe.Checkout.Session,
  stripeEventId?: string,
) => {
  const metadataUserId = toUserId(session.metadata?.userId);
  const creditAmountCents = Number(session.metadata?.creditAmountCents || 0);
  if (!metadataUserId || creditAmountCents <= 0 || !session.id) {
    return { applied: false, reason: 'missing-credit-metadata' as const };
  }
  if (!isPaidCheckoutSession(session)) {
    return { applied: false, reason: 'session-not-paid' as const };
  }

  const result = (await ctx.runMutation(anyApi.subscriptions.applyCreditCheckoutSession, {
    userId: metadataUserId,
    stripeCheckoutSessionId: session.id,
    amountCents: creditAmountCents,
    stripeEventId,
  })) as { applied?: boolean; alreadyApplied?: boolean } | null;
  return {
    applied: Boolean(result?.applied),
    reason: result?.alreadyApplied ? ('already-applied' as const) : ('applied' as const),
  };
};

export const createCreditCheckoutSession = actionGeneric(async (ctx, args: { packageCents: number }) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error('Unauthorized');

  const packageCents = Number(args.packageCents);
  if (!CREDIT_PACKAGES_CENTS.includes(packageCents as (typeof CREDIT_PACKAGES_CENTS)[number])) {
    throw new Error(
      `Invalid credit package. Choose from: ${CREDIT_PACKAGES_CENTS.map((c) => `$${c / 100}`).join(', ')}`,
    );
  }

  const stripe = getStripeClient();
  const user = await ctx.runQuery(anyApi.users.me, {});
  const existing = await ctx.runQuery(anyApi.subscriptions.getByUserId, { userId });

  let customerId = existing?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user?.email || undefined,
      metadata: { convexUserId: String(userId) },
    });
    customerId = customer.id;
  }

  const siteUrl = baseSiteUrl();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: packageCents,
          product_data: {
            name: `Parchi Credits — $${(packageCents / 100).toFixed(0)}`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${siteUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/billing/cancel`,
    metadata: {
      userId: String(userId),
      creditAmountCents: String(packageCents),
    },
  });

  // Ensure a subscription record exists so the webhook can find it
  if (!existing) {
    await ctx.runMutation(anyApi.subscriptions.upsertForUser, {
      userId,
      plan: 'free',
      status: 'inactive',
      stripeCustomerId: customerId,
    });
  } else if (!existing.stripeCustomerId) {
    await ctx.runMutation(anyApi.subscriptions.upsertForUser, {
      userId,
      plan: existing.plan || 'free',
      status: existing.status || 'inactive',
      stripeCustomerId: customerId,
      stripeSubscriptionId: existing.stripeSubscriptionId,
      currentPeriodEnd: existing.currentPeriodEnd,
    });
  }

  return { id: session.id, url: session.url };
});

export const reconcileCreditPurchases = actionGeneric({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthorized');

    const existing = await ctx.runQuery(anyApi.subscriptions.getByUserId, { userId });
    const customerId = String(existing?.stripeCustomerId || '').trim();
    if (!customerId) {
      return { reconciled: 0, scanned: 0, skipped: 0, reason: 'missing-customer' as const };
    }

    const stripe = getStripeClient();
    const sessions = await stripe.checkout.sessions.list({
      customer: customerId,
      limit: 25,
    });

    let reconciled = 0;
    let skipped = 0;
    for (const session of sessions.data) {
      const metadataUserId = String(session.metadata?.userId || '');
      const creditAmountCents = Number(session.metadata?.creditAmountCents || 0);
      if (metadataUserId !== String(userId) || creditAmountCents <= 0) {
        skipped += 1;
        continue;
      }
      const result = await applyCreditCheckoutSession(ctx, session);
      if (result.applied) {
        reconciled += 1;
      } else {
        skipped += 1;
      }
    }

    return {
      reconciled,
      scanned: sessions.data.length,
      skipped,
    };
  },
});

export { applyCreditCheckoutSession };
