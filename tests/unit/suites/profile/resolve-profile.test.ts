import { DEFAULT_PROFILE, type ProfileConfig, resolveProfile } from '@parchi/shared';
import type { TestRunner } from '../../shared/runner.js';
import { log } from '../../shared/runner.js';

export function runResolveProfileSuite(runner: TestRunner) {
  log('\n=== Testing resolveProfile Function ===', 'info');

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

    runner.assertEqual(profile.provider, 'openai');
    runner.assertEqual(profile.model, 'gpt-4o-mini');
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
    runner.assertEqual(minimal.temperature, DEFAULT_PROFILE.temperature);
    runner.assertEqual(minimal.apiKey, DEFAULT_PROFILE.apiKey);

    const apiKeyOnly = resolveProfile(partialConfigs, 'api-key-only');
    runner.assertEqual(apiKeyOnly.apiKey, 'placeholder-or-key');
    runner.assertEqual(apiKeyOnly.provider, DEFAULT_PROFILE.provider);
  });
}
