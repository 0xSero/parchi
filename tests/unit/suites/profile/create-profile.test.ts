import { DEFAULT_PROFILE, type ProfileConfig, createProfile } from '@parchi/shared';
import type { TestRunner } from '../../shared/runner.js';
import { log } from '../../shared/runner.js';

export function runCreateProfileSuite(runner: TestRunner) {
  log('\n=== Testing createProfile Function ===', 'info');

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

    runner.assertEqual(profile.provider, 'openai');
    runner.assertEqual(profile.model, 'gpt-4o');
    runner.assertEqual(profile.apiKey, 'placeholder-api-key');
    runner.assertEqual(profile.temperature, 0.5);
    runner.assertEqual(profile.maxTokens, 8192);
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

    runner.assertEqual(profile.provider, undefined);
    runner.assertEqual(profile.model, 'gpt-4o');
  });

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
