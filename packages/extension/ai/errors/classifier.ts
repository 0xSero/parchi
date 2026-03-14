import {
  classifyAuthError,
  classifyContextLengthError,
  classifyModelError,
  classifyOAuthPermissionError,
  classifyRateLimitError,
} from './categories-auth.js';
import {
  classifyEmptyBodyError,
  classifyEndpointError,
  classifyNetworkError,
  classifyServerError,
  classifyTimeoutError,
  createUnknownError,
} from './categories-infra.js';
import {
  type ManagedSignalInput,
  classifyManagedRuntimeSpecialCase,
  detectAuthKeySignal,
  detectManagedRouteSignal,
  detectModelSignal,
  detectOAuthPermissionSignal,
  detectOAuthRouteSignal,
  detectQuotaSignal,
  detectRateLimitSignal,
} from './signals.js';

export type ErrorCategory =
  | 'auth'
  | 'rate_limit'
  | 'network'
  | 'model'
  | 'timeout'
  | 'context_length'
  | 'server'
  | 'unknown';

export type ClassifiedError = {
  category: ErrorCategory;
  message: string;
  action?: string;
  recoverable: boolean;
};

export type ErrorClassificationContext = ManagedSignalInput;

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

export function classifyApiError(error: unknown, context: ErrorClassificationContext = {}): ClassifiedError {
  const errorRecord = asRecord(error);
  const msg =
    error instanceof Error
      ? error.message
      : typeof errorRecord?.message === 'string'
        ? String(errorRecord.message)
        : String(error ?? '');
  const statusCode = Number(errorRecord?.statusCode ?? errorRecord?.status ?? 0);
  const responseBody = String(errorRecord?.responseBody ?? '');
  const contextCombined = `${context.route || ''} ${context.provider || ''} ${context.model || ''}`.toLowerCase();
  const combined = `${msg} ${responseBody} ${contextCombined}`.toLowerCase();

  const hasManagedRouteSignal = detectManagedRouteSignal(context, combined);
  const managedSpecialCase = classifyManagedRuntimeSpecialCase(statusCode, combined, hasManagedRouteSignal);
  if (managedSpecialCase) return managedSpecialCase;

  const oauthProvider = String(context.provider || '')
    .trim()
    .toLowerCase();
  const hasOAuthRouteSignal = detectOAuthRouteSignal(context, combined);
  const oauthProviderLabel = oauthProvider.endsWith('-oauth') ? oauthProvider.replace(/-oauth$/, '') : 'oauth';
  const hasAuthKeySignal = detectAuthKeySignal(combined);
  const hasOAuthPermissionSignal = detectOAuthPermissionSignal(combined);
  const hasQuotaSignal = detectQuotaSignal(combined);
  const hasRateLimitSignal = detectRateLimitSignal(statusCode, combined, hasQuotaSignal);
  const hasModelSignal = detectModelSignal(combined);

  const authContext = { hasOAuthRouteSignal, hasManagedRouteSignal, oauthProviderLabel };

  return (
    classifyOAuthPermissionError(statusCode, combined, responseBody, msg, authContext, hasOAuthPermissionSignal) ??
    classifyRateLimitError(statusCode, combined, responseBody, msg, authContext, hasRateLimitSignal, hasQuotaSignal) ??
    classifyAuthError(statusCode, combined, responseBody, msg, authContext, hasAuthKeySignal) ??
    classifyContextLengthError(statusCode, combined) ??
    classifyEndpointError(statusCode, combined, responseBody, msg, authContext, hasModelSignal) ??
    classifyModelError(statusCode, combined, responseBody, msg, authContext, hasModelSignal) ??
    classifyTimeoutError(statusCode, combined) ??
    classifyNetworkError(statusCode, combined) ??
    classifyServerError(statusCode, combined) ??
    classifyEmptyBodyError(statusCode, combined) ??
    createUnknownError(msg)
  );
}
