// Provider URL normalization utilities
export const toAnthropicBaseUrl = (value: string): string => {
  const base = value
    .replace(/\/v1\/messages\/?$/i, '')
    .replace(/\/messages\/?$/i, '')
    .replace(/\/+$/, '');
  return /\/v1$/i.test(base) ? base : `${base}/v1`;
};
