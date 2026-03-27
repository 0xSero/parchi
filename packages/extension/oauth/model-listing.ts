import type { OAuthProviderConfig } from './types.js';

const MODEL_FETCH_TIMEOUT = 8000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MODEL_FETCH_TIMEOUT);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function extractModelIds(payload: unknown): string[] {
  if (!payload) return [];
  const p = payload as { data?: unknown; models?: unknown };
  const source = Array.isArray(p.data)
    ? p.data
    : Array.isArray(p.models)
      ? p.models
      : Array.isArray(payload)
        ? payload
        : [];
  return source
    .map((entry: unknown) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') {
        const e = entry as { id?: unknown; name?: unknown; slug?: unknown };
        if (typeof e.id === 'string') return e.id;
        if (typeof e.slug === 'string') return e.slug;
        if (typeof e.name === 'string') return e.name;
      }
      return '';
    })
    .map((id: string) => id.trim())
    .filter((id: string) => id.length > 0);
}

const CODEX_CLIENT_VERSION = '1.0.0';

/**
 * Codex OAuth (ChatGPT subscription): GET https://chatgpt.com/backend-api/codex/models?client_version=1.0.0
 * Auth: Authorization: Bearer {token}
 */
export async function fetchCodexModels(token: string, baseUrl: string): Promise<string[]> {
  const base = baseUrl.replace(/\/+$/, '');
  const url = `${base}/models?client_version=${encodeURIComponent(CODEX_CLIENT_VERSION)}`;
  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    console.warn(`[OAuth] Codex /models returned ${response.status}`);
    return [];
  }
  const data = await response.json();
  return extractModelIds(data);
}

/**
 * Anthropic: GET https://api.anthropic.com/v1/models
 * Auth: X-Api-Key header (OAuth token used as API key)
 */
export async function fetchAnthropicModels(token: string, baseUrl: string): Promise<string[]> {
  let base = baseUrl.replace(/\/+$/, '');
  if (base.endsWith('/v1')) base = base.slice(0, -3);
  const allIds: string[] = [];
  let afterId: string | undefined;

  for (let page = 0; page < 5; page++) {
    const params = new URLSearchParams({ limit: '1000' });
    if (afterId) params.set('after_id', afterId);
    const url = `${base}/v1/models?${params.toString()}`;

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      headers: {
        'X-Api-Key': token,
        'anthropic-version': '2023-06-01',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[OAuth] Anthropic /v1/models returned ${response.status}`);
      break;
    }

    const data = await response.json();
    const ids = extractModelIds(data);
    allIds.push(...ids);

    const paged = data as { has_more?: unknown; last_id?: unknown };
    if (!paged.has_more || !paged.last_id) break;
    afterId = String(paged.last_id);
  }

  return allIds;
}

/**
 * OpenAI platform: GET https://api.openai.com/v1/models
 * Auth: Authorization: Bearer {token}
 */
export async function fetchOpenAIModels(token: string): Promise<string[]> {
  const url = 'https://api.openai.com/v1/models';
  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    console.warn(`[OAuth] OpenAI /v1/models returned ${response.status}`);
    return [];
  }
  const data = await response.json();
  return extractModelIds(data);
}

/**
 * GitHub Copilot: GET https://api.githubcopilot.com/models
 * Auth: Authorization: Bearer {copilot JWT}
 */
export async function fetchCopilotModels(
  token: string,
  baseUrl: string,
  apiHeaders?: Record<string, string>,
): Promise<string[]> {
  const url = `${baseUrl.replace(/\/+$/, '')}/models`;
  const response = await fetchWithTimeout(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(apiHeaders || {}),
    },
  });
  if (!response.ok) {
    console.warn(`[OAuth] Copilot /models returned ${response.status}`);
    return [];
  }
  const data = await response.json();
  return extractModelIds(data);
}

/**
 * Qwen or other OpenAI-compatible: try /models then /v1/models
 */
export async function fetchOpenAICompatibleModels(token: string, baseUrl: string): Promise<string[]> {
  const base = baseUrl.replace(/\/+$/, '');
  const urls = base.endsWith('/v1') ? [`${base}/models`] : [`${base}/models`, `${base}/v1/models`];
  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      if (!response.ok) continue;
      const data = await response.json();
      const ids = extractModelIds(data);
      if (ids.length > 0) return ids;
    } catch (_fetchErr) {
      // Model list fetch failed for this URL; skip.
    }
  }
  return [];
}

export function getStaticOAuthModelIds(config: OAuthProviderConfig): string[] {
  return config.models.map((m) => m.id);
}
