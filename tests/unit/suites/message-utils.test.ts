import {
  dedupeThinking,
  estimateTokensFromContent,
  extractTextFromResponseMessages,
  extractThinkingFromResponseMessages,
} from '../../../packages/extension/ai/messages/utils.js';
import { type TestRunner, log } from '../shared/runner.js';

export function runMessageUtilsSuite(runner: TestRunner) {
  log('\n=== Testing Message Utilities ===', 'info');

  runner.test('extractTextFromResponseMessages keeps readable text and skips tool/thinking payloads', () => {
    const text = extractTextFromResponseMessages([
      { content: 'Hello ' },
      {
        content: [
          { type: 'text', text: 'world' },
          { type: 'reasoning', text: 'internal' },
          { type: 'tool-call', text: 'ignore' },
          { content: '!' },
        ],
      },
      { content: { type: 'analysis', text: 'skip me' } },
      { content: { type: 'message', content: ' Done.' } },
    ]);

    runner.assertEqual(text, 'Hello world! Done.');
    runner.assertEqual(extractTextFromResponseMessages(null), '');
  });

  runner.test('extractThinkingFromResponseMessages combines tagged and structured thinking content', () => {
    const thinking = extractThinkingFromResponseMessages([
      { content: '<analysis>First pass</analysis>' },
      { content: { type: 'thinking', text: 'Second pass' } },
      { content: [{ text: '<think>Third pass</think>' }, { content: '<thinking>Fourth pass</thinking>' }] },
    ]);

    runner.assertEqual(thinking, 'First pass\n\nSecond pass\n\nThird pass\n\nFourth pass');
    runner.assertEqual(extractThinkingFromResponseMessages('bad-input'), null);
  });

  runner.test('dedupeThinking removes duplicate paragraphs and runaway repeated lines', () => {
    const thinking = dedupeThinking(
      ['First paragraph.', '', 'First paragraph.', '', 'Repeat me', 'Repeat me', 'Repeat me', 'Unique line'].join('\n'),
    );

    runner.assertEqual(thinking, 'First paragraph.\n\nRepeat me\nUnique line');
    runner.assertEqual(dedupeThinking(null), '');
  });

  runner.test('estimateTokensFromContent handles strings arrays objects and circular values', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    runner.assertEqual(estimateTokensFromContent('12345678'), 2);
    runner.assertEqual(
      estimateTokensFromContent(['abcd', { text: 'efgh' }, { other: 'ijkl' }, circular] as any),
      6,
      'Circular array parts should be ignored after JSON failure',
    );
    runner.assertTrue(estimateTokensFromContent(circular as any) >= 3, 'Circular objects should fall back to String()');
  });
}
