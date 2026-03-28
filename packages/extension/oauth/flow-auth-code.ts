import { generateCodeChallenge, generateCodeVerifier, generateState } from './pkce.js';
import type { OAuthProviderConfig, OAuthTokenSet } from './types.js';

function buildAuthorizeUrl(config: OAuthProviderConfig, state: string, codeChallenge: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri!,
    scope: config.scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    ...(config.extraAuthorizeParams || {}),
  });
  return `${config.authorizeUrl}?${params.toString()}`;
}

function extractCallbackCode(url: string, expectedState: string): string | null {
  try {
    const parsed = new URL(url);
    const code = parsed.searchParams.get('code');
    const returnedState = parsed.searchParams.get('state');
    if (!code) return null;
    if (expectedState && returnedState !== expectedState) return null;
    // Claude may append URL fragments to the code
    return code.split('#')[0];
  } catch {
    return null;
  }
}

async function exchangeCodeForTokens(
  config: OAuthProviderConfig,
  code: string,
  codeVerifier: string,
  state: string,
): Promise<OAuthTokenSet> {
  const isClaude = config.key === 'claude';

  const headers: Record<string, string> = {};
  let body: string;

  if (isClaude) {
    // Claude uses JSON body
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({
      code,
      state,
      grant_type: 'authorization_code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
    });
  } else {
    // Codex/OpenAI uses form-encoded
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      code,
      redirect_uri: config.redirectUri!,
      code_verifier: codeVerifier,
    }).toString();
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  const data = await response.json();

  const tokens: OAuthTokenSet = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    tokenType: data.token_type || 'Bearer',
    idToken: data.id_token,
    raw: data,
  };

  // Extract email from Claude response
  if (isClaude && data.account?.email_address) {
    tokens.email = data.account.email_address;
    tokens.accountId = data.account.uuid;
  }

  // Extract email from Codex ID token JWT
  if (!isClaude && data.id_token) {
    try {
      const payload = JSON.parse(atob(data.id_token.split('.')[1]));
      tokens.email = payload.email;
      tokens.accountId = payload.account_id || payload.sub;
    } catch {
      /* ignore JWT parse failures */
    }
  }

  return tokens;
}

/**
 * Runs the Authorization Code + PKCE flow for Claude and Codex.
 *
 * Opens a browser tab with the OAuth authorize URL. The provider redirects
 * to a localhost URL which won't load (no server). We intercept the URL
 * change via chrome.tabs.onUpdated, capture the code, and close the tab.
 *
 * Works identically in Chrome and Firefox.
 */
export async function runAuthCodePkceFlow(config: OAuthProviderConfig, signal?: AbortSignal): Promise<OAuthTokenSet> {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();
  const authorizeUrl = buildAuthorizeUrl(config, state, codeChallenge);
  const redirectPrefix = config.redirectUri!.split('?')[0];

  const code = await new Promise<string>((resolve, reject) => {
    let tabId: number | undefined;
    let settled = false;

    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(listener);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      if (tabId !== undefined) {
        void chrome.tabs.remove(tabId).catch((error) => {
          console.warn('[OAuthFlowAuthCode] Failed to close auth tab during cleanup:', error);
        });
      }
    };

    const settle = (result: string | Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (result instanceof Error) reject(result);
      else resolve(result);
    };

    const listener = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (_tabId !== tabId || !changeInfo.url) return;
      const url = changeInfo.url;
      if (!url.startsWith(redirectPrefix)) return;

      const authCode = extractCallbackCode(url, state);
      if (authCode) {
        settle(authCode);
      } else {
        settle(new Error('OAuth callback did not contain a valid authorization code.'));
      }
    };

    const onRemoved = (_tabId: number) => {
      if (_tabId !== tabId) return;
      tabId = undefined;
      settle(new Error('OAuth tab was closed before authentication completed.'));
    };

    if (signal) {
      signal.addEventListener('abort', () => settle(new Error('OAuth flow was cancelled.')), { once: true });
    }

    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.onRemoved.addListener(onRemoved);

    chrome.tabs
      .create({ url: authorizeUrl, active: true })
      .then((tab) => {
        if (settled) {
          if (tab.id) {
            void chrome.tabs.remove(tab.id).catch((error) => {
              console.warn('[OAuthFlowAuthCode] Failed to close unused auth tab:', error);
            });
          }
          return;
        }
        tabId = tab.id;
      })
      .catch((err) => settle(err instanceof Error ? err : new Error(String(err))));
  });

  return exchangeCodeForTokens(config, code, codeVerifier, state);
}

/**
 * Refresh an access token using the provider's refresh_token grant.
 */
export async function refreshAuthCodeTokens(config: OAuthProviderConfig, refreshToken: string): Promise<OAuthTokenSet> {
  const isClaude = config.key === 'claude';

  const headers: Record<string, string> = {};
  let body: string;

  if (isClaude) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify({
      client_id: config.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams({
      client_id: config.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: 'openid profile email',
    }).toString();
  }

  const response = await fetch(config.tokenUrl, { method: 'POST', headers, body });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Token refresh failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    tokenType: data.token_type || 'Bearer',
    idToken: data.id_token,
    raw: data,
  };
}
