import {
  DEFAULT_PROFILE,
  type ProfileConfig,
  createProfile,
  resolveProfile,
} from '../../../../packages/shared/src/profile.js';
import type { TestRunner } from '../../shared/runner.js';
import { log } from '../../shared/runner.js';

export function runProfileCoreSuite(runner: TestRunner) {
  log('\n=== Testing Profile Core Functions ===', 'info');

  // ===== createProfile Tests =====
  runner.test('createProfile returns default profile with no overrides', () => {
    const profile = createProfile();

    runner.assertEqual(profile.provider, DEFAULT_PROFILE.provider);
    runner.assertEqual(profile.model, DEFAULT_PROFILE.model);
    runner.assertEqual(profile.apiKey, DEFAULT_PROFILE.apiKey);
    runner.assertEqual(profile.systemPrompt, DEFAULT_PROFILE.systemPrompt);
    runner.assertEqual(profile.temperature, DEFAULT_PROFILE.temperature);
    runner.assertEqual(profile.maxTokens, DEFAULT_PROFILE.maxTokens);
    runner.assertEqual(profile.contextLimit, DEFAULT_PROFILE.contextLimit);
    runner.assertEqual(profile.timeout, DEFAULT_PROFILE.timeout);
    runner.assertEqual(profile.enableScreenshots, DEFAULT_PROFILE.enableScreenshots);
    runner.assertEqual(profile.sendScreenshotsAsImages, DEFAULT_PROFILE.sendScreenshotsAsImages);
    runner.assertEqual(profile.screenshotQuality, DEFAULT_PROFILE.screenshotQuality);
    runner.assertEqual(profile.showThinking, DEFAULT_PROFILE.showThinking);
    runner.assertEqual(profile.streamResponses, DEFAULT_PROFILE.streamResponses);
    runner.assertEqual(profile.autoScroll, DEFAULT_PROFILE.autoScroll);
    runner.assertEqual(profile.confirmActions, DEFAULT_PROFILE.confirmActions);
    runner.assertEqual(profile.saveHistory, DEFAULT_PROFILE.saveHistory);
  });

  runner.test('createProfile applies overrides on top of defaults', () => {
    const overrides: Partial<ProfileConfig> = {
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'placeholder-api-key',
      temperature: 0.5,
      maxTokens: 8192,
    };

    const profile = createProfile(overrides);

    // Check overrides applied
    runner.assertEqual(profile.provider, 'openai');
    runner.assertEqual(profile.model, 'gpt-4o');
    runner.assertEqual(profile.apiKey, 'placeholder-api-key');
    runner.assertEqual(profile.temperature, 0.5);
    runner.assertEqual(profile.maxTokens, 8192);

    // Check defaults preserved for unspecified fields
    runner.assertEqual(profile.systemPrompt, DEFAULT_PROFILE.systemPrompt);
    runner.assertEqual(profile.contextLimit, DEFAULT_PROFILE.contextLimit);
    runner.assertEqual(profile.enableScreenshots, DEFAULT_PROFILE.enableScreenshots);
  });

  runner.test('createProfile creates independent copies', () => {
    const profile1 = createProfile({ provider: 'openai' });
    const profile2 = createProfile({ provider: 'anthropic' });

    runner.assertEqual(profile1.provider, 'openai');
    runner.assertEqual(profile2.provider, 'anthropic');
    runner.assertTrue(profile1.provider !== profile2.provider);
  });

  runner.test('createProfile handles empty overrides object', () => {
    const profile = createProfile({});
    runner.assertEqual(profile.provider, DEFAULT_PROFILE.provider);
    runner.assertEqual(profile.model, DEFAULT_PROFILE.model);
  });

  runner.test('createProfile spread operator uses undefined values', () => {
    const profile = createProfile({
      provider: undefined,
      model: 'gpt-4o',
    });

    // JavaScript spread operator DOES use undefined values (overwrites defaults)
    runner.assertEqual(profile.provider, undefined);
    runner.assertEqual(profile.model, 'gpt-4o');
  });

  // ===== resolveProfile Tests =====
  runner.test('resolveProfile returns default when name not in configs', () => {
    const configs: Record<string, Partial<ProfileConfig>> = {};
    const profile = resolveProfile(configs, 'nonexistent');

    runner.assertEqual(profile.provider, DEFAULT_PROFILE.provider);
    runner.assertEqual(profile.model, DEFAULT_PROFILE.model);
    runner.assertEqual(profile.temperature, DEFAULT_PROFILE.temperature);
  });

  runner.test('resolveProfile returns named profile from configs', () => {
    const configs: Record<string, Partial<ProfileConfig>> = {
      custom: {
        provider: 'anthropic',
        model: 'claude-3-sonnet',
        temperature: 0.3,
      },
    };

    const profile = resolveProfile(configs, 'custom');

    runner.assertEqual(profile.provider, 'anthropic');
    runner.assertEqual(profile.model, 'claude-3-sonnet');
    runner.assertEqual(profile.temperature, 0.3);
    // Defaults preserved for unspecified fields
    runner.assertEqual(profile.maxTokens, DEFAULT_PROFILE.maxTokens);
  });

  runner.test('resolveProfile merges fallback before named profile', () => {
    const configs: Record<string, Partial<ProfileConfig>> = {
      specific: {
        provider: 'openai',
        model: 'gpt-4o-mini',
      },
    };
    const fallback: Partial<ProfileConfig> = {
      temperature: 0.8,
      maxTokens: 2048,
      apiKey: 'fallback-key',
    };

    const profile = resolveProfile(configs, 'specific', fallback);

    // From named profile
    runner.assertEqual(profile.provider, 'openai');
    runner.assertEqual(profile.model, 'gpt-4o-mini');
    // From fallback
    runner.assertEqual(profile.temperature, 0.8);
    runner.assertEqual(profile.maxTokens, 2048);
    runner.assertEqual(profile.apiKey, 'fallback-key');
  });

  runner.test('resolveProfile named profile overrides fallback values', () => {
    const configs: Record<string, Partial<ProfileConfig>> = {
      specific: {
        temperature: 0.2,
      },
    };
    const fallback: Partial<ProfileConfig> = {
      temperature: 0.8,
    };

    const profile = resolveProfile(configs, 'specific', fallback);

    // Named profile value wins over fallback
    runner.assertEqual(profile.temperature, 0.2);
  });

  runner.test('resolveProfile uses only fallback when name not found', () => {
    const configs: Record<string, Partial<ProfileConfig>> = {};
    const fallback: Partial<ProfileConfig> = {
      provider: 'openrouter',
      apiKey: 'fallback-api-key',
    };

    const profile = resolveProfile(configs, 'missing', fallback);

    runner.assertEqual(profile.provider, 'openrouter');
    runner.assertEqual(profile.apiKey, 'fallback-api-key');
    runner.assertEqual(profile.temperature, DEFAULT_PROFILE.temperature);
  });

  runner.test('resolveProfile handles empty configs', () => {
    const profile = resolveProfile({}, 'default');
    runner.assertEqual(profile.temperature, DEFAULT_PROFILE.temperature);
  });

  runner.test('resolveProfile with null configs throws error', () => {
    // @ts-expect-error Testing runtime behavior with null
    runner.assertThrows(() => resolveProfile(null, 'default'));
  });

  runner.test('resolveProfile handles profiles stored with partial fields', () => {
    // Simulating real-world storage where only modified fields are saved
    const partialConfigs: Record<string, Partial<ProfileConfig>> = {
      'minimal-profile': {
        provider: 'openrouter',
        model: 'anthropic/claude-3.5-sonnet',
      },
      'api-key-only': {
        apiKey: 'placeholder-or-key',
      },
    };

    const minimal = resolveProfile(partialConfigs, 'minimal-profile');
    runner.assertEqual(minimal.provider, 'openrouter');
    runner.assertEqual(minimal.model, 'anthropic/claude-3.5-sonnet');
    // Defaults applied for unspecified fields
    runner.assertEqual(minimal.temperature, DEFAULT_PROFILE.temperature);
    runner.assertEqual(minimal.apiKey, DEFAULT_PROFILE.apiKey);

    const apiKeyOnly = resolveProfile(partialConfigs, 'api-key-only');
    runner.assertEqual(apiKeyOnly.apiKey, 'placeholder-or-key');
    runner.assertEqual(apiKeyOnly.provider, DEFAULT_PROFILE.provider);
  });

  // ===== Vision Settings Tests =====
  runner.test('Profile with vision settings stores and retrieves correctly', () => {
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
  });

  // ===== Round-trip Tests =====
  runner.test('Profile round-trip through storage format preserves values', () => {
    const original = createProfile({
      provider: 'anthropic',
      model: 'claude-3-opus',
      apiKey: 'placeholder-api-key',
      temperature: 0.3,
      maxTokens: 8192,
      systemPrompt: 'Be concise',
      enableScreenshots: false,
    });

    // Simulate storage round-trip (JSON serialize/deserialize)
    const stored = JSON.parse(JSON.stringify(original)) as Partial<ProfileConfig>;
    const restored = createProfile(stored);

    runner.assertEqual(restored.provider, original.provider);
    runner.assertEqual(restored.model, original.model);
    runner.assertEqual(restored.apiKey, original.apiKey);
    runner.assertEqual(restored.temperature, original.temperature);
    runner.assertEqual(restored.maxTokens, original.maxTokens);
    runner.assertEqual(restored.systemPrompt, original.systemPrompt);
    runner.assertEqual(restored.enableScreenshots, original.enableScreenshots);
  });
}
