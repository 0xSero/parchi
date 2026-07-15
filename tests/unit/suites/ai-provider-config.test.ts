import { type TestRunner, log } from '../shared/runner.js';
import type { ProviderConfig } from '../shared/types.js';

export async function runAiProviderConfigSuite(runner: TestRunner) {
  log('\n=== Testing AI Provider Configuration ===', 'info');

  await runner.test('OpenAI provider config is valid', () => {
    const config: ProviderConfig = {
      provider: 'openai',
      apiKey: 'sk-placeholder',
      model: 'gpt-4o',
      systemPrompt: 'Test prompt',
    };

    runner.assertEqual(config.provider, 'openai');
    runner.assertTrue(config.apiKey.startsWith('sk-'), 'OpenAI keys should start with sk-');
  });

  await runner.test('Anthropic provider config is valid', () => {
    const config: ProviderConfig = {
      provider: 'anthropic',
      apiKey: 'test-key',
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: 'Test prompt',
    };

    runner.assertEqual(config.provider, 'anthropic');
    runner.assertTrue(config.model.includes('claude'), 'Anthropic model should contain "claude"');
  });

  await runner.test('Custom provider config is valid', () => {
    const config: ProviderConfig = {
      provider: 'custom',
      apiKey: 'custom-key',
      model: 'custom-model',
      customEndpoint: 'https://api.example.com/v1',
      systemPrompt: 'Test prompt',
    };

    runner.assertEqual(config.provider, 'custom');
    runner.assertTrue((config.customEndpoint ?? '').startsWith('https://'), 'Custom endpoint should use HTTPS');
  });
}
