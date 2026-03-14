import {
  DEFAULT_COMPACTION_SETTINGS,
  applyCompaction,
  buildCompactionSummaryMessage,
  estimateContextTokens,
  shouldCompact,
} from '../../../packages/extension/ai/compaction/index.js';
import type { Message } from '../../../packages/extension/ai/messages/schema.js';
import { type TestRunner, log } from '../shared/runner.js';

export function runConversationCompactionSuite(runner: TestRunner) {
  log('\n=== Testing Conversation Compaction ===', 'info');

  runner.test('compaction utilities preserve summaries + recent messages', () => {
    const history: Message[] = Array.from({ length: 20 }, (_, idx) => ({
      role: 'user',
      content: `Message ${idx} ${'x'.repeat(200)}`,
    }));
    const usage = estimateContextTokens(history);
    const check = shouldCompact({
      contextTokens: usage.tokens,
      contextLimit: 500,
      settings: DEFAULT_COMPACTION_SETTINGS,
    });
    runner.assertTrue(check.shouldCompact, 'Should trigger compaction');

    const preserved = history.slice(-5);
    const summaryMessage = buildCompactionSummaryMessage(
      'Summary of earlier context.',
      history.length - preserved.length,
    );
    const result = applyCompaction({
      summaryMessage,
      preserved,
      trimmedCount: history.length - preserved.length,
    });
    runner.assertTrue(
      result.compacted.length === preserved.length + 1,
      'Compacted history should include summary + preserved messages',
    );
    runner.assertEqual(result.compacted[0].meta?.kind, 'summary');
  });
}
