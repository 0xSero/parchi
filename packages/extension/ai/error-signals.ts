import type { ErrorCategory } from './error-classifier.js';

export type ClassifiedErrorResult = {
  category: ErrorCategory;
  message: string;
  action?: string;
  recoverable: boolean;
};

export type ManagedSignalInput = {
  route?: string;
  provider?: string;
  model?: string;
  useProxy?: boolean;
};

export function detectManagedRouteSignal(context: ManagedSignalInput, combined: string): boolean {
  const contextSignalsManaged =
    context.route === 'proxy' ||
    context.useProxy === true ||
    String(context.provider || '').toLowerCase() === 'parchi' ||
    String(context.model || '')
      .toLowerCase()
      .startsWith('parchi/');
  return (
    contextSignalsManaged ||
    combined.includes('/ai-proxy') ||
    combined.includes('convex') ||
    combined.includes('parchi managed') ||
    combined.includes('parchi/') ||
    combined.includes('insufficient credits') ||
    combined.includes('subscription is not active') ||
    combined.includes('recovery token')
  );
}

export function classifyManagedRuntimeSpecialCase(
  statusCode: number,
  combined: string,
  hasManagedRouteSignal: boolean,
): ClassifiedErrorResult | null {
  if (
    statusCode === 402 ||
    combined.includes('insufficient credits') ||
    combined.includes('buy credits') ||
    combined.includes('subscription is not active') ||
    combined.includes('checkout session not paid')
  ) {
    return {
      category: 'auth',
      message: 'Managed access is unavailable for this request.',
      action:
        'Open Account & Billing to buy credits or reactivate your subscription. If a managed key expired, use Recover/Regenerate key.',
      recoverable: true,
    };
  }

  if (
    hasManagedRouteSignal &&
    (combined.includes('missing openrouter_api_key') || combined.includes('missing openrouter api key'))
  ) {
    return {
      category: 'auth',
      message: 'Managed runtime is missing server credentials.',
      action:
        'Set OPENROUTER_API_KEY in backend/Convex env, then deploy. Paid proxy mode uses the server key, not a user BYOK key.',
      recoverable: false,
    };
  }

  if (
    hasManagedRouteSignal &&
    (combined.includes('could not parse jwt payload') ||
      combined.includes('valid jwt format') ||
      combined.includes('base64-encoded parts separated by dots') ||
      combined.includes('refreshing paid runtime session'))
  ) {
    return {
      category: 'auth',
      message: 'Managed runtime session is invalid or expired.',
      action: 'Sign in again in Account & Billing to refresh your paid session.',
      recoverable: false,
    };
  }

  return null;
}

export function detectOAuthRouteSignal(context: { route?: string; provider?: string }, combined: string): boolean {
  const oauthProvider = String(context.provider || '')
    .trim()
    .toLowerCase();
  return context.route === 'oauth' || oauthProvider.endsWith('-oauth') || combined.includes('oauth session');
}

export function detectAuthKeySignal(combined: string): boolean {
  return (
    combined.includes('invalid api key') ||
    combined.includes('invalid x-api-key') ||
    combined.includes('incorrect api key')
  );
}

export function detectOAuthPermissionSignal(combined: string): boolean {
  return (
    combined.includes('insufficient permissions') ||
    combined.includes('insufficient permission') ||
    combined.includes('missing scopes') ||
    combined.includes('missing scope') ||
    combined.includes('insufficient_scope') ||
    combined.includes('api.model.read')
  );
}

export function detectQuotaSignal(combined: string): boolean {
  return (
    combined.includes('quota exceeded') ||
    combined.includes('insufficient_quota') ||
    combined.includes('exceeded your current quota') ||
    combined.includes('billing details')
  );
}

export function detectRateLimitSignal(statusCode: number, combined: string, hasQuotaSignal: boolean): boolean {
  return (
    statusCode === 429 ||
    combined.includes('rate limit') ||
    combined.includes('too many requests') ||
    hasQuotaSignal ||
    combined.includes('rate_limit')
  );
}

export function detectModelSignal(combined: string): boolean {
  return (
    combined.includes('model not found') ||
    combined.includes('invalid model') ||
    combined.includes('model is unavailable') ||
    combined.includes('model not available') ||
    combined.includes('model is not available') ||
    combined.includes('model not supported') ||
    combined.includes('model_not_supported') ||
    /model[^.\n]{0,120}(does not exist|not found|unavailable|invalid)/i.test(combined)
  );
}
