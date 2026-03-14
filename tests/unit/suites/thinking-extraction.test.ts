import { extractThinking } from '../../../packages/extension/ai/messages/utils.js';
import { type TestRunner, log } from '../shared/runner.js';

export function runThinkingExtractionSuite(runner: TestRunner) {
  log('\n=== Testing Thinking Extraction ===', 'info');

  runner.test('extractThinking strips <analysis> tags', () => {
    const result = extractThinking('Hello <analysis>secret</analysis> world');
    runner.assertTrue(result.thinking === 'secret', 'Should capture analysis content');
    runner.assertFalse(result.content.includes('<analysis>'), 'Content should not include analysis tags');
  });

  runner.test('extractThinking merges think + analysis with existing notes', () => {
    const result = extractThinking('Start <think>first</think> middle <analysis>second</analysis>', 'seed');
    runner.assertTrue(result.thinking?.includes('seed'), 'Existing notes should be preserved');
    runner.assertTrue(result.thinking?.includes('first'), 'Think tags should be captured');
    runner.assertTrue(result.thinking?.includes('second'), 'Analysis tags should be captured');
    runner.assertFalse(result.content.includes('think'), 'Content should not include think tags');
    runner.assertFalse(result.content.includes('analysis'), 'Content should not include analysis tags');
  });
}
