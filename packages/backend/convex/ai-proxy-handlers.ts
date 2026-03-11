// AI Proxy Handlers - Request handling utilities for AI proxy

import { OPENROUTER_SAFE_FALLBACK_MODEL, type ProviderTarget } from './ai-proxy-config.js';
import { buildUpstreamHeaders, resolveForwardPath } from './ai-proxy-providers.js';
import {
  costFromTokens,
  createRequestId,
  estimatePromptTokens,
  extractUsageTokens,
  isModelUnavailableError,
  parseSseUsageTokens,
  toSafeInt,
} from './ai-proxy-utils.js';

export interface ProxyContext {
  userId: string;
  requestId: string;
  estimatedTokens: number;
  estimatedCostCents: number;
  providerTarget: ProviderTarget;
  settledModel: string;
  shouldTrackCredits: boolean;
}

export function createProxyContext(
  userId: string,
  payload: Record<string, unknown>,
  providerTarget: ProviderTarget,
  hasLegacySub: boolean,
): ProxyContext {
  const requestId = createRequestId();
  const settledModel = String(payload?.model || '').trim();
  const promptTokens = estimatePromptTokens(payload);
  const maxTokens = toSafeInt(payload?.max_tokens || payload?.maxTokens || 4096) || 4096;
  const estimatedTokens = Math.max(1, promptTokens + maxTokens);
  const estimatedCostCents = costFromTokens(estimatedTokens);

  // Enable usage tracking in stream_options for supported providers
  if (payload?.stream === true && (providerTarget.provider === 'openai' || providerTarget.provider === 'openrouter')) {
    payload.stream_options = {
      ...(payload.stream_options && typeof payload.stream_options === 'object' ? payload.stream_options : {}),
      include_usage: true,
    };
  }

  return {
    userId,
    requestId,
    estimatedTokens,
    estimatedCostCents,
    providerTarget,
    settledModel,
    shouldTrackCredits: !hasLegacySub,
  };
}

export function prepareUpstreamRequest(
  request: Request,
  payload: Record<string, unknown>,
  providerTarget: ProviderTarget,
): {
  upstreamUrl: string;
  upstreamHeaders: Headers;
  body: Record<string, unknown>;
  makeRequest: (body: Record<string, unknown>) => Promise<Response>;
} {
  const forwardPath = resolveForwardPath(request, providerTarget.provider, providerTarget.defaultPath);
  const upstreamUrl = `${providerTarget.upstreamBaseUrl}${forwardPath}`;
  const upstreamHeaders = buildUpstreamHeaders(providerTarget, request);

  const { provider: _provider, ...body } = payload;

  const makeRequest = async (requestBody: Record<string, unknown>) =>
    fetch(upstreamUrl, {
      method: 'POST',
      headers: upstreamHeaders,
      body: JSON.stringify(requestBody),
    });

  return { upstreamUrl, upstreamHeaders, body, makeRequest };
}

export async function tryFallbackModel(
  upstream: Response,
  upstreamErrorBodyText: string | null,
  body: Record<string, unknown>,
  makeRequest: (body: Record<string, unknown>) => Promise<Response>,
  providerTarget: ProviderTarget,
  settledModel: string,
): Promise<{ upstream: Response; upstreamErrorBodyText: string | null; settledModel: string }> {
  const requestedModel = String(body?.model || '').trim();
  const canRetryWithFallback =
    providerTarget.provider === 'openrouter' &&
    requestedModel.length > 0 &&
    OPENROUTER_SAFE_FALLBACK_MODEL.length > 0 &&
    requestedModel !== OPENROUTER_SAFE_FALLBACK_MODEL &&
    isModelUnavailableError(upstream.status, upstreamErrorBodyText || '');

  if (!canRetryWithFallback) {
    return { upstream, upstreamErrorBodyText, settledModel };
  }

  try {
    const fallbackBody = { ...body, model: OPENROUTER_SAFE_FALLBACK_MODEL };
    const fallbackResponse = await makeRequest(fallbackBody);
    if (fallbackResponse.ok) {
      return { upstream: fallbackResponse, upstreamErrorBodyText: null, settledModel: OPENROUTER_SAFE_FALLBACK_MODEL };
    } else {
      const newErrorText = await fallbackResponse.text().catch(() => '');
      return { upstream: fallbackResponse, upstreamErrorBodyText: newErrorText, settledModel };
    }
  } catch {
    // Keep the original upstream error when fallback fails at network level
    return { upstream, upstreamErrorBodyText, settledModel };
  }
}

export interface StreamingTransformContext {
  estimatedTokens: number;
  shouldTrackCredits: boolean;
  onSettle: (actualTokens: number, note: string) => Promise<void>;
}

export function createStreamingTransform(context: StreamingTransformContext): TransformStream<Uint8Array, Uint8Array> {
  const { estimatedTokens, shouldTrackCredits, onSettle } = context;

  if (!shouldTrackCredits) {
    // Pass-through transform when not tracking credits
    return new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },
    });
  }

  const decoder = new TextDecoder();
  let streamBuffer = '';
  let detectedUsageTokens: number | null = null;

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(chunk);
      const text = decoder.decode(chunk, { stream: true });
      streamBuffer += text;
      let newlineIndex = streamBuffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = streamBuffer.slice(0, newlineIndex).trim();
        streamBuffer = streamBuffer.slice(newlineIndex + 1);
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          if (data && data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data);
              const usageTokens = extractUsageTokens(parsed);
              if (usageTokens !== null) detectedUsageTokens = usageTokens;
            } catch {
              // Ignore non-JSON SSE payloads
            }
          }
        }
        newlineIndex = streamBuffer.indexOf('\n');
      }
    },
    async flush() {
      const tail = decoder.decode();
      if (tail) {
        streamBuffer += tail;
      }
      if (streamBuffer.trim().length > 0) {
        const usageFromTail = parseSseUsageTokens(streamBuffer);
        if (usageFromTail !== null) detectedUsageTokens = usageFromTail;
      }
      await onSettle(
        detectedUsageTokens !== null ? detectedUsageTokens : estimatedTokens,
        detectedUsageTokens !== null
          ? 'Settled from SSE stream usage'
          : 'Settled using token estimate (SSE usage missing)',
      );
    },
  });
}

export async function extractUsageFromResponse(upstream: Response): Promise<number | null> {
  try {
    const parsed = await upstream.clone().json();
    return extractUsageTokens(parsed);
  } catch {
    return null;
  }
}
