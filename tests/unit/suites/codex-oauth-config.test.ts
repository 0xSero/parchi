import { PROVIDER_REGISTRY } from '../../../packages/extension/ai/providers/registry.js';
import {
  CODEX_OAUTH_BASE_URL,
  buildCodexOAuthProviderOptions,
  isCodexOAuthProvider,
} from '../../../packages/extension/ai/sdk/index.js';
import { OAUTH_PROVIDERS } from '../../../packages/extension/oauth/providers.js';
import { type TestRunner, log } from '../shared/runner.js';

export function runCodexOauthConfigSuite(runner: TestRunner) {
  log('\n=== Testing Codex OAuth Runtime Config ===', 'info');

  runner.test('Codex OAuth provider detection works', () => {
    runner.assertTrue(isCodexOAuthProvider('codex-oauth'));
    runner.assertFalse(isCodexOAuthProvider('openai'));
  });

  runner.test('Codex OAuth provider options force store=false and instructions', () => {
    const options = buildCodexOAuthProviderOptions('System prompt');
    runner.assertEqual(options.openai.store, false);
    runner.assertEqual(options.openai.instructions, 'System prompt');
  });

  runner.test('Codex OAuth base URLs target ChatGPT codex endpoint', () => {
    runner.assertEqual(OAUTH_PROVIDERS.codex.apiBaseUrl, CODEX_OAUTH_BASE_URL);
    runner.assertEqual(PROVIDER_REGISTRY['codex-oauth']?.defaultBaseUrl, CODEX_OAUTH_BASE_URL);
    runner.assertTrue(String(PROVIDER_REGISTRY['codex-oauth']?.modelsEndpoint || '').includes('client_version'));
  });
}
