import { extractModelEntries } from '../../../packages/extension/ai/providers/model-listing.js';
import { type TestRunner, log } from '../shared/runner.js';

export async function runModelListingSuite(runner: TestRunner) {
  log('\n=== Testing Model Listing ===', 'info');

  await runner.test('extractModelEntries normalizes string and object payloads', () => {
    const entries = extractModelEntries({
      data: [
        'gpt-4.1',
        { id: 'claude-sonnet-4.5', display_name: 'Sonnet 4.5', context_length: 200000 },
        { slug: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', contextWindow: 1048576 },
        { id: '   ' },
      ],
    });

    runner.assertEqual(entries, [
      { id: 'gpt-4.1' },
      { id: 'claude-sonnet-4.5', label: 'Sonnet 4.5', contextWindow: 200000 },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', contextWindow: 1048576 },
    ]);
  });

  await runner.test('extractModelEntries falls back to models array or raw array', () => {
    runner.assertEqual(extractModelEntries({ models: ['kimi-k2'] }), [{ id: 'kimi-k2' }]);
    runner.assertEqual(extractModelEntries(['qwen-max']), [{ id: 'qwen-max' }]);
    runner.assertEqual(extractModelEntries(null), []);
  });
}
