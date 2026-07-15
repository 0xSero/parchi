import type { RecordingEvent } from '@parchi/shared';
import {
  buildRecordingUrlTimeline,
  deduplicateRecordingEvents,
  generateRecordingSummary,
} from '../../../packages/extension/recording/recording-summary.js';
import { type TestRunner, log } from '../shared/runner.js';

export async function runRecordingSummarySuite(runner: TestRunner) {
  log('\n=== Testing Recording Summary ===', 'info');

  await runner.test('deduplicateRecordingEvents merges scrolls clicks inputs and DOM mutations', () => {
    const events: RecordingEvent[] = [
      { type: 'scroll', timestamp: 0, url: 'https://example.com', scrollY: 100, direction: 'down' },
      { type: 'scroll', timestamp: 1000, url: 'https://example.com', scrollY: 400, direction: 'down' },
      { type: 'click', timestamp: 1500, url: 'https://example.com', selector: '#save' },
      { type: 'click', timestamp: 1700, url: 'https://example.com', selector: '#save' },
      { type: 'input', timestamp: 2000, url: 'https://example.com', selector: '#name', placeholder: 'Name' },
      { type: 'input', timestamp: 2200, url: 'https://example.com', selector: '#name', placeholder: 'Name' },
      {
        type: 'dom_mutation',
        timestamp: 3000,
        url: 'https://example.com',
        addedCount: 1,
        removedCount: 0,
        attributeChanges: 1,
      },
      {
        type: 'dom_mutation',
        timestamp: 3400,
        url: 'https://example.com',
        addedCount: 2,
        removedCount: 1,
        attributeChanges: 0,
      },
    ];

    const deduped = deduplicateRecordingEvents(events);

    runner.assertEqual(deduped.length, 4);
    runner.assertEqual(deduped[0]?.scrollY, 400);
    runner.assertEqual(deduped[3]?.summary, '+3 nodes, -1 nodes, 1 attr changes');
  });

  await runner.test('deduplicateRecordingEvents caps to max events using event priority', () => {
    const events: RecordingEvent[] = [
      { type: 'navigation', timestamp: 0, url: 'https://example.com', toUrl: 'https://example.com/a' },
      ...Array.from({ length: 105 }, (_, index) => ({
        type: 'scroll' as const,
        timestamp: 3000 + index * 3000,
        url: 'https://example.com',
        scrollY: index,
        direction: 'down' as const,
      })),
    ];

    const deduped = deduplicateRecordingEvents(events);
    runner.assertEqual(deduped.length, 100);
    runner.assertTrue(
      deduped.some((event) => event.type === 'navigation'),
      'High-priority navigation event should survive',
    );
  });

  await runner.test('buildRecordingUrlTimeline tracks navigation targets and initial URL', () => {
    const timeline = buildRecordingUrlTimeline([
      { type: 'click', timestamp: 1, url: 'https://example.com/start' },
      { type: 'navigation', timestamp: 2, url: 'https://example.com/start', toUrl: 'https://example.com/next' },
      { type: 'navigation', timestamp: 3, url: 'https://example.com/next', toUrl: 'https://example.com/final' },
      { type: 'navigation', timestamp: 4, url: 'https://example.com/final', toUrl: 'https://example.com/final' },
    ]);

    runner.assertEqual(timeline, [
      { url: 'https://example.com/start', timestamp: 1 },
      { url: 'https://example.com/next', timestamp: 2 },
      { url: 'https://example.com/final', timestamp: 3 },
    ]);
  });

  await runner.test('generateRecordingSummary produces readable event summary', () => {
    const events: RecordingEvent[] = [
      { type: 'click', timestamp: 1, url: 'https://example.com', selector: '#buy', textContent: 'Buy now' },
      { type: 'input', timestamp: 2, url: 'https://example.com', placeholder: 'Email' },
      { type: 'navigation', timestamp: 3, url: 'https://example.com', toUrl: 'https://example.com/checkout' },
      { type: 'scroll', timestamp: 4, url: 'https://example.com/checkout', direction: 'down', scrollY: 200 },
      { type: 'dom_mutation', timestamp: 5, url: 'https://example.com/checkout', addedCount: 3, removedCount: 1 },
    ];
    const timeline = [
      { url: 'https://example.com', timestamp: 1 },
      { url: 'https://example.com/checkout', timestamp: 3 },
    ];
    const summary = generateRecordingSummary(events, timeline, 2);

    runner.assertTrue(summary.startsWith('[Recorded context: 2 screenshots, 5 events]'));
    runner.assertTrue(summary.includes('Pages visited: https://example.com -> https://example.com/checkout'));
    runner.assertTrue(summary.includes('Clicked: "Buy now"'));
    runner.assertTrue(summary.includes('Typed in: Email'));
    runner.assertTrue(summary.includes('DOM changes: +3 / -1 nodes'));
  });

  await runner.test('generateRecordingSummary handles overflow counts and selector fallbacks', () => {
    const events: RecordingEvent[] = [
      ...Array.from({ length: 6 }, (_, index) => ({
        type: 'click' as const,
        timestamp: index,
        url: 'https://example.com',
        selector: `#button-${index}`,
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        type: 'input' as const,
        timestamp: 100 + index,
        url: 'https://example.com',
        selector: `#field-${index}`,
      })),
    ];

    const summary = generateRecordingSummary(events, [], 0);
    runner.assertTrue(summary.includes('Clicked: #button-0, #button-1, #button-2, #button-3, #button-4 (+1 more)'));
    runner.assertTrue(summary.includes('Typed in: #field-0, #field-1, #field-2 (+1 more)'));
  });
}
