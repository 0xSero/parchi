import { createExponentialBackoff, isValidFinalResponse } from '../../../packages/extension/ai/models/retry-engine.js';
import { type TestRunner, log } from '../shared/runner.js';

export function runRetryHelpersSuite(runner: TestRunner) {
  log('\n=== Testing Retry Helpers ===', 'info');

  runner.test('isValidFinalResponse rejects empty and quit phrases', () => {
    runner.assertFalse(isValidFinalResponse(''), 'Empty response should be invalid');
    runner.assertFalse(isValidFinalResponse('Please try again.'), 'Quit phrase should be invalid');
    runner.assertFalse(
      isValidFinalResponse('I could not produce a final response.'),
      'Quit phrase variants should be invalid',
    );
    runner.assertTrue(isValidFinalResponse('Here is the result.'), 'Normal response should be valid');
  });

  runner.test('createExponentialBackoff caps and scales', () => {
    const backoff = createExponentialBackoff({
      baseMs: 100,
      maxMs: 1000,
      jitter: 0,
    });
    runner.assertEqual(backoff(1), 100);
    runner.assertEqual(backoff(2), 200);
    runner.assertEqual(backoff(4), 800);
    runner.assertEqual(backoff(6), 1000);
  });

  runner.test('createExponentialBackoff applies jitter with custom rng', () => {
    const backoff = createExponentialBackoff({
      baseMs: 100,
      maxMs: 1000,
      jitter: 0.5,
      rng: () => 1,
    });
    runner.assertEqual(backoff(1), 150);
    runner.assertEqual(backoff(0), 150, 'Attempt <= 0 should clamp to 1');
  });

  runner.test('isValidFinalResponse supports custom quit phrases', () => {
    runner.assertFalse(isValidFinalResponse('Stop here.', { quitPhrases: ['stop here'] }));
    runner.assertTrue(isValidFinalResponse('Stop here.'), 'Default phrases should not block custom text');
  });

  runner.test('isValidFinalResponse supports allowEmpty and rejects runaway repetition', () => {
    runner.assertTrue(isValidFinalResponse('', { allowEmpty: true }), 'Empty response can be allowed explicitly');

    const repeated = Array.from({ length: 8 }, () => 'This sentence repeats far too much and should be rejected.').join(
      ' ',
    );
    runner.assertFalse(isValidFinalResponse(repeated), 'Runaway repetition should be rejected');
    runner.assertFalse(isValidFinalResponse(123), 'Non-string responses should be rejected');
  });

  runner.test('createExponentialBackoff falls back to defaults for non-finite options', () => {
    const backoff = createExponentialBackoff({
      baseMs: Number.NaN,
      maxMs: Number.NaN,
      jitter: Number.NaN,
      rng: () => 0.5,
    });

    runner.assertEqual(backoff(1), 500);
    runner.assertEqual(backoff(5), 8000);
  });
}
