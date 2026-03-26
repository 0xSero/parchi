import type { RecordingEvent } from '@parchi/shared';
import {
  buildPlanFromArgs,
  extractXmlToolCalls,
  extractXmlToolCalls as extractXmlToolCallsFromTools,
  parsePlanSteps,
  stripXmlToolCalls,
} from '../../../packages/extension/background/tools/xml-tool-parser.js';
import {
  buildRecordingUrlTimeline,
  deduplicateRecordingEvents,
  generateRecordingSummary,
} from '../../../packages/extension/recording/recording-summary.js';
import { type AsyncTestRunner, log } from '../shared/runner.js';

export async function runXmlAndRecordingIntegrationSuite(runner: AsyncTestRunner) {
  log('\n=== Integration: XML Parsing and Recording Summary ===', 'info');

  await runner.test(
    'XML parser extracts structured tool calls consistently across both parser entrypoints',
    async () => {
      const xml = [
        '<tool_call><tool_name>navigate</tool_name><argkey>url</argkey><argvalue>https://example.com</argvalue></tool_call>',
        '<tool_call><function>set_plan</function><arg name="steps">["Open dashboard","Read totals"]</arg></tool_call>',
      ].join('\n');

      const backgroundCalls = extractXmlToolCalls(xml);
      const toolCalls = extractXmlToolCallsFromTools(xml);

      runner.assertEqual(toolCalls, backgroundCalls);
      runner.assertEqual(backgroundCalls[0]?.args, { url: 'https://example.com' });
      runner.assertEqual(buildPlanFromArgs(backgroundCalls[1]?.args as Record<string, unknown>)?.steps.length, 2);
    },
  );

  await runner.test('XML parser can clean tool markup and normalize markdown-style plan text', async () => {
    const cleaned = stripXmlToolCalls(
      'Plan follows <tool_call><name>click</name><argkey>selector</argkey><argvalue>#go</argvalue></tool_call> done',
    );
    const steps = parsePlanSteps('- Open dashboard\n2. Read totals\n  3) Report result');

    runner.assertEqual(cleaned, 'Plan follows  done');
    runner.assertEqual(steps, ['Open dashboard', 'Read totals', 'Report result']);
  });

  await runner.test('recording summary merges noisy event streams into compact artifacts', async () => {
    const events: RecordingEvent[] = [
      { type: 'click', timestamp: 0, url: 'https://example.com', selector: '#save', textContent: 'Save' },
      { type: 'click', timestamp: 100, url: 'https://example.com', selector: '#save', textContent: 'Save' },
      { type: 'scroll', timestamp: 200, url: 'https://example.com', scrollY: 100, direction: 'down' },
      { type: 'scroll', timestamp: 1200, url: 'https://example.com', scrollY: 350, direction: 'down' },
      { type: 'navigation', timestamp: 2400, url: 'https://example.com', toUrl: 'https://example.com/checkout' },
      { type: 'dom_mutation', timestamp: 3000, url: 'https://example.com/checkout', addedCount: 1, removedCount: 1 },
      { type: 'dom_mutation', timestamp: 3200, url: 'https://example.com/checkout', addedCount: 2, removedCount: 0 },
    ];

    const deduped = deduplicateRecordingEvents(events);
    const timeline = buildRecordingUrlTimeline(deduped);
    const summary = generateRecordingSummary(deduped, timeline, 3);

    runner.assertEqual(deduped.length, 4);
    runner.assertEqual(timeline, [
      { url: 'https://example.com', timestamp: 0 },
      { url: 'https://example.com/checkout', timestamp: 2400 },
    ]);
    runner.assertIncludes(summary, 'Clicked: "Save"');
    runner.assertIncludes(summary, 'Navigated 1 time(s)');
    runner.assertIncludes(summary, 'DOM changes: +3 / -1 nodes');
  });

  await runner.test('recording summary keeps high-priority events when max event cap is exceeded', async () => {
    const events: RecordingEvent[] = [
      { type: 'navigation', timestamp: 1, url: 'https://example.com', toUrl: 'https://example.com/a' },
      ...Array.from({ length: 105 }, (_, index) => ({
        type: 'scroll' as const,
        timestamp: 3000 + index * 3000,
        url: 'https://example.com/a',
        scrollY: index,
        direction: 'down' as const,
      })),
    ];

    const deduped = deduplicateRecordingEvents(events);
    runner.assertEqual(deduped.length, 100);
    runner.assertTrue(deduped.some((event) => event.type === 'navigation'));
  });
}
