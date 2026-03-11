import { getAuthUserId } from '@convex-dev/auth/server';
import { actionGeneric, anyApi } from 'convex/server';
import { baseSiteUrl, getStripeClient } from './stripe-utils.js';

export const createCheckoutSession = actionGeneric(async (ctx) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error('Unauthorized');

  const stripePriceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!stripePriceId) {
    throw new Error('Missing STRIPE_PRO_PRICE_ID');
  }

  const stripe = getStripeClient();
  const user = await ctx.runQuery(anyApi.users.me, {});
  const existing = await ctx.runQuery(anyApi.subscriptions.getByUserId, { userId });

  let customerId = existing?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user?.email || undefined,
      metadata: {
        convexUserId: String(userId),
      },
    });
    customerId = customer.id;
  }

  const siteUrl = baseSiteUrl();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: `${siteUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/billing/cancel`,
    metadata: {
      userId: String(userId),
    },
    allow_promotion_codes: true,
  });

  await ctx.runMutation(anyApi.subscriptions.upsertForUser, {
    userId,
    plan: existing?.plan || 'free',
    status: existing?.status || 'inactive',
    stripeCustomerId: customerId,
    stripeSubscriptionId: existing?.stripeSubscriptionId,
    currentPeriodEnd: existing?.currentPeriodEnd,
  });

  return {
    id: session.id,
    url: session.url,
  };
});

export const manageSubscription = actionGeneric(async (ctx) => {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error('Unauthorized');

  const stripe = getStripeClient();
  const existing = await ctx.runQuery(anyApi.subscriptions.getByUserId, { userId });

  if (!existing?.stripeCustomerId) {
    return ctx.runAction(anyApi.payments.createCheckoutSession, {});
  }

  const siteUrl = baseSiteUrl();
  const portal = await stripe.billingPortal.sessions.create({
    customer: existing.stripeCustomerId,
    return_url: `${siteUrl}/billing`,
  });

  return { url: portal.url };
});
