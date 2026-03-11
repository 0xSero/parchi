import type { ClassifiedError } from './error-classifier.js';

export function classifyEndpointError(
  statusCode: number,
  combined: string,
  _responseBody: string,
  _msg: string,
  _context: { hasOAuthRouteSignal: boolean; hasManagedRouteSignal: boolean; oauthProviderLabel: string },
  hasModelSignal: boolean,
): ClassifiedError | null {
  if (
    statusCode === 404 &&
    !hasModelSignal &&
    (combined.includes('/ai-proxy') ||
      combined.includes('route not found') ||
      combined.includes('endpoint not found') ||
      combined.includes('path not found') ||
      combined.includes('deployment not found') ||
      combined.includes('convex'))
  ) {
    return {
      category: 'server',
      message: 'Runtime endpoint was not found (404).',
      action: 'Use your Convex HTTP URL (*.convex.site), and ensure ai-proxy routes are deployed.',
      recoverable: false,
    };
  }
  return null;
}

export function classifyTimeoutError(_statusCode: number, combined: string): ClassifiedError | null {
  if (
    combined.includes('timeout') ||
    combined.includes('timed out') ||
    combined.includes('deadline exceeded') ||
    combined.includes('econnaborted')
  ) {
    return {
      category: 'timeout',
      message: 'Request timed out.',
      action: 'Try again or increase the timeout in settings.',
      recoverable: true,
    };
  }
  return null;
}

export function classifyNetworkError(_statusCode: number, combined: string): ClassifiedError | null {
  if (
    combined.includes('network') ||
    combined.includes('econnrefused') ||
    combined.includes('enotfound') ||
    combined.includes('fetch failed') ||
    combined.includes('failed to fetch') ||
    combined.includes('dns') ||
    combined.includes('socket') ||
    combined.includes('econnreset')
  ) {
    return {
      category: 'network',
      message: 'Network error. Could not reach the API.',
      action: 'Check your internet connection and endpoint URL.',
      recoverable: true,
    };
  }
  return null;
}

export function classifyServerError(statusCode: number, combined: string): ClassifiedError | null {
  if (statusCode >= 500 || combined.includes('internal server error') || combined.includes('server error')) {
    return {
      category: 'server',
      message: `Server error (${statusCode || 'unknown'}). The API provider may be experiencing issues.`,
      action: 'Try again in a few minutes.',
      recoverable: true,
    };
  }
  return null;
}

export function classifyEmptyBodyError(statusCode: number, combined: string): ClassifiedError | null {
  if (
    (statusCode === 200 || statusCode === 204 || statusCode === 0) &&
    (combined.includes('200 ok') ||
      combined.includes('response body was empty') ||
      combined.includes('empty response body') ||
      combined.includes('returned no body') ||
      combined.includes('no output generated'))
  ) {
    return {
      category: 'server',
      message: 'Provider returned an empty response body.',
      action: 'Wait a few seconds and retry, or switch to a fallback model.',
      recoverable: true,
    };
  }
  return null;
}

export function createUnknownError(msg: string): ClassifiedError {
  return {
    category: 'unknown',
    message: msg || 'An unexpected error occurred.',
    action: undefined,
    recoverable: false,
  };
}
