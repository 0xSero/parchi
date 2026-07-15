import {
  CONTEXT_HISTORY_SOFT_CAP,
  clampContextHistory,
  clearReportImages,
  clearToolCallViews,
} from '../../../packages/extension/sidepanel/ui/core/panel-session-memory.js';
import { type TestRunner, log } from '../shared/runner.js';

export async function runPanelSessionMemorySuite(runner: TestRunner) {
  log('\n=== Testing Panel Session Memory Helpers ===', 'info');

  await runner.test('clampContextHistory trims oldest entries to the soft cap', () => {
    const history = Array.from({ length: CONTEXT_HISTORY_SOFT_CAP + 5 }, (_, index) => ({
      role: 'user',
      content: `message-${index}`,
    }));

    const result = clampContextHistory(history as any);

    runner.assertEqual(result.length, CONTEXT_HISTORY_SOFT_CAP);
    runner.assertEqual(result[0]?.content, 'message-5');
    runner.assertEqual(result[result.length - 1]?.content, `message-${CONTEXT_HISTORY_SOFT_CAP + 4}`);
  });

  await runner.test('clearToolCallViews aborts live entries and nulls DOM refs', () => {
    let aborted = 0;
    const views = new Map<string, any>([
      [
        'tool-1',
        {
          abortController: { abort: () => (aborted += 1) },
          element: { id: 'element-1' },
          statusEl: { id: 'status-1' },
          durationEl: { id: 'duration-1' },
        },
      ],
    ]);

    clearToolCallViews(views);

    runner.assertEqual(aborted, 1);
    runner.assertEqual(views.size, 0);
  });

  await runner.test('clearReportImages revokes blob URLs and clears selection/order state', () => {
    const revoked: string[] = [];
    const originalRevoke = (globalThis.URL as any).revokeObjectURL;
    (globalThis.URL as any).revokeObjectURL = (url: string) => {
      revoked.push(url);
    };

    try {
      const reportImages = new Map<string, any>([
        [
          'img-1',
          {
            id: 'img-1',
            dataUrl: 'data:image/png;base64,AAAA',
            capturedAt: 1,
            selected: true,
            _blobUrl: 'blob:one',
          },
        ],
        [
          'img-2',
          {
            id: 'img-2',
            dataUrl: 'data:image/png;base64,BBBB',
            capturedAt: 2,
            selected: false,
          },
        ],
      ]);
      const order = ['img-1', 'img-2'];
      const selected = new Set(['img-1']);

      clearReportImages(reportImages, order, selected);

      runner.assertEqual(revoked, ['blob:one']);
      runner.assertEqual(reportImages.size, 0);
      runner.assertEqual(order.length, 0);
      runner.assertEqual(selected.size, 0);
    } finally {
      (globalThis.URL as any).revokeObjectURL = originalRevoke;
    }
  });
}
