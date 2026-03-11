import { httpActionGeneric } from 'convex/server';
import type Stripe from 'stripe';
import {
  issueOpenRouterKeyForSubscription,
  parseRecoveryToken,
  resolvePaidProvisioningSession,
} from './openrouter-key-issuance.js';
import { asString, corsHeaders, getStripeClient, jsonResponse, parseJsonBody, sha256Hex } from './stripe-utils.js';

export const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

export const provisionOpenRouterKey = httpActionGeneric(async (_ctx, request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const stripe = getStripeClient();
  const body = await parseJsonBody(request);
  const sessionId = asString(body?.session_id);
  if (!sessionId) {
    return jsonResponse(400, { error: 'Missing session_id' });
  }

  try {
    const { session, subscription } = await resolvePaidProvisioningSession(stripe, sessionId);
    const result = await issueOpenRouterKeyForSubscription({
      stripe,
      subscription,
      session,
      allowReplace: false,
    });
    if ('alreadyProvisionedHash' in result) {
      return jsonResponse(409, {
        error: 'Already provisioned for this subscription (key secret is not stored).',
        openrouter_key_hash: result.alreadyProvisionedHash,
      });
    }

    return jsonResponse(200, {
      openrouter_api_base: OPENROUTER_API_BASE,
      openrouter_api_key: result.createdKey.key,
      recovery_token: result.recoveryToken,
      plan_id: result.plan.id,
      model: result.model,
      allowed_models: result.plan.allowedModels,
      key_limit_usd: result.plan.keyLimitUsd,
      limit_reset: result.plan.limitReset,
      note: 'Save this key now. The server does not store it and cannot show it again. If lost, regenerate with a dedicated replace flow.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Provisioning failed';
    if (message.includes('Checkout session not paid')) {
      return jsonResponse(402, { error: message });
    }
    if (message.includes('Subscription is not active')) {
      return jsonResponse(402, { error: message });
    }
    if (message.includes('Expected subscription checkout session') || message.includes('Missing subscription')) {
      return jsonResponse(400, { error: message });
    }
    return jsonResponse(500, { error: message });
  }
});

export const regenerateOpenRouterKey = httpActionGeneric(async (_ctx, request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const stripe = getStripeClient();
  const body = await parseJsonBody(request);
  const sessionId = asString(body?.session_id);
  if (!sessionId) {
    return jsonResponse(400, { error: 'Missing session_id' });
  }

  try {
    const { session, subscription } = await resolvePaidProvisioningSession(stripe, sessionId);
    if (!asString(subscription.metadata?.openrouter_key_hash)) {
      return jsonResponse(400, {
        error: 'No existing OpenRouter key hash found. Provision first via /api/provision.',
      });
    }

    const result = await issueOpenRouterKeyForSubscription({
      stripe,
      subscription,
      session,
      allowReplace: true,
    });
    if ('alreadyProvisionedHash' in result) {
      return jsonResponse(500, { error: 'Unexpected regenerate state' });
    }

    return jsonResponse(200, {
      openrouter_api_base: OPENROUTER_API_BASE,
      openrouter_api_key: result.createdKey.key,
      recovery_token: result.recoveryToken,
      replaced_key_hash: result.replacedKeyHash,
      plan_id: result.plan.id,
      model: result.model,
      allowed_models: result.plan.allowedModels,
      key_limit_usd: result.plan.keyLimitUsd,
      limit_reset: result.plan.limitReset,
      note: 'Previous key has been disabled. Save this new key now; it is not stored server-side.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Regeneration failed';
    if (message.includes('Checkout session not paid')) {
      return jsonResponse(402, { error: message });
    }
    if (message.includes('Subscription is not active')) {
      return jsonResponse(402, { error: message });
    }
    if (message.includes('Expected subscription checkout session') || message.includes('Missing subscription')) {
      return jsonResponse(400, { error: message });
    }
    return jsonResponse(500, { error: message });
  }
});

export const recoverOpenRouterKey = httpActionGeneric(async (_ctx, request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const body = await parseJsonBody(request);
  const recoveryToken = asString(body?.recovery_token);
  if (!recoveryToken) {
    return jsonResponse(400, { error: 'Missing recovery_token' });
  }

  let parsedToken: { subscriptionId: string; secret: string };
  try {
    parsedToken = parseRecoveryToken(recoveryToken);
  } catch (error) {
    return jsonResponse(400, { error: (error as Error).message });
  }

  const stripe = getStripeClient();
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(parsedToken.subscriptionId);
  } catch {
    return jsonResponse(401, { error: 'Invalid recovery token' });
  }

  const storedHash = asString(subscription.metadata?.openrouter_recovery_hash);
  if (!storedHash) {
    return jsonResponse(401, { error: 'Recovery token is not configured for this subscription' });
  }

  const providedHash = await sha256Hex(parsedToken.secret);
  if (providedHash !== storedHash) {
    return jsonResponse(401, { error: 'Invalid recovery token' });
  }

  try {
    const result = await issueOpenRouterKeyForSubscription({
      stripe,
      subscription,
      session: null,
      allowReplace: true,
    });
    if ('alreadyProvisionedHash' in result) {
      return jsonResponse(500, { error: 'Unexpected recovery state' });
    }

    return jsonResponse(200, {
      openrouter_api_base: OPENROUTER_API_BASE,
      openrouter_api_key: result.createdKey.key,
      recovery_token: result.recoveryToken,
      replaced_key_hash: result.replacedKeyHash,
      plan_id: result.plan.id,
      model: result.model,
      allowed_models: result.plan.allowedModels,
      key_limit_usd: result.plan.keyLimitUsd,
      limit_reset: result.plan.limitReset,
      note: 'Recovery complete. Previous key is disabled and recovery token is rotated.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Recovery failed';
    if (message.includes('Subscription is not active')) {
      return jsonResponse(402, { error: message });
    }
    return jsonResponse(500, { error: message });
  }
});
