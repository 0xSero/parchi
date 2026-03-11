// Model utility functions for encoding, decoding, and normalizing

export const MODEL_SELECT_VALUE_SEPARATOR = '::';
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export const normalizeProvider = (provider: unknown) =>
  String(provider || '')
    .trim()
    .toLowerCase();

export const normalizeHeaders = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key.length > 0)
      .map(([key, headerValue]) => [key, headerValue == null ? '' : String(headerValue)]),
  );
};

export const normalizeEndpointBase = (provider: string, customEndpoint: string) => {
  const raw = String(customEndpoint || '').trim();
  const fallback =
    provider === 'openrouter' || provider === 'parchi'
      ? OPENROUTER_BASE_URL
      : provider === 'glm'
        ? 'https://api.z.ai/api/anthropic'
        : provider === 'minimax'
          ? 'https://api.minimax.io/anthropic'
          : provider === 'openai'
            ? 'https://api.openai.com/v1'
            : provider === 'anthropic'
              ? 'https://api.anthropic.com/v1'
              : provider === 'kimi'
                ? 'https://api.kimi.com/coding/v1'
                : '';

  const base = (raw || fallback)
    .replace(/\/chat\/completions\/?$/i, '')
    .replace(/\/completions\/?$/i, '')
    .replace(/\/v1\/messages\/?$/i, '')
    .replace(/\/messages\/?$/i, '')
    .replace(/\/+$/, '');
  return base;
};

export const buildModelEndpointCandidates = (base: string): string[] => {
  const normalized = String(base || '')
    .trim()
    .replace(/\/+$/, '');
  if (!normalized) return [];
  if (/\/v1$/i.test(normalized) || /\/api\/v1$/i.test(normalized)) {
    return [`${normalized}/models`];
  }
  return [`${normalized}/models`, `${normalized}/v1/models`];
};

export const encodeModelSelectValue = (providerId: string, modelId: string) =>
  `${encodeURIComponent(providerId)}${MODEL_SELECT_VALUE_SEPARATOR}${encodeURIComponent(modelId)}`;

export const decodeModelSelectValue = (value: string): { providerId: string; modelId: string } | null => {
  const [providerId, modelId] = String(value || '').split(MODEL_SELECT_VALUE_SEPARATOR);
  if (!providerId || !modelId) return null;
  return {
    providerId: decodeURIComponent(providerId),
    modelId: decodeURIComponent(modelId),
  };
};

export const extractModelIds = (payload: any): string[] => {
  if (!payload) return [];
  const source = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : Array.isArray(payload)
        ? payload
        : [];

  const ids = source
    .map((entry: any) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry.id === 'string') return entry.id;
      if (entry && typeof entry.name === 'string') return entry.name;
      return '';
    })
    .map((id: string) => id.trim())
    .filter((id: string) => id.length > 0);

  return Array.from(new Set(ids));
};

export const populateModelSelectElement = (
  select: HTMLSelectElement,
  models: string[],
  currentValue: string,
  placeholder = 'Select model...',
  datalist?: HTMLDataListElement | null,
) => {
  const prevValue = select.value || currentValue;
  select.innerHTML = '';

  const placeholderOpt = document.createElement('option');
  placeholderOpt.value = '';
  placeholderOpt.textContent = placeholder;
  select.appendChild(placeholderOpt);

  // Always include current value even if not in fetched list
  if (prevValue && !models.includes(prevValue)) {
    const opt = document.createElement('option');
    opt.value = prevValue;
    opt.textContent = prevValue;
    select.appendChild(opt);
  }

  for (const model of models) {
    const opt = document.createElement('option');
    opt.value = model;
    opt.textContent = model;
    select.appendChild(opt);
  }

  if (prevValue) {
    select.value = prevValue;
  }

  if (datalist) {
    datalist.innerHTML = '';
    for (const model of models) {
      const option = document.createElement('option');
      option.value = model;
      datalist.appendChild(option);
    }
  }
};

export const populateModelSuggestionList = (list: HTMLDataListElement, models: string[]) => {
  list.innerHTML = '';
  for (const model of models) {
    const option = document.createElement('option');
    option.value = model;
    list.appendChild(option);
  }
};

export const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timerId: number | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timerId = window.setTimeout(() => reject(new Error('Timed out')), timeoutMs);
      }),
    ]);
  } finally {
    if (timerId !== null) {
      window.clearTimeout(timerId);
    }
  }
};
