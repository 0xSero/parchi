import { DEFAULT_PROFILE, type ProfileConfig, extractConnectionConfig } from '@parchi/shared';
import type { TestRunner } from '../../shared/runner.js';
import { log } from '../../shared/runner.js';

export function runExtractConnectionConfigSuite(runner: TestRunner) {
  log('\n=== Testing extractConnectionConfig ===', 'info');

  runner.test('extractConnectionConfig extracts connection fields from profile', () => {
    const profile: ProfileConfig = {
      ...DEFAULT_PROFILE,
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'placeholder-api-key',
      customEndpoint: 'https://api.openai.com',
      extraHeaders: { 'X-Custom': 'header' },
    };

    const connection = extractConnectionConfig(profile);

    runner.assertEqual(connection.provider, 'openai');
    runner.assertEqual(connection.model, 'gpt-4o');
    runner.assertEqual(connection.apiKey, 'placeholder-api-key');
    runner.assertEqual(connection.customEndpoint, 'https://api.openai.com');
    runner.assertEqual(connection.extraHeaders['X-Custom'], 'header');
  });

  runner.test('extractConnectionConfig excludes non-connection fields', () => {
    const profile: ProfileConfig = {
      ...DEFAULT_PROFILE,
      provider: 'anthropic',
      systemPrompt: 'This should not be in connection',
      temperature: 0.5,
      maxTokens: 4096,
    };

    const connection = extractConnectionConfig(profile);

    runner.assertEqual(connection.provider, 'anthropic');
    runner.assertTrue(!('systemPrompt' in connection));
    runner.assertTrue(!('temperature' in connection));
    runner.assertTrue(!('maxTokens' in connection));
  });

  runner.test('extractConnectionConfig handles extraHeaders undefined', () => {
    const profile: ProfileConfig = {
      ...DEFAULT_PROFILE,
      provider: 'test',
      extraHeaders: {},
    };

    const connection = extractConnectionConfig(profile);
    runner.assertEqual(Object.keys(connection.extraHeaders).length, 0);
  });
}
