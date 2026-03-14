import { resolveRuntimeModelProfile } from '../../../packages/extension/background/model-profiles.js';
import { isLikelyJwt, isUsableRuntimeJwt } from '../../../packages/extension/convex/client.js';
import { type TestRunner, log } from '../shared/runner.js';

export function runRuntimeProfileRoutingSuite(runner: TestRunner) {
  log('\n=== Testing Runtime Model Profile Routing ===', 'info');

  runner.test('OAuth profiles route to oauth even when stale apiKey exists', () => {
    const result = resolveRuntimeModelProfile(
      {
        provider: 'copilot-oauth',
        apiKey: 'stale-key-should-not-force-byok',
        model: 'claude-sonnet-4',
      },
      {},
    );
    runner.assertTrue(result.allowed);
    runner.assertEqual(result.route, 'oauth');
  });

  runner.test('BYOK profiles still route to byok', () => {
    const result = resolveRuntimeModelProfile(
      {
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'gpt-4o-mini',
      },
      {},
    );
    runner.assertTrue(result.allowed);
    runner.assertEqual(result.route, 'byok');
  });

  runner.test('JWT guard rejects malformed paid-session tokens', () => {
    runner.assertFalse(isLikelyJwt('not-a-jwt'));
    runner.assertFalse(isLikelyJwt('missing.parts'));
    runner.assertTrue(isLikelyJwt('aaa.bbb.ccc'));
  });

  runner.test('Usable runtime JWT requires an unexpired token', () => {
    runner.assertFalse(isUsableRuntimeJwt('aaa.bbb.ccc', 0));
    runner.assertFalse(isUsableRuntimeJwt('aaa.bbb.ccc', Date.now() - 1000));
    runner.assertTrue(isUsableRuntimeJwt('aaa.bbb.ccc', Date.now() + 60_000, { minRemainingMs: 0 }));
  });

  runner.test('Paid runtime is blocked when stored managed token is malformed', () => {
    const result = resolveRuntimeModelProfile(
      {
        provider: 'parchi',
        apiKey: '',
        model: 'moonshotai/kimi-k2.5',
      },
      {
        accountModeChoice: 'paid',
        convexUrl: 'https://energetic-firefly-297.convex.cloud',
        convexAccessToken: 'not-a-jwt',
        convexSubscriptionPlan: 'pro',
        convexSubscriptionStatus: 'active',
      },
    );
    runner.assertFalse(result.allowed);
    runner.assertEqual(result.route, 'none');
    runner.assertTrue(
      String(result.errorMessage || '')
        .toLowerCase()
        .includes('sign in again'),
    );
  });
}
