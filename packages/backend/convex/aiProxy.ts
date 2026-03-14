import { getAuthUserId } from '@convex-dev/auth/server';
import { anyApi, httpActionGeneric } from 'convex/server';
import { corsHeaders, jsonResponse } from './ai-proxy-config.js';
import {
  createProxyContext,
  createStreamingTransform,
  extractUsageFromResponse,
  prepareUpstreamRequest,
  tryFallbackModel,
} from './ai-proxy-handlers.js';
import { resolveProviderTarget } from './ai-proxy-providers.js';
import { asRecord } from './ai-proxy-utils.js';
import { reportTokenUsageToStripe } from './stripeMetering.js';

export const aiProxy = httpActionGeneric(async (ctx, request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const providerTarget = resolveProviderTarget(request);
  if (!providerTarget) {
    return jsonResponse(404, { error: 'Unknown AI proxy route' });
  }
  if (!providerTarget.upstreamApiKey) {
    return jsonResponse(500, { error: `Missing ${providerTarget.provider.toUpperCase()}_API_KEY` });
  }

  let userId: string | null = null;
  try {
    userId = await getAuthUserId(ctx);
  } catch (error) {
    console.warn('[aiProxy] Invalid auth token:', error);
    return jsonResponse(401, { error: 'Unauthorized' });
  }
  if (!userId) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  const subscription = await ctx.runQuery(anyApi.subscriptions.getByUserId, { userId });
  const hasActiveSubscription = Boolean(
    subscription && subscription.plan === 'pro' && subscription.status === 'active',
  );
  const stripeCustomerId = String(subscription?.stripeCustomerId || '').trim();
  if (!hasActiveSubscription || !stripeCustomerId) {
    return jsonResponse(402, {
      error: 'Managed billing is not active. Open Account & Billing to start or manage your Stripe plan.',
    });
  }

  let payload: Record<string, unknown>;
  try {
    const parsedPayload = await request.json();
    const payloadRecord = asRecord(parsedPayload);
    if (!payloadRecord) {
      return jsonResponse(400, { error: 'Invalid JSON payload' });
    }
    payload = payloadRecord;
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload' });
  }

  // Create proxy context with all request parameters
  const proxyCtx = createProxyContext(userId, payload, providerTarget);
  const { requestId, estimatedTokens, providerTarget: target, settledModel: initialModel } = proxyCtx;
  let settledModel = initialModel;

  await ctx.runMutation(anyApi.subscriptions.recordUsage, {
    userId,
    requestCountIncrement: 1,
    tokenEstimate: estimatedTokens,
  });

  const syncFinalUsage = async (tokens: number) => {
    const finalTokens = Math.max(0, Math.floor(Number(tokens || 0)));
    const tokenDelta = finalTokens - estimatedTokens;
    try {
      if (tokenDelta !== 0) {
        await ctx.runMutation(anyApi.subscriptions.adjustUsageTokens, {
          userId,
          tokenDelta,
        });
      }
      await reportTokenUsageToStripe({
        customerId: stripeCustomerId,
        tokens: finalTokens,
        identifier: requestId,
      });
    } catch (error) {
      console.error('[aiProxy] Failed to report Stripe metered usage', { requestId, finalTokens, error });
    }
    return finalTokens;
  };

  // Prepare and make upstream request
  const { body, makeRequest } = prepareUpstreamRequest(request, payload, target);

  let upstream: Response;
  let upstreamErrorBodyText: string | null = null;
  try {
    upstream = await makeRequest(body);
  } catch {
    return jsonResponse(502, {
      error: 'Upstream provider request failed before a response was received.',
      requestId,
    });
  }

  // Handle error responses and fallback logic
  if (!upstream.ok) {
    try {
      upstreamErrorBodyText = await upstream.text();
    } catch {
      upstreamErrorBodyText = '';
    }

    const fallbackResult = await tryFallbackModel(
      upstream,
      upstreamErrorBodyText,
      body,
      makeRequest,
      target,
      settledModel,
    );
    upstream = fallbackResult.upstream;
    upstreamErrorBodyText = fallbackResult.upstreamErrorBodyText;
    settledModel = fallbackResult.settledModel;
  }

  // Build response headers
  const responseHeaders = new Headers(corsHeaders);
  const contentType = upstream.headers.get('content-type');
  if (contentType) responseHeaders.set('content-type', contentType);
  const cacheControl = upstream.headers.get('cache-control');
  if (cacheControl) responseHeaders.set('cache-control', cacheControl);
  responseHeaders.set('x-parchi-request-id', requestId);
  responseHeaders.set('x-parchi-estimated-tokens', String(estimatedTokens));

  // Handle upstream error
  if (!upstream.ok) {
    return new Response(upstreamErrorBodyText ?? upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  // Handle non-streaming response
  const isStreaming = String(contentType || '').includes('text/event-stream');
  if (!isStreaming) {
    const usageTokens = await extractUsageFromResponse(upstream);
    const finalTokens = await syncFinalUsage(usageTokens ?? estimatedTokens);
    responseHeaders.set('x-parchi-final-tokens', String(finalTokens));
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  // Handle streaming response
  const upstreamBody = upstream.body;
  if (!upstreamBody) {
    const finalTokens = await syncFinalUsage(estimatedTokens);
    responseHeaders.set('x-parchi-final-tokens', String(finalTokens));
    return new Response(null, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  const transform = createStreamingTransform({
    estimatedTokens,
    onSettle: async (tokens) => {
      await syncFinalUsage(tokens);
    },
  });

  const settledStream = upstreamBody.pipeThrough(transform);

  return new Response(settledStream, {
    status: upstream.status,
    headers: responseHeaders,
  });
});
