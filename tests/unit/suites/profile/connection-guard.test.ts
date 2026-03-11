import { type ProviderConnectionConfig, isProviderConnectionConfig } from '@parchi/shared';
import type { TestRunner } from '../../shared/runner.js';
import { log } from '../../shared/runner.js';

export function runConnectionGuardSuite(runner: TestRunner) {
  log('\n=== Testing isProviderConnectionConfig ===', 'info');

  runner.test('isProviderConnectionConfig accepts valid connection config', () => {
    const valid: ProviderConnectionConfig = {
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'placeholder-api-key',
      customEndpoint: '',
      extraHeaders: {},
    };

    runner.assertTrue(isProviderConnectionConfig(valid));
  });

  runner.test('isProviderConnectionConfig rejects non-object values', () => {
    runner.assertFalse(isProviderConnectionConfig(null));
    runner.assertFalse(isProviderConnectionConfig(undefined));
    runner.assertFalse(isProviderConnectionConfig('string'));
    runner.assertFalse(isProviderConnectionConfig(123));
    runner.assertFalse(isProviderConnectionConfig(true));
  });

  runner.test('isProviderConnectionConfig rejects objects with wrong types', () => {
    runner.assertFalse(isProviderConnectionConfig({ provider: 123 }));
    runner.assertFalse(isProviderConnectionConfig({ model: null }));
    runner.assertFalse(isProviderConnectionConfig({ apiKey: true }));
  });

  runner.test('isProviderConnectionConfig accepts config with missing extraHeaders', () => {
    const withoutHeaders = {
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'placeholder-api-key',
      customEndpoint: '',
    };

    runner.assertTrue(isProviderConnectionConfig(withoutHeaders));
  });
}
