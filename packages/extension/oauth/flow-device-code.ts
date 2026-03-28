import { generateCodeChallenge, generateCodeVerifier } from './pkce.js';
import type { DeviceCodeResponse, OAuthProviderConfig, OAuthTokenSet } from './types.js';

const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export interface DeviceCodeFlowCallbacks {
  onDeviceCode: (response: DeviceCodeResponse) => void;
  onError?: (error: Error) => void;
}

function requireDeviceCodeUrl(config: OAuthProviderConfig): string {
  const deviceCodeUrl = config.deviceCodeUrl?.trim();
  if (!deviceCodeUrl) {
    throw new Error(`OAuth provider ${config.key} requires a deviceCodeUrl for device code flow.`);
  }
  return deviceCodeUrl;
}

async function requestDeviceCode(config: OAuthProviderConfig): Promise<DeviceCodeResponse> {
  const params: Record<string, string> = {
    client_id: config.clientId,
    scope: config.scopes,
  };

  // Qwen uses PKCE with device code flow
  let codeVerifier: string | undefined;
  if (config.flowType === 'device_code_pkce') {
    codeVerifier = generateCodeVerifier(32);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    params.code_challenge = codeChallenge;
    params.code_challenge_method = 'S256';
  }

  const response = await fetch(requireDeviceCodeUrl(config), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(params).toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Device code request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return {
    device_code: data.device_code,
    user_code: data.user_code,
    verification_uri: data.verification_uri,
    verification_uri_complete: data.verification_uri_complete,
    expires_in: data.expires_in || 300,
    interval: data.interval || 5,
    code_verifier: codeVerifier,
  };
}

async function pollForTokens(
  config: OAuthProviderConfig,
  deviceCode: DeviceCodeResponse,
  signal?: AbortSignal,
): Promise<OAuthTokenSet> {
  const intervalMs = (deviceCode.interval || 5) * 1000;
  const deadline = Date.now() + Math.min(deviceCode.expires_in * 1000, POLL_TIMEOUT_MS);

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('OAuth flow was cancelled.');

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    if (signal?.aborted) throw new Error('OAuth flow was cancelled.');

    const params: Record<string, string> = {
      client_id: config.clientId,
      device_code: deviceCode.device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    };

    if (deviceCode.code_verifier) {
      params.code_verifier = deviceCode.code_verifier;
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams(params).toString(),
    });

    const data = await response.json();

    // GitHub returns 200 for both success and error in device flow
    if (data.error) {
      if (data.error === 'authorization_pending') continue;
      if (data.error === 'slow_down') {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      if (data.error === 'expired_token') throw new Error('Device code expired. Please try again.');
      if (data.error === 'access_denied') throw new Error('Access denied by user.');
      throw new Error(`OAuth error: ${data.error} - ${data.error_description || ''}`);
    }

    if (data.access_token) {
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
        tokenType: data.token_type || 'Bearer',
        resourceUrl: data.resource_url,
        raw: data,
      };
    }
  }

  throw new Error('Device code flow timed out.');
}

/**
 * GitHub Copilot requires a second token exchange:
 * GitHub OAuth token -> Copilot API JWT token
 */
async function fetchCopilotApiToken(githubAccessToken: string): Promise<{
  token: string;
  expiresAt: number;
}> {
  const response = await fetch('https://api.github.com/copilot_internal/v2/token', {
    headers: {
      Authorization: `token ${githubAccessToken}`,
      Accept: 'application/json',
      'User-Agent': 'GithubCopilot/1.0',
      'Editor-Version': 'vscode/1.100.0',
      'Editor-Plugin-Version': 'copilot/1.300.0',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Copilot token exchange failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return {
    token: data.token,
    expiresAt: data.expires_at ? data.expires_at * 1000 : Date.now() + 30 * 60 * 1000,
  };
}

async function fetchGitHubUserInfo(accessToken: string): Promise<{ login: string; email: string }> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `token ${accessToken}`,
      Accept: 'application/json',
      'User-Agent': 'GithubCopilot/1.0',
    },
  });
  if (!response.ok) return { login: '', email: '' };
  const data = await response.json();
  return { login: data.login || '', email: data.email || '' };
}

/**
 * Runs the Device Code flow for GitHub Copilot and Qwen.
 *
 * Returns a DeviceCodeResponse first (via callback) so the UI can display
 * the user code, then polls for completion. Works identically in Chrome
 * and Firefox since it only uses fetch().
 */
export async function runDeviceCodeFlow(
  config: OAuthProviderConfig,
  callbacks: DeviceCodeFlowCallbacks,
  signal?: AbortSignal,
): Promise<OAuthTokenSet> {
  const deviceCode = await requestDeviceCode(config);
  callbacks.onDeviceCode(deviceCode);

  const tokens = await pollForTokens(config, deviceCode, signal);

  if (config.key === 'copilot') {
    const userInfo = await fetchGitHubUserInfo(tokens.accessToken);
    const copilotToken = await fetchCopilotApiToken(tokens.accessToken);
    return {
      ...tokens,
      // Store the GitHub token as refreshToken (long-lived) and the Copilot JWT as accessToken
      refreshToken: tokens.accessToken,
      accessToken: copilotToken.token,
      expiresAt: copilotToken.expiresAt,
      email: userInfo.email || userInfo.login,
      accountId: userInfo.login,
    };
  }

  return tokens;
}

/**
 * Refresh a Copilot API JWT using the stored GitHub access token.
 */
export async function refreshCopilotToken(githubAccessToken: string): Promise<{
  accessToken: string;
  expiresAt: number;
}> {
  const result = await fetchCopilotApiToken(githubAccessToken);
  return { accessToken: result.token, expiresAt: result.expiresAt };
}

/**
 * Refresh a Qwen token using the refresh_token grant.
 */
export async function refreshQwenToken(config: OAuthProviderConfig, refreshToken: string): Promise<OAuthTokenSet> {
  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.clientId,
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Qwen token refresh failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    tokenType: data.token_type || 'Bearer',
    resourceUrl: data.resource_url,
    raw: data,
  };
}
