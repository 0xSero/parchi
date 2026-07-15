import {
  applyReportImageSelection,
  captureReportImage,
  estimateDataUrlBytes,
  getReportImageSummary,
  trimReportImages,
} from '../../../packages/extension/background/report-images.js';
import type { SessionState } from '../../../packages/extension/background/service-types.js';
import { type TestRunner, log } from '../shared/runner.js';

function createSessionState(): SessionState {
  return {
    sessionId: 'session-1',
    currentPlan: null,
    orchestratorPlan: null,
    subAgentCount: 0,
    subAgentProfileCursor: 0,
    lastBrowserAction: null,
    awaitingVerification: false,
    currentStepVerified: false,
    kimiWarningSent: false,
    failureTracker: new Map(),
    reportImages: [],
    reportImageBytes: 0,
    selectedReportImageIds: new Set(),
    tokenVisibility: {
      providerInputTokens: null,
      providerOutputTokens: null,
      contextApproxTokens: null,
      contextLimit: null,
      contextPercent: null,
      sessionInputTokens: 0,
      sessionOutputTokens: 0,
      sessionTotalTokens: 0,
    },
    runningSubagents: new Map(),
    subagentHistory: new Map(),
    orchestratorWhiteboard: new Map(),
  };
}

export async function runReportImagesSuite(runner: TestRunner) {
  log('\n=== Testing Report Images ===', 'info');

  await runner.test('estimateDataUrlBytes handles padding and empty input', () => {
    runner.assertEqual(estimateDataUrlBytes('data:image/png;base64,AAAA'), 3);
    runner.assertEqual(estimateDataUrlBytes('data:image/png;base64,AAA='), 2);
    runner.assertEqual(estimateDataUrlBytes('AAAA'), 3);
    runner.assertEqual(estimateDataUrlBytes(''), 0);
  });

  await runner.test('captureReportImage stores metadata and selection state can be mutated', () => {
    const sessionState = createSessionState();
    const image = captureReportImage(
      sessionState,
      { dataUrl: 'data:image/png;base64,AAAA', url: 'https://example.com', title: 'Example' },
      { tabId: 7 },
      'tool-1',
    );

    runner.assertTrue(Boolean(image), 'Expected image to be captured');
    runner.assertEqual(sessionState.reportImages.length, 1);
    runner.assertEqual(sessionState.reportImageBytes, 3);

    const imageId = sessionState.reportImages[0]?.id || '';
    let summary = applyReportImageSelection(sessionState, [imageId], 'replace');
    runner.assertTrue(summary[0]?.selected, 'replace should select the image');

    summary = applyReportImageSelection(sessionState, [imageId], 'remove');
    runner.assertFalse(summary[0]?.selected, 'remove should deselect the image');

    summary = applyReportImageSelection(sessionState, [imageId], 'add');
    runner.assertTrue(summary[0]?.selected, 'add should reselect the image');

    summary = applyReportImageSelection(sessionState, [], 'clear');
    runner.assertFalse(summary[0]?.selected, 'clear should deselect all images');
  });

  await runner.test('captureReportImage rejects missing or oversized payloads', () => {
    const sessionState = createSessionState();
    const oversized = `data:image/png;base64,${'A'.repeat(6_000_000)}`;

    runner.assertEqual(captureReportImage(sessionState, { dataUrl: '' }, {}, 'tool-1'), null);
    runner.assertEqual(captureReportImage(sessionState, { dataUrl: oversized }, {}, 'tool-2'), null);
    runner.assertEqual(sessionState.reportImages.length, 0);
  });

  await runner.test('trimReportImages evicts unselected items before selected ones', () => {
    const sessionState = createSessionState();
    sessionState.reportImages = Array.from({ length: 51 }, (_, index) => ({
      id: `img-${index}`,
      dataUrl: 'data:image/png;base64,AAAA',
      byteSize: 3,
      capturedAt: index,
      toolCallId: `tool-${index}`,
    }));
    sessionState.reportImageBytes = 51 * 3;
    sessionState.selectedReportImageIds.add('img-0');

    trimReportImages(sessionState);

    runner.assertEqual(sessionState.reportImages.length, 50);
    runner.assertTrue(
      sessionState.reportImages.some((image) => image.id === 'img-0'),
      'Selected image must remain',
    );
    runner.assertFalse(
      sessionState.reportImages.some((image) => image.id === 'img-1'),
      'First unselected image should be evicted',
    );
    runner.assertEqual(getReportImageSummary(sessionState).length, 50);
  });

  await runner.test(
    'applyReportImageSelection ignores unknown ids and trimReportImages falls back to index zero when all are selected',
    () => {
      const sessionState = createSessionState();
      sessionState.reportImages = Array.from({ length: 51 }, (_, index) => ({
        id: `img-${index}`,
        dataUrl: 'data:image/png;base64,AAAA',
        byteSize: 3,
        capturedAt: index,
      }));
      sessionState.reportImageBytes = 51 * 3;
      sessionState.selectedReportImageIds = new Set(sessionState.reportImages.map((image) => image.id));

      const summary = applyReportImageSelection(sessionState, ['missing-id'], 'replace');
      runner.assertTrue(
        summary.every((image) => !image.selected),
        'Unknown ids should be ignored during replace',
      );

      sessionState.selectedReportImageIds = new Set(sessionState.reportImages.map((image) => image.id));
      trimReportImages(sessionState);
      runner.assertEqual(sessionState.reportImages.length, 50);
      runner.assertFalse(sessionState.reportImages.some((image) => image.id === 'img-0'));
    },
  );
}
