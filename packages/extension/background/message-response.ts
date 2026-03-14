export type RuntimeMessageResponse = {
  success: boolean;
  error?: string;
  errorName?: string;
  errorStack?: string;
  details?: unknown;
  [key: string]: unknown;
};

export type RuntimeSendResponse = (response: RuntimeMessageResponse) => void;

const toErrorLike = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message || 'Unknown error',
      name: error.name || 'Error',
      stack: error.stack || '',
    };
  }

  if (typeof error === 'string') {
    return {
      message: error,
      name: 'Error',
      stack: '',
    };
  }

  return {
    message: String(error ?? 'Unknown error'),
    name: 'Error',
    stack: '',
  };
};

export function serializeRuntimeError(error: unknown) {
  return toErrorLike(error);
}

export function respondOk(sendResponse: RuntimeSendResponse, extras: Omit<RuntimeMessageResponse, 'success'> = {}) {
  sendResponse({ success: true, ...extras });
}

export function respondAccepted(sendResponse: RuntimeSendResponse, sessionId: string) {
  respondOk(sendResponse, { accepted: true, sessionId });
}

export function assertNonEmptyString(value: unknown, errorMessage: string) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(errorMessage);
  return normalized;
}

export function assertArray<T = unknown>(value: unknown, errorMessage: string) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(errorMessage);
  }
  return value as T[];
}

export function createResponseController(sendResponse: RuntimeSendResponse) {
  let responded = false;

  const respond = (payload: RuntimeMessageResponse) => {
    if (responded) {
      console.warn('[runtime-message] Duplicate response suppressed:', payload);
      return;
    }
    responded = true;
    sendResponse(payload);
  };

  const fail = (error: unknown, extras: Omit<RuntimeMessageResponse, 'success'> = {}) => {
    const serialized = serializeRuntimeError(error);
    respond({
      success: false,
      error: serialized.message,
      errorName: serialized.name,
      ...(serialized.stack ? { errorStack: serialized.stack } : {}),
      ...extras,
    });
  };

  return {
    respond,
    fail,
    hasResponded: () => responded,
  };
}
