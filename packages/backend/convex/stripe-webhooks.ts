import { anyApi, httpActionGeneric } from 'convex/server';
import type Stripe from 'stripe';
import { getStripeClient, mapStripeStatus, subscriptionCurrentPeriodEndMs, toUserId } from './stripe-utils.js';

const syncSubscriptionRecord = async (ctx: any, subscription: Stripe.Subscription) => {
  const existingBySubscription = subscription.id
    ? await ctx.runQuery(anyApi.subscriptions.getByStripeSubscriptionId, {
        stripeSubscriptionId: subscription.id,
      })
    : null;
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : (subscription.customer as Stripe.Customer | null)?.id || '';
  const existingByCustomer = customerId
    ? await ctx.runQuery(anyApi.subscriptions.getByStripeCustomerId, {
        stripeCustomerId: customerId,
      })
    : null;
  const userId =
    existingBySubscription?.userId || existingByCustomer?.userId || toUserId(subscription.metadata?.userId);
  if (!userId) return;

  const mappedStatus = mapStripeStatus(subscription.status);
  const mappedPlan = mappedStatus === 'active' ? 'pro' : 'free';
  await ctx.runMutation(anyApi.subscriptions.upsertForUser, {
    userId,
    plan: mappedPlan,
    status: mappedStatus,
    stripeCustomerId: customerId || undefined,
    stripeSubscriptionId: subscription.id || undefined,
    currentPeriodEnd: subscriptionCurrentPeriodEndMs(subscription),
  });
};

export const stripeWebhook = httpActionGeneric(async (ctx, request) => {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response('Missing STRIPE_WEBHOOK_SECRET', { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook signature';
    return new Response(message, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadataUserId = toUserId(session.metadata?.userId);
      const customerId =
        typeof session.customer === 'string'
          ? session.customer
          : (session.customer as Stripe.Customer | null)?.id || '';
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : (session.subscription as Stripe.Subscription | null)?.id || '';

      if (metadataUserId) {
        await ctx.runMutation(anyApi.subscriptions.upsertForUser, {
          userId: metadataUserId,
          plan: 'free',
          status: 'inactive',
          stripeCustomerId: customerId || undefined,
          stripeSubscriptionId: subscriptionId || undefined,
        });
      }

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscriptionRecord(ctx, subscription);
      }
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      await syncSubscriptionRecord(ctx, event.data.object as Stripe.Subscription);
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handler error';
    console.error('[stripeWebhook] processing failed', message);
    return new Response(message, { status: 500 });
  }
});
