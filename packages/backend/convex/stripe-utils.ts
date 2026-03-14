import Stripe from 'stripe';
import type { Id } from './_generated/dataModel.js';

export type UserId = Id<'users'>;

export const baseSiteUrl = () => String(process.env.SITE_URL || 'https://example.com').replace(/\/+$/, '');

export const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization,stripe-signature',
  vary: 'origin',
};

export const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders,
    },
  });

export const asString = (value: unknown) => String(value ?? '').trim();

export const parseJsonBody = async (request: Request) => {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

export const toUserId = (value: unknown): UserId | null => {
  const next = asString(value);
  return next ? (next as UserId) : null;
};

export const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

export const randomHex = (byteLength: number) => {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
};

export const sha256Hex = async (value: string) => {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return bytesToHex(new Uint8Array(digest));
};

export const getStripeClient = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }
  return new Stripe(key);
};

export const stripeMeteredPriceId = () => {
  const priceId = String(process.env.STRIPE_TOKEN_BILLING_PRICE_ID || '').trim();
  if (!priceId) {
    throw new Error('Missing STRIPE_TOKEN_BILLING_PRICE_ID');
  }
  return priceId;
};

export const mapStripeStatus = (status: string | null | undefined): 'active' | 'canceled' | 'past_due' | 'inactive' => {
  switch (String(status || '').toLowerCase()) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'inactive';
  }
};

export const isSubscriptionEnabled = (status: string | null | undefined) => mapStripeStatus(status) === 'active';

export const subscriptionCurrentPeriodEndMs = (subscription: Stripe.Subscription): number | undefined => {
  const raw = asRecord(subscription)?.current_period_end;
  const seconds = Number(raw || 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return Math.floor(seconds * 1000);
};

export const isPaidCheckoutSession = (session: Stripe.Checkout.Session) => {
  const paymentStatus = String(session.payment_status || '').toLowerCase();
  const status = String(session.status || '').toLowerCase();
  return paymentStatus === 'paid' || status === 'complete';
};
