import { httpActionGeneric } from 'convex/server';
import { resolveCheckoutSelection } from './openrouter-plan-selection.js';
import { asString, corsHeaders, getStripeClient, jsonResponse, parseJsonBody } from './stripe-utils.js';

export const createOpenRouterCheckout = httpActionGeneric(async (_ctx, request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const stripe = getStripeClient();
    const body = (await parseJsonBody(request)) || {};
    const { plan, model } = resolveCheckoutSelection(body);
    const allowedModelsCsv = plan.allowedModels.join(',');

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: `${process.env.SITE_URL?.replace(/\/+$/, '') || 'https://example.com'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL?.replace(/\/+$/, '') || 'https://example.com'}/billing/cancel`,
      customer_email: asString(body.customer_email) || undefined,
      metadata: {
        parchi_plan_id: plan.id,
        parchi_model: model,
        parchi_allowed_models: allowedModelsCsv,
        parchi_key_limit_usd: String(plan.keyLimitUsd),
        parchi_limit_reset: plan.limitReset ?? '',
      },
      subscription_data: {
        metadata: {
          parchi_plan_id: plan.id,
          parchi_model: model,
          parchi_allowed_models: allowedModelsCsv,
          parchi_key_limit_usd: String(plan.keyLimitUsd),
          parchi_limit_reset: plan.limitReset ?? '',
        },
      },
      allow_promotion_codes: true,
    });

    return jsonResponse(200, {
      session_id: session.id,
      url: session.url,
      plan_id: plan.id,
      model,
      allowed_models: plan.allowedModels,
      key_limit_usd: plan.keyLimitUsd,
      limit_reset: plan.limitReset,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create checkout session';
    return jsonResponse(500, { error: message });
  }
});
