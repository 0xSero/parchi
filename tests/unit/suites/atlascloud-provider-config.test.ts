import { PROVIDER_REGISTRY } from '../../../packages/extension/ai/providers/registry.js';
import { type TestRunner, log } from '../shared/runner.js';

export function runAtlasCloudProviderConfigSuite(runner: TestRunner) {
  log('\n=== Testing Atlas Cloud Provider Config ===', 'info');

  runner.test('Atlas Cloud uses its OpenAI-compatible API endpoints', () => {
    const provider = PROVIDER_REGISTRY.atlascloud;

    runner.assertEqual(provider?.sdkType, 'openai-compatible');
    runner.assertEqual(provider?.defaultBaseUrl, 'https://api.atlascloud.ai/v1');
    runner.assertEqual(provider?.modelsEndpoint, '/models');
    runner.assertTrue(provider?.supportsModelListing === true);
  });
}
