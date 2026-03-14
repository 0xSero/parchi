import type Stripe from 'stripe';
import { getStripeClient } from './stripe-utils.js';

export const stripeMeterEventName = () =>
  String(process.env.STRIPE_TOKEN_BILLING_METER_EVENT_NAME || 'llm_tokens').trim() || 'llm_tokens';

export const reportTokenUsageToStripe = async (args: {
  customerId: string;
  tokens: number;
  identifier: string;
  stripe?: Stripe;
}) => {
  const customerId = String(args.customerId || '').trim();
  const tokens = Math.max(0, Math.floor(Number(args.tokens || 0)));
  if (!customerId || tokens <= 0) return null;

  const stripe = args.stripe || getStripeClient();
  return stripe.billing.meterEvents.create({
    event_name: stripeMeterEventName(),
    identifier: String(args.identifier || '').trim() || undefined,
    payload: {
      stripe_customer_id: customerId,
      value: String(tokens),
    },
  });
};
