import { resolveProxyProvider } from '../../../packages/extension/ai/sdk/provider-proxy.js';
import { type TestRunner, log } from '../shared/runner.js';

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
}
