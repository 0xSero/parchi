// Model fetching for providers
import { extractModelEntries, fetchWithTimeout } from './model-listing.js';
import type { ModelEntry, ProviderCredentials, ProviderDefinition } from './types.js';

export async function fetchModelsForProvider(
  def: ProviderDefinition,
  credentials: ProviderCredentials,
): Promise<ModelEntry[]> {
  if (!def.supportsModelListing) {
    return def.models || [];
  }

  const apiKey = credentials.oauthAccessToken || credentials.apiKey || '';
  if (!apiKey) return def.models || [];

  const baseURL = (credentials.customEndpoint || def.defaultBaseUrl).replace(/\/+$/, '');
  if (!baseURL) return def.models || [];

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...def.defaultHeaders,
    ...credentials.extraHeaders,
  };

  if (def.authHeaderStyle === 'x-api-key') {
    headers['X-Api-Key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const endpoint = def.modelsEndpoint || '/models';
  let base = baseURL;
  if (base.endsWith('/v1') && endpoint.startsWith('/v1/')) {
    base = base.slice(0, -3);
  }

  try {
    const response = await fetchWithTimeout(`${base}${endpoint}`, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      console.warn(`[provider-registry] ${def.key} model fetch returned ${response.status}`);
      return def.models || [];
    }
    const data = await response.json();
    const models = extractModelEntries(data);
    return models.length > 0 ? models : def.models || [];
  } catch (err) {
    console.warn(`[provider-registry] Failed to fetch models for ${def.key}:`, err);
    return def.models || [];
  }
}
