// AI Proxy Configuration - Constants and types for AI proxy functionality

export const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST,OPTIONS',
  'access-control-allow-headers': 'authorization,content-type,x-api-key,anthropic-version',
  'access-control-expose-headers': 'x-parchi-request-id,x-parchi-estimated-cost-cents,x-parchi-final-cost-cents',
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

export type ProviderTarget = {
  provider: 'openai' | 'anthropic' | 'kimi' | 'openrouter';
  upstreamBaseUrl: string;
  defaultPath: string;
  upstreamApiKey: string;
};

export const COST_CENTS_PER_TOKEN = Number(process.env.CREDIT_COST_CENTS_PER_TOKEN || 0.003);
export const MIN_REQUEST_COST_CENTS = 1;
export const CHARS_PER_TOKEN_ESTIMATE = 4;
export const OPENROUTER_SAFE_FALLBACK_MODEL =
  String(process.env.OPENROUTER_FALLBACK_MODEL || 'openrouter/auto').trim() || 'openrouter/auto';
