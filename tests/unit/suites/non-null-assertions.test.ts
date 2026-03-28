import { resolveProxyProvider } from '../../../packages/extension/ai/sdk/provider-proxy.js';
import { runAuthCodePkceFlow } from '../../../packages/extension/oauth/flow-auth-code.js';
import { runDeviceCodeFlow } from '../../../packages/extension/oauth/flow-device-code.js';
import type { OAuthProviderConfig } from '../../../packages/extension/oauth/types.js';
import { type TestRunner, log } from '../shared/runner.js';

const AUTH_CODE_CONFIG: OAuthProviderConfig = {
  key: 'codex',
  name: 'Codex',
  flowType: 'authorization_code_pkce',
  clientId: 'client-id',
  authorizeUrl: 'https://example.com/authorize',
  tokenUrl: 'https://example.com/token',
  scopes: 'openid profile email',
  models: [],
  apiBaseUrl: 'https://example.com/api',
};

const DEVICE_CODE_CONFIG: OAuthProviderConfig = {
  key: 'copilot',
  name: 'Copilot',
  flowType: 'device_code',
  clientId: 'client-id',
  tokenUrl: 'https://example.com/token',
  scopes: 'read:user',
  models: [],
  apiBaseUrl: 'https://example.com/api',
};

export function runNonNullAssertionsSuite(runner: TestRunner) {
  log('\n=== Testing Non-null Assertion Guards ===', 'info');

  runner.test('Proxy provider resolution rejects missing proxyBaseUrl', () => {
    let thrownMessage = '';
    try {
      resolveProxyProvider(
        {
          provider: 'openai',
          apiKey: '',
          model: 'gpt-4o-mini',
          useProxy: true,
          proxyAuthToken: 'token',
        },
        'gpt-4o-mini',
        undefined,
      );
      throw new Error('Expected resolveProxyProvider to reject missing proxyBaseUrl');
    } catch (error) {
      thrownMessage = error instanceof Error ? error.message : String(error);
    }
    runner.assertIncludes(thrownMessage, 'proxyBaseUrl');
  });

  runner.test('Auth code PKCE flow rejects missing redirectUri before opening tabs', async () => {
    await runner.assertRejects(
      runAuthCodePkceFlow(AUTH_CODE_CONFIG),
      'redirectUri',
      'Expected runAuthCodePkceFlow to require redirectUri',
    );
  });

  runner.test('Device code flow rejects missing deviceCodeUrl before requesting codes', async () => {
    await runner.assertRejects(
      runDeviceCodeFlow(DEVICE_CODE_CONFIG, {
        onDeviceCode: () => {
          throw new Error('onDeviceCode should not run when deviceCodeUrl is missing');
        },
      }),
      'deviceCodeUrl',
      'Expected runDeviceCodeFlow to require deviceCodeUrl',
    );
  });
}
