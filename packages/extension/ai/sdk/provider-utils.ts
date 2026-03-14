// Provider URL normalization utilities
export const toAnthropicBaseUrl = (value: string): string => {
  const base = value
    .replace(/\/v1\/messages\/?$/i, '')
    .replace(/\/messages\/?$/i, '')
    .replace(/\/+$/, '');
  return /\/v1$/i.test(base) ? base : `${base}/v1`;
};

export const buildAnthropicCompatibleHeaders = (
  provider: string,
  apiKey: string,
  extraHeaders: Record<string, string> | undefined,
): Record<string, string> | undefined => {
  const headers = { ...(extraHeaders || {}) };
  if (provider === 'minimax' && apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return Object.keys(headers).length ? headers : undefined;
};
