import { DEFAULT_PROFILE, createProfile } from '@parchi/shared';
import type { TestRunner } from '../../shared/runner.js';
import { log } from '../../shared/runner.js';

export function runVisionSettingsSuite(runner: TestRunner) {
  log('\n=== Testing Profile Vision Settings ===', 'info');

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

  runner.test('Profile vision defaults are applied correctly', () => {
    const profile = createProfile({});

    runner.assertEqual(profile.enableScreenshots, DEFAULT_PROFILE.enableScreenshots);
    runner.assertEqual(profile.sendScreenshotsAsImages, DEFAULT_PROFILE.sendScreenshotsAsImages);
    runner.assertEqual(profile.screenshotQuality, DEFAULT_PROFILE.screenshotQuality);
  });

  runner.test('Profile vision settings can be disabled explicitly', () => {
    const profile = createProfile({
      enableScreenshots: false,
      sendScreenshotsAsImages: false,
    });

    runner.assertEqual(profile.enableScreenshots, false);
    runner.assertEqual(profile.sendScreenshotsAsImages, false);
  });
}
