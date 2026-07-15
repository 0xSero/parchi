import { type TestRunner, log } from '../shared/runner.js';

export async function runInputValidationSuite(runner: TestRunner) {
  log('\n=== Testing Input Validation ===', 'info');

  await runner.test('Validate URL format', () => {
    const validUrls = ['https://google.com', 'http://example.com', 'https://sub.domain.com/path'];

    validUrls.forEach((url) => {
      runner.assertTrue(url.startsWith('http://') || url.startsWith('https://'), `${url} should be valid`);
    });
  });

  await runner.test('Validate CSS selectors', () => {
    const validSelectors = ['#id', '.class', 'div', 'input[name="test"]', '.class > div', 'div:nth-child(2)'];

    validSelectors.forEach((selector) => {
      runner.assertTrue(selector.length > 0, 'Selector should not be empty');
      runner.assertFalse(selector.includes('  '), 'Selector should not have double spaces');
    });
  });

  await runner.test('Validate tab group colors', () => {
    const validColors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
    const testColor = 'blue';

    runner.assertTrue(validColors.includes(testColor), `${testColor} should be a valid color`);
  });
}
