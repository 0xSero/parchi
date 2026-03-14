import type { ClassifiedError } from './classifier.js';

export function classifyOAuthPermissionError(
  _statusCode: number,
  _combined: string,
  _responseBody: string,
  _msg: string,
  context: { hasOAuthRouteSignal: boolean; hasManagedRouteSignal: boolean; oauthProviderLabel: string },
  hasOAuthPermissionSignal: boolean,
): ClassifiedError | null {
  if (context.hasOAuthRouteSignal && !context.hasManagedRouteSignal && hasOAuthPermissionSignal) {
    return {
      category: 'auth',
      message: `${context.oauthProviderLabel} OAuth account lacks required API permissions.`,
      action: `Grant API scopes/access for ${context.oauthProviderLabel} (for example missing model-read scope), then reconnect ${context.oauthProviderLabel} in Settings > OAuth.`,
      recoverable: false,
    };
  }
  return null;
}

export function classifyRateLimitError(
  _statusCode: number,
  _combined: string,
  _responseBody: string,
  _msg: string,
  _context: { hasOAuthRouteSignal: boolean; hasManagedRouteSignal: boolean; oauthProviderLabel: string },
  hasRateLimitSignal: boolean,
  hasQuotaSignal: boolean,
): ClassifiedError | null {
  if (!hasRateLimitSignal) return null;
  return {
    category: 'rate_limit',
    message: hasQuotaSignal
      ? 'Request blocked by provider quota or billing limits.'
      : 'Rate limit reached. Too many requests in a short time.',
    action: hasQuotaSignal ? 'Check provider billing/quota, then retry.' : 'Wait a moment and try again.',
    recoverable: !hasQuotaSignal,
  };
}

export function classifyAuthError(
  statusCode: number,
  combined: string,
  _responseBody: string,
  _msg: string,
  context: { hasOAuthRouteSignal: boolean; hasManagedRouteSignal: boolean; oauthProviderLabel: string },
  hasAuthKeySignal: boolean,
): ClassifiedError | null {
  const isAuthError =
    statusCode === 401 ||
    statusCode === 403 ||
    hasAuthKeySignal ||
    combined.includes('authentication') ||
    combined.includes('unauthorized') ||
    combined.includes('forbidden') ||
    combined.includes('permission denied');

  if (!isAuthError) return null;

  if (context.hasOAuthRouteSignal && !context.hasManagedRouteSignal) {
    return {
      category: 'auth',
      message: `${context.oauthProviderLabel} OAuth authentication failed.`,
      action: `Reconnect ${context.oauthProviderLabel} in Settings > OAuth, then retry.`,
      recoverable: true,
    };
  }

  const managedAuthMessage = hasAuthKeySignal
    ? 'Managed runtime key is invalid or expired.'
    : 'Managed runtime authentication failed.';
  const managedAuthAction = hasAuthKeySignal
    ? 'Fix OPENROUTER_API_KEY in backend/Convex env (use an inference key, not OPENROUTER_MANAGEMENT_KEY), then deploy.'
    : 'If you are in Paid mode, this is not your BYOK key. Refresh Account & Billing and verify your Stripe billing session is active.';

  return {
    category: 'auth',
    message: context.hasManagedRouteSignal
      ? managedAuthMessage
      : 'Authentication failed. Credentials may be invalid or expired.',
    action: context.hasManagedRouteSignal ? managedAuthAction : 'If using BYOK, check your API key in Settings.',
    recoverable: false,
  };
}

export function classifyContextLengthError(_statusCode: number, combined: string): ClassifiedError | null {
  if (
    combined.includes('context length') ||
    combined.includes('maximum context') ||
    combined.includes('token limit') ||
    combined.includes('too many tokens') ||
    combined.includes('max_tokens') ||
    combined.includes('context_length_exceeded')
  ) {
    return {
      category: 'context_length',
      message: 'Context too long. The conversation exceeds the model limit.',
      action: 'Start a new session or reduce context.',
      recoverable: false,
    };
  }
  return null;
}

export function classifyModelError(
  _statusCode: number,
  _combined: string,
  responseBody: string,
  _msg: string,
  context: { hasOAuthRouteSignal: boolean; hasManagedRouteSignal: boolean; oauthProviderLabel: string },
  hasModelSignal: boolean,
): ClassifiedError | null {
  if (!hasModelSignal) return null;
  const detail = responseBody ? ` Upstream: ${responseBody.slice(0, 300)}` : '';
  return {
    category: 'model',
    message: `Model not found or unavailable.${detail}`,
    action:
      context.hasOAuthRouteSignal && !context.hasManagedRouteSignal
        ? 'Use the raw model ID for OAuth providers (no provider/ prefix), then retry.'
        : 'Check the model name in your profile settings.',
    recoverable: false,
  };
}
