import { type ProviderInstance, extractConnectionFromProvider } from '@parchi/shared';
import type { TestRunner } from '../../shared/runner.js';
import { log } from '../../shared/runner.js';

export function runExtractFromProviderSuite(runner: TestRunner) {
  log('\n=== Testing extractConnectionFromProvider ===', 'info');

  runner.test('extractConnectionFromProvider extracts config from provider instance', () => {
    const provider: ProviderInstance = {
      id: 'test-provider',
      name: 'Test Provider',
      providerType: 'openai',
      authType: 'api-key',
      isConnected: true,
      models: [{ id: 'gpt-4o' }],
      model: 'gpt-4o',
      apiKey: 'placeholder-api-key',
      customEndpoint: 'https://custom.openai.com',
      extraHeaders: { 'X-Auth': 'token' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const connection = extractConnectionFromProvider(provider);

    runner.assertEqual(connection.provider, 'openai');
    runner.assertEqual(connection.model, 'gpt-4o');
    runner.assertEqual(connection.apiKey, 'placeholder-api-key');
    runner.assertEqual(connection.customEndpoint, 'https://custom.openai.com');
    runner.assertEqual(connection.extraHeaders?.['X-Auth'], 'token');
  });

  runner.test('extractConnectionFromProvider maps providerType to provider field', () => {
    const provider: ProviderInstance = {
      id: 'anthropic-provider',
      name: 'Anthropic',
      providerType: 'anthropic',
      authType: 'api-key',
      isConnected: true,
      models: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const connection = extractConnectionFromProvider(provider);
    runner.assertEqual(connection.provider, 'anthropic');
  });

  runner.test('extractConnectionFromProvider uses explicit modelId over provider model', () => {
    const provider: ProviderInstance = {
      id: 'test-provider',
      name: 'Test',
      providerType: 'openai',
      authType: 'api-key',
      isConnected: true,
      models: [{ id: 'gpt-4o' }],
      model: 'gpt-4o',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const connection = extractConnectionFromProvider(provider, 'gpt-3.5-turbo');
    runner.assertEqual(connection.model, 'gpt-3.5-turbo');
  });

  runner.test('extractConnectionFromProvider handles missing optional fields', () => {
    const provider: ProviderInstance = {
      id: 'minimal-provider',
      name: 'Minimal',
      providerType: 'managed',
      authType: 'managed',
      isConnected: false,
      models: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const connection = extractConnectionFromProvider(provider);

    runner.assertEqual(connection.provider, 'managed');
    runner.assertEqual(connection.model, '');
    runner.assertEqual(connection.apiKey, '');
    runner.assertEqual(connection.customEndpoint, '');
    runner.assertEqual(Object.keys(connection.extraHeaders || {}).length, 0);
  });

  runner.test('extractConnectionFromProvider handles OAuth provider', () => {
    const provider: ProviderInstance = {
      id: 'oauth-provider',
      name: 'OAuth Provider',
      providerType: 'copilot-oauth',
      authType: 'oauth',
      oauthProviderKey: 'github',
      oauthEmail: 'user@example.com',
      isConnected: true,
      models: [{ id: 'claude-sonnet-4' }],
      model: 'claude-sonnet-4',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const connection = extractConnectionFromProvider(provider);

    runner.assertEqual(connection.provider, 'copilot-oauth');
    runner.assertEqual(connection.model, 'claude-sonnet-4');
  });

  runner.test('extractConnectionFromProvider handles full provider with all fields', () => {
    const provider: ProviderInstance = {
      id: 'full-provider',
      name: 'Full Provider',
      providerType: 'openai',
      authType: 'oauth',
      oauthProviderKey: 'google',
      oauthEmail: 'test@example.com',
      oauthError: undefined,
      isConnected: true,
      models: [
        { id: 'gpt-4o', label: 'GPT-4o', contextWindow: 128000, supportsVision: true },
        { id: 'gpt-3.5', label: 'GPT-3.5', contextWindow: 16000 },
      ],
      model: 'gpt-4o',
      apiKey: '',
      customEndpoint: 'https://api.openai.com',
      extraHeaders: { 'X-Request-ID': '123' },
      supportsImages: true,
      source: 'manual',
      createdAt: 1234567890,
      updatedAt: 1234567891,
    };

    const connection = extractConnectionFromProvider(provider);

    runner.assertEqual(connection.provider, 'openai');
    runner.assertEqual(connection.model, 'gpt-4o');
    runner.assertEqual(connection.extraHeaders?.['X-Request-ID'], '123');
  });
}
