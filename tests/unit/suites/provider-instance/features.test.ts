import {
  type ProviderInstance,
  createProfile,
  extractConnectionConfig,
  extractConnectionFromProvider,
} from '../../../../packages/shared/src/profile.js';
import type { TestRunner } from '../../shared/runner.js';
import { log } from '../../shared/runner.js';

/**
 * Tests for ProviderInstance features beyond the base type relationship.
 * Includes OAuth handling, ProfileConfig derivation, and extraction behavior.
 */
export function runProviderInstanceFeaturesSuite(runner: TestRunner) {
  log('\n=== Testing ProviderInstance Features ===', 'info');

  runner.test('ProviderInstanceBase fields match extraction output', () => {
    const provider: ProviderInstance = {
      id: 'complete',
      name: 'Complete Provider',
      providerType: 'custom',
      authType: 'api-key',
      isConnected: true,
      models: [{ id: 'custom-model' }],
      provider: 'custom',
      model: 'custom-model',
      apiKey: 'key123',
      customEndpoint: 'https://custom.api.com',
      extraHeaders: { Authorization: 'Bearer token' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const connection = extractConnectionFromProvider(provider);

    runner.assertEqual(connection.provider, provider.providerType);
    runner.assertEqual(connection.model, provider.model);
    runner.assertEqual(connection.apiKey, provider.apiKey);
    runner.assertEqual(connection.customEndpoint, provider.customEndpoint);
    runner.assertEqual(connection.extraHeaders, provider.extraHeaders);
  });

  runner.test('ProviderInstance can be created from ProfileConfig connection fields', () => {
    const profile = createProfile({
      provider: 'openrouter',
      model: 'meta-llama/llama-3-70b',
      apiKey: 'sk-or-test',
      customEndpoint: 'https://openrouter.ai/api/v1',
      extraHeaders: { 'HTTP-Referer': 'https://example.com' },
    });

    const provider: ProviderInstance = {
      id: 'derived-from-profile',
      name: 'OpenRouter from Profile',
      providerType: profile.provider,
      authType: 'api-key',
      isConnected: true,
      models: [{ id: profile.model }],
      provider: profile.provider,
      model: profile.model,
      apiKey: profile.apiKey,
      customEndpoint: profile.customEndpoint,
      extraHeaders: profile.extraHeaders,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    runner.assertEqual(provider.providerType, 'openrouter');
    runner.assertEqual(provider.model, 'meta-llama/llama-3-70b');

    const profileConn = extractConnectionConfig(profile);
    const providerConn = extractConnectionFromProvider(provider);

    runner.assertEqual(profileConn.provider, providerConn.provider);
    runner.assertEqual(profileConn.model, providerConn.model);
  });

  runner.test('Partial ProviderInstanceBase handles OAuth providers', () => {
    const oauthProvider: ProviderInstance = {
      id: 'oauth-test',
      name: 'OAuth Provider',
      providerType: 'copilot-oauth',
      authType: 'oauth',
      oauthProviderKey: 'github',
      oauthEmail: 'user@example.com',
      isConnected: true,
      models: [{ id: 'claude-sonnet-4' }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    runner.assertEqual(oauthProvider.apiKey, undefined);
    runner.assertEqual(oauthProvider.customEndpoint, undefined);

    const connection = extractConnectionFromProvider(oauthProvider);
    runner.assertEqual(connection.provider, 'copilot-oauth');
    runner.assertEqual(connection.apiKey, '');
  });
}
