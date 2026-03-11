import { getAuthUserId } from '@convex-dev/auth/server';
import { anyApi, httpActionGeneric } from 'convex/server';
import { corsHeaders, jsonResponse } from './ai-proxy-config.js';
import { createCreditHandlers } from './ai-proxy-credits.js';
import {
  createProxyContext,
  createStreamingTransform,
  extractUsageFromResponse,
  prepareUpstreamRequest,
  tryFallbackModel,
} from './ai-proxy-handlers.js';
import { resolveProviderTarget } from './ai-proxy-providers.js';
import { asRecord } from './ai-proxy-utils.js';

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
  const creditBalance = subscription?.creditBalanceCents ?? 0;
  const hasLegacySub = Boolean(subscription && subscription.plan === 'pro' && subscription.status === 'active');
  if (creditBalance <= 0 && !hasLegacySub) {
    return jsonResponse(402, { error: 'Insufficient credits. Purchase credits to continue.' });
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
  const proxyCtx = createProxyContext(userId, payload, providerTarget, hasLegacySub);
  const {
    requestId,
    estimatedTokens,
    estimatedCostCents,
    shouldTrackCredits,
    providerTarget: target,
    settledModel: initialModel,
  } = proxyCtx;
  let settledModel = initialModel;

  // Reserve credits if needed
  if (shouldTrackCredits) {
    const reservation = await ctx.runMutation(anyApi.subscriptions.reserveCredits, {
      userId,
      amountCents: estimatedCostCents,
      requestId,
      provider: target.provider,
      model: settledModel,
      tokenEstimate: estimatedTokens,
      note: 'Reserved before forwarding to upstream provider',
    });
    if (!reservation?.success) {
      return jsonResponse(402, {
        error: 'Insufficient credits for this request. Purchase more credits to continue.',
        remainingCents: Number(reservation?.remainingCents ?? 0),
      });
    }
  }

  await ctx.runMutation(anyApi.subscriptions.recordUsage, {
    userId,
    requestCountIncrement: 1,
    tokenEstimate: estimatedTokens,
  });

  // Create credit settlement handlers
  const { settleCredits, releaseCredits } = createCreditHandlers(ctx, {
    userId,
    requestId,
    estimatedTokens,
    estimatedCostCents,
    provider: target.provider,
    settledModel,
    shouldTrackCredits,
  });

  // Prepare and make upstream request
  const { body, makeRequest } = prepareUpstreamRequest(request, payload, target);

  let upstream: Response;
  let upstreamErrorBodyText: string | null = null;
  try {
    upstream = await makeRequest(body);
  } catch {
    await releaseCredits('Upstream network error before response');
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
  responseHeaders.set('x-parchi-estimated-cost-cents', String(estimatedCostCents));

  // Handle upstream error
  if (!upstream.ok) {
    await releaseCredits(`Upstream responded with HTTP ${upstream.status}`);
    return new Response(upstreamErrorBodyText ?? upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  // Skip credit tracking for legacy subscribers
  if (!shouldTrackCredits) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  // Handle non-streaming response
  const isStreaming = String(contentType || '').includes('text/event-stream');
  if (!isStreaming) {
    const usageTokens = await extractUsageFromResponse(upstream);
    const finalCostCents = await settleCredits(
      usageTokens ?? estimatedTokens,
      usageTokens !== null ? 'Settled from JSON response usage' : 'Settled using token estimate (usage missing)',
    );
    if (finalCostCents !== null) {
      responseHeaders.set('x-parchi-final-cost-cents', String(finalCostCents));
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  // Handle streaming response
  const upstreamBody = upstream.body;
  if (!upstreamBody) {
    const finalCostCents = await settleCredits(estimatedTokens, 'Settled using estimate (empty streaming body)');
    if (finalCostCents !== null) {
      responseHeaders.set('x-parchi-final-cost-cents', String(finalCostCents));
    }
    return new Response(null, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  const transform = createStreamingTransform({
    estimatedTokens,
    shouldTrackCredits,
    onSettle: async (tokens, note) => {
      await settleCredits(tokens, note);
    },
  });

  const settledStream = upstreamBody.pipeThrough(transform);

  return new Response(settledStream, {
    status: upstream.status,
    headers: responseHeaders,
  });
});
