import { anyApi, httpActionGeneric } from 'convex/server';
import type Stripe from 'stripe';
import { applyCreditCheckoutSession } from './credit-actions.js';
import { setManagedOpenRouterKeyDisabled } from './openrouterManagement.js';
import {
  asString,
  getStripeClient,
  isSubscriptionEnabled,
  mapStripeStatus,
  subscriptionCurrentPeriodEndMs,
  toUserId,
} from './stripe-utils.js';

const syncOpenRouterKeyStatusFromSubscription = async (subscription: Stripe.Subscription) => {
  const keyHash = asString(subscription.metadata?.openrouter_key_hash);
  if (!keyHash) return;

  const shouldEnable = isSubscriptionEnabled(subscription.status);
  await setManagedOpenRouterKeyDisabled(keyHash, !shouldEnable);
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
      const metadataUserId = String(session.metadata?.userId || '');

      const creditApplyResult = await applyCreditCheckoutSession(ctx, session, event.id);
      if (!creditApplyResult.applied && creditApplyResult.reason === 'missing-credit-metadata' && metadataUserId) {
        // Subscription checkout — existing flow
        const subscriptionId =
          typeof session.subscription === 'string'
            ? session.subscription
            : (session.subscription as Stripe.Subscription | null)?.id;
        const customerId =
          typeof session.customer === 'string' ? session.customer : (session.customer as Stripe.Customer | null)?.id;
        let periodEnd: number | undefined;
        let status: 'active' | 'canceled' | 'past_due' | 'inactive' = 'active';
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          status = mapStripeStatus(subscription.status);
          periodEnd = subscriptionCurrentPeriodEndMs(subscription);
        }
        const checkoutUserId = toUserId(metadataUserId);
        if (checkoutUserId) {
          await ctx.runMutation(anyApi.subscriptions.upsertForUser, {
            userId: checkoutUserId,
            plan: 'pro',
            status,
            stripeCustomerId: customerId || undefined,
            stripeSubscriptionId: subscriptionId || undefined,
            currentPeriodEnd: periodEnd,
          });
        }
      }
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      await syncOpenRouterKeyStatusFromSubscription(subscription);

      const existingBySubscription = subscription.id
        ? await ctx.runQuery(anyApi.subscriptions.getByStripeSubscriptionId, {
            stripeSubscriptionId: subscription.id,
          })
        : null;
      const customerId = String(subscription.customer || '');
      const existingByCustomer = customerId
        ? await ctx.runQuery(anyApi.subscriptions.getByStripeCustomerId, {
            stripeCustomerId: customerId,
          })
        : null;
      const webhookUserId =
        existingBySubscription?.userId || existingByCustomer?.userId || toUserId(subscription.metadata?.userId);

      if (webhookUserId) {
        const mappedStatus = mapStripeStatus(subscription.status);
        const mappedPlan = mappedStatus === 'active' ? 'pro' : 'free';
        await ctx.runMutation(anyApi.subscriptions.upsertForUser, {
          userId: webhookUserId,
          plan: mappedPlan,
          status: mappedStatus,
          stripeCustomerId: customerId || undefined,
          stripeSubscriptionId: subscription.id || undefined,
          currentPeriodEnd: subscriptionCurrentPeriodEndMs(subscription),
        });
      }
    }

    return new Response('ok', { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handler error';
    console.error('[stripeWebhook] processing failed', message);
    return new Response(message, { status: 500 });
  }
});
