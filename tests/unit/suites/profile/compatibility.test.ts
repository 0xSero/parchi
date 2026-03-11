import {
  CONNECTION_CONFIG_FIELDS,
  DEFAULT_CONNECTION_CONFIG,
  DEFAULT_PROFILE,
  type ProfileConfig,
  type ProviderInstance,
  createProfile,
  extractConnectionConfig,
  extractConnectionFromProvider,
} from '@parchi/shared';
import type { TestRunner } from '../../shared/runner.js';
import { log } from '../../shared/runner.js';

export function runProfileCompatibilitySuite(runner: TestRunner) {
  log('\n=== Testing Profile Compatibility ===', 'info');

  // ===== Storage Format Compatibility Tests =====
  runner.test('ProfileConfig maintains backward compatibility with flat storage format', () => {
    // Simulating how profiles are stored in chrome.storage (flat structure)
    const storedProfile: Record<string, unknown> = {
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'placeholder-api-key',
      customEndpoint: '',
      extraHeaders: {},
      systemPrompt: 'You are helpful',
      temperature: 0.7,
      maxTokens: 4096,
      contextLimit: 200000,
      timeout: 30000,
      enableScreenshots: true,
      sendScreenshotsAsImages: false,
      screenshotQuality: 'high',
      showThinking: true,
      streamResponses: true,
      autoScroll: true,
      confirmActions: true,
      saveHistory: true,
    };

    // Can be loaded and used with createProfile/resolveProfile
    const profile = createProfile(storedProfile as Partial<ProfileConfig>);

    runner.assertEqual(profile.provider, 'openai');
    runner.assertEqual(profile.model, 'gpt-4o');
    runner.assertEqual(profile.systemPrompt, 'You are helpful');
  });

  runner.test('ProviderInstance storage format supports migration from old profiles', () => {
    // Old profile format (pre-migration) - similar to ProfileConfig
    const oldProfileFormat = {
      provider: 'anthropic',
      model: 'claude-3-opus',
      apiKey: 'placeholder-ant-key',
      customEndpoint: '',
      extraHeaders: {},
    };

    // Can be converted to ProviderInstance connection fields
    const providerInstance: ProviderInstance = {
      id: 'migrated-provider',
      name: 'Migrated Provider',
      providerType: oldProfileFormat.provider,
      authType: 'api-key',
      isConnected: true,
      models: [{ id: oldProfileFormat.model }],
      model: oldProfileFormat.model,
      apiKey: oldProfileFormat.apiKey,
      customEndpoint: oldProfileFormat.customEndpoint,
      extraHeaders: oldProfileFormat.extraHeaders,
      source: 'migration',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Can extract connection config from migrated provider
    const connection = extractConnectionFromProvider(providerInstance);

    runner.assertEqual(connection.provider, 'anthropic');
    runner.assertEqual(connection.model, 'claude-3-opus');
    runner.assertEqual(connection.apiKey, 'placeholder-ant-key');
  });

  // ===== Provider/Profile Compatibility Tests =====
  runner.test('CONNECTION_CONFIG_FIELDS lists all connection fields', () => {
    runner.assertEqual(CONNECTION_CONFIG_FIELDS.length, 5);
    runner.assertTrue(CONNECTION_CONFIG_FIELDS.includes('provider'));
    runner.assertTrue(CONNECTION_CONFIG_FIELDS.includes('model'));
    runner.assertTrue(CONNECTION_CONFIG_FIELDS.includes('apiKey'));
    runner.assertTrue(CONNECTION_CONFIG_FIELDS.includes('customEndpoint'));
    runner.assertTrue(CONNECTION_CONFIG_FIELDS.includes('extraHeaders'));
  });

  runner.test('ProfileConfig and ProviderInstance share base connection fields', () => {
    // Create a profile and extract connection
    const profile = createProfile({
      provider: 'anthropic',
      model: 'claude-3-sonnet',
      apiKey: 'placeholder-api-key',
    });
    const profileConnection = extractConnectionConfig(profile);

    // Create a provider instance and extract connection
    const provider: ProviderInstance = {
      id: 'test',
      name: 'Test',
      providerType: 'anthropic',
      authType: 'api-key',
      isConnected: true,
      models: [],
      model: 'claude-3-sonnet',
      apiKey: 'placeholder-api-key',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const providerConnection = extractConnectionFromProvider(provider);

    // Both should produce equivalent connection configs
    runner.assertEqual(profileConnection.provider, providerConnection.provider);
    runner.assertEqual(profileConnection.model, providerConnection.model);
    runner.assertEqual(profileConnection.apiKey, providerConnection.apiKey);
  });

  runner.test('DEFAULT_CONNECTION_CONFIG is subset of DEFAULT_PROFILE', () => {
    for (const field of CONNECTION_CONFIG_FIELDS) {
      runner.assertEqual(
        (DEFAULT_PROFILE as unknown as Record<string, unknown>)[field],
        (DEFAULT_CONNECTION_CONFIG as unknown as Record<string, unknown>)[field],
      );
    }
  });

  runner.test('createProfile merges connection config correctly', () => {
    const profile = createProfile({
      provider: 'custom',
      model: 'custom-model',
      apiKey: 'custom-key',
      customEndpoint: 'https://custom.api',
      extraHeaders: { 'X-Key': 'value' },
    });

    // All connection fields should be set
    runner.assertEqual(profile.provider, 'custom');
    runner.assertEqual(profile.model, 'custom-model');
    runner.assertEqual(profile.apiKey, 'custom-key');
    runner.assertEqual(profile.customEndpoint, 'https://custom.api');
    runner.assertEqual(profile.extraHeaders['X-Key'], 'value');

    // Non-connection fields should have defaults
    runner.assertEqual(profile.temperature, DEFAULT_PROFILE.temperature);
    runner.assertEqual(profile.systemPrompt, DEFAULT_PROFILE.systemPrompt);
  });

  runner.test('Profile with vision settings excludes vision from connection extraction', () => {
    const profile = createProfile({
      provider: 'openai',
      model: 'gpt-4o-vision',
      enableScreenshots: true,
      sendScreenshotsAsImages: true,
      screenshotQuality: 'low',
    });

    runner.assertTrue(profile.enableScreenshots);
    runner.assertTrue(profile.sendScreenshotsAsImages);
    runner.assertEqual(profile.screenshotQuality, 'low');

    // Connection extraction should not include vision settings
    const connection = extractConnectionConfig(profile);
    runner.assertTrue(!('enableScreenshots' in connection));
    runner.assertTrue(!('screenshotQuality' in connection));
  });
}
