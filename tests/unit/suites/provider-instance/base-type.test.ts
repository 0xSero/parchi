import {
  CONNECTION_CONFIG_FIELDS,
  type ProviderConnectionConfig,
  type ProviderInstance,
  type ProviderInstanceBase,
  createProfile,
  extractConnectionConfig,
  extractConnectionFromProvider,
} from '@parchi/shared';
import type { TestRunner } from '../../shared/runner.js';
import { log } from '../../shared/runner.js';

/**
 * Tests verifying that ProviderInstance and ProfileConfig share the same base type shape.
 * This ensures type compatibility and proper extraction of connection config from both.
 */
export function runProviderInstanceBaseTypeSuite(runner: TestRunner) {
  log('\n=== Testing ProviderInstance Base Type Relationship ===', 'info');

  // ===== ProviderInstanceBase Type Tests =====
  runner.test('ProviderInstanceBase has same fields as ProviderConnectionConfig', () => {
    // ProviderInstanceBase is defined as Pick<ProviderConnectionConfig, ...>
    // This test verifies the fields are consistent
    const baseFields: (keyof ProviderInstanceBase)[] = [
      'provider',
      'model',
      'apiKey',
      'customEndpoint',
      'extraHeaders',
    ];

    // CONNECTION_CONFIG_FIELDS should match ProviderInstanceBase fields
    for (const field of baseFields) {
      runner.assertTrue(
        CONNECTION_CONFIG_FIELDS.includes(field as keyof ProviderConnectionConfig),
        `Field ${field} should be in CONNECTION_CONFIG_FIELDS`,
      );
    }

    runner.assertEqual(baseFields.length, CONNECTION_CONFIG_FIELDS.length);
  });

  runner.test('ProviderInstance extends Partial<ProviderInstanceBase>', () => {
    // ProviderInstance should accept partial base fields since auth types vary
    const minimalProvider: ProviderInstance = {
      id: 'test',
      name: 'Test',
      providerType: 'openai',
      authType: 'managed',
      isConnected: false,
      models: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // No connection fields required for managed auth
    runner.assertEqual(minimalProvider.provider, undefined);
    runner.assertEqual(minimalProvider.model, undefined);
    runner.assertEqual(minimalProvider.apiKey, undefined);
  });

  runner.test('ProviderInstance can have all base fields populated', () => {
    const fullProvider: ProviderInstance = {
      id: 'full',
      name: 'Full Provider',
      providerType: 'openai',
      authType: 'api-key',
      isConnected: true,
      models: [{ id: 'gpt-4o' }],
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-test',
      customEndpoint: 'https://api.openai.com',
      extraHeaders: { 'X-Custom': 'header' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    runner.assertEqual(fullProvider.provider, 'openai');
    runner.assertEqual(fullProvider.model, 'gpt-4o');
    runner.assertEqual(fullProvider.apiKey, 'sk-test');
    runner.assertEqual(fullProvider.customEndpoint, 'https://api.openai.com');
    runner.assertEqual(fullProvider.extraHeaders?.['X-Custom'], 'header');
  });

  // ===== ProfileConfig vs ProviderInstance Compatibility =====
  runner.test('ProfileConfig and ProviderInstance share base connection shape', () => {
    // ProfileConfig extends ProviderConnectionConfig (all fields required)
    const profile = createProfile({
      provider: 'anthropic',
      model: 'claude-3-opus',
      apiKey: 'sk-ant-test',
      customEndpoint: '',
      extraHeaders: {},
    });

    // ProviderInstance has same fields but as Partial
    const provider: ProviderInstance = {
      id: 'anthropic-provider',
      name: 'Anthropic',
      providerType: 'anthropic',
      authType: 'api-key',
      isConnected: true,
      models: [{ id: 'claude-3-opus' }],
      provider: 'anthropic',
      model: 'claude-3-opus',
      apiKey: 'sk-ant-test',
      customEndpoint: '',
      extraHeaders: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Both should have the same connection field values
    runner.assertEqual(profile.provider, provider.provider);
    runner.assertEqual(profile.model, provider.model);
    runner.assertEqual(profile.apiKey, provider.apiKey);
  });

  runner.test('extractConnectionConfig and extractConnectionFromProvider produce compatible results', () => {
    const profile = createProfile({
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'sk-test',
      customEndpoint: 'https://custom.openai.com',
      extraHeaders: { 'X-Key': 'value' },
    });

    const provider: ProviderInstance = {
      id: 'openai-provider',
      name: 'OpenAI',
      providerType: 'openai',
      authType: 'api-key',
      isConnected: true,
      models: [{ id: 'gpt-4o' }],
      model: 'gpt-4o',
      apiKey: 'sk-test',
      customEndpoint: 'https://custom.openai.com',
      extraHeaders: { 'X-Key': 'value' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const profileConnection = extractConnectionConfig(profile);
    const providerConnection = extractConnectionFromProvider(provider);

    // Both should extract the same connection fields
    runner.assertEqual(profileConnection.provider, providerConnection.provider);
    runner.assertEqual(profileConnection.model, providerConnection.model);
    runner.assertEqual(profileConnection.apiKey, providerConnection.apiKey);
    runner.assertEqual(profileConnection.customEndpoint, providerConnection.customEndpoint);
    runner.assertEqual(profileConnection.extraHeaders?.['X-Key'], providerConnection.extraHeaders?.['X-Key']);
  });

  runner.test('providerType maps to provider field in extraction', () => {
    const provider: ProviderInstance = {
      id: 'test',
      name: 'Test',
      providerType: 'anthropic',
      authType: 'api-key',
      isConnected: true,
      models: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const connection = extractConnectionFromProvider(provider);
    runner.assertEqual(connection.provider, 'anthropic');
    runner.assertEqual(provider.providerType, 'anthropic');
  });
}
