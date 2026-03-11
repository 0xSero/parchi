import type Stripe from 'stripe';
import {
  type OpenRouterProvisioningPlan,
  type OpenRouterProvisioningRuntimeConfig,
  choosePlanModelLenient,
  choosePlanModelStrict,
  findPlanById,
  findPlanByStripePriceId,
  resolveOpenRouterProvisioningRuntimeConfig,
} from './openrouter-config.js';
import { asString } from './stripe-utils.js';

export const readSubscriptionPrimaryPriceId = (subscription: Stripe.Subscription) =>
  asString(subscription.items?.data?.[0]?.price?.id);

export const resolveCheckoutSelection = (body: Record<string, unknown>) => {
  const runtime = resolveOpenRouterProvisioningRuntimeConfig();
  const requestedPlanId = asString(body.plan_id) || runtime.defaultPlanId;
  const plan = findPlanById(runtime, requestedPlanId);
  if (!plan) {
    throw new Error(
      `Unknown plan '${requestedPlanId}'. Available plans: ${runtime.plans.map((entry) => entry.id).join(', ')}`,
    );
  }
  const model = choosePlanModelStrict(plan, asString(body.model));
  return { runtime, plan, model };
};

export const resolveProvisioningSelection = (
  subscription: Stripe.Subscription,
  session: Stripe.Checkout.Session | null,
) => {
  const runtime = resolveOpenRouterProvisioningRuntimeConfig();

  const metadataPlanId =
    asString(subscription.metadata?.parchi_plan_id) ||
    asString(session?.metadata?.parchi_plan_id) ||
    runtime.defaultPlanId;
  const metadataModel =
    asString(subscription.metadata?.parchi_model) ||
    asString(subscription.metadata?.openrouter_model) ||
    asString(session?.metadata?.parchi_model);

  const byId = findPlanById(runtime, metadataPlanId);
  const byPrice = findPlanByStripePriceId(runtime, readSubscriptionPrimaryPriceId(subscription));
  const plan = byId || byPrice || findPlanById(runtime, runtime.defaultPlanId) || runtime.plans[0];
  if (!plan) {
    throw new Error('No provisioning plan is configured');
  }

  return {
    runtime,
    plan,
    model: choosePlanModelLenient(plan, metadataModel),
  };
};

export type { OpenRouterProvisioningRuntimeConfig, OpenRouterProvisioningPlan };
