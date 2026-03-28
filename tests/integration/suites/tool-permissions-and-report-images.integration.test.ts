import {
  applyReportImageSelection,
  captureReportImage,
  trimReportImages,
} from '../../../packages/extension/background/report-images.js';
import type { SessionState } from '../../../packages/extension/background/service-types.js';
import {
  checkToolPermission,
  getToolPermissionCategory,
  parseAllowedDomains,
} from '../../../packages/extension/background/tool-permissions.js';
import { type AsyncTestRunner, log } from '../shared/runner.js';

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
    attachments: [],
  };
}

export async function runToolPermissionsAndReportImagesSuite(runner: AsyncTestRunner) {
  log('\n=== Integration: Tool Permissions and Report Images ===', 'info');

  await runner.test('tool permission categories and parsing stay aligned', async () => {
    runner.assertEqual(getToolPermissionCategory('clickAt'), 'interact');
    runner.assertEqual(getToolPermissionCategory('getContent'), 'read');
    runner.assertEqual(getToolPermissionCategory('unknownTool'), null);
    runner.assertEqual(parseAllowedDomains('example.com, docs.example.com\nfoo.com'), [
      'example.com',
      'docs.example.com',
      'foo.com',
    ]);
  });

  await runner.test('tool permissions block disabled categories before domain checks', async () => {
    const result = await checkToolPermission(
      'click',
      {},
      { toolPermissions: { interact: false }, allowedDomains: 'example.com' },
      null,
      undefined,
      null,
      () => ({ getCurrentSessionTabId: () => 7 }) as any,
    );

    runner.assertFalse(result.allowed);
    runner.assertIncludes(result.reason || '', 'Permission blocked: interact');
    runner.assertEqual(result.policy?.type, 'permission');
  });

  await runner.test('tool permissions allow unset policies and reject malformed URLs', async () => {
    const unrestricted = await checkToolPermission(
      'navigate',
      {} as any,
      null,
      null,
      undefined,
      null,
      () => ({ getCurrentSessionTabId: () => 7 }) as any,
    );
    runner.assertTrue(unrestricted.allowed);

    const blocked = await checkToolPermission(
      'navigate',
      { url: 'not a url' } as any,
      { allowedDomains: 'example.com' },
      null,
      undefined,
      null,
      () => ({ getCurrentSessionTabId: () => 7 }) as any,
    );
    runner.assertFalse(blocked.allowed);
  });

  await runner.test('tool permissions respect direct url allowlists and tab fallback resolution', async () => {
    const state = globalThis as typeof globalThis & { chrome?: typeof chrome };
    const originalChrome = state.chrome;
    const originalWarn = console.warn;
    Object.defineProperty(state, 'chrome', {
      configurable: true,
      value: {
        ...originalChrome,
        tabs: {
          ...originalChrome?.tabs,
          get: async () => {
            throw new Error('tab lookup failed');
          },
          query: async () => [{ id: 9, url: 'https://docs.example.com/guide' }],
        },
      },
    });

    try {
      console.warn = () => {};
      const allowed = await checkToolPermission(
        'navigate',
        { url: 'https://sub.example.com/page' } as any,
        { allowedDomains: 'example.com' },
        null,
        undefined,
        null,
        () => ({ getCurrentSessionTabId: () => 7 }) as any,
      );
      runner.assertTrue(allowed.allowed, 'Subdomains should pass the allowlist');

      const viaTabFallback = await checkToolPermission(
        'click',
        { tabId: 9 } as any,
        { allowedDomains: 'example.com' },
        null,
        undefined,
        null,
        () => ({ getCurrentSessionTabId: () => 7 }) as any,
      );
      runner.assertTrue(viaTabFallback.allowed, 'Fallback active-tab URL should be accepted');

      const blocked = await checkToolPermission(
        'click',
        { url: 'https://evil.com' } as any,
        { allowedDomains: 'example.com' },
        null,
        undefined,
        null,
        () => ({ getCurrentSessionTabId: () => 7 }) as any,
      );
      runner.assertFalse(blocked.allowed, 'Mismatched domains should be blocked');
      runner.assertEqual(blocked.policy?.type, 'allowlist');
    } finally {
      console.warn = originalWarn;
      state.chrome = originalChrome;
    }
  });

  await runner.test('tab tools bypass allowlists and report image selection round-trips', async () => {
    const sessionState = createSessionState();
    const tabPermission = await checkToolPermission(
      'switchTab',
      {} as any,
      { allowedDomains: 'example.com' },
      null,
      undefined,
      null,
      () => ({ getCurrentSessionTabId: () => 7 }) as any,
    );

    runner.assertTrue(tabPermission.allowed, 'Tab tools should not be blocked by domain allowlists');

    const image = captureReportImage(
      sessionState,
      { dataUrl: 'data:image/png;base64,AAAA', url: 'https://example.com', title: 'Example' },
      { tabId: 3 },
      'tool-1',
    );
    runner.assertTrue(Boolean(image), 'Expected an image to be captured');

    const imageId = sessionState.reportImages[0]?.id || '';
    let summary = applyReportImageSelection(sessionState, [imageId], 'replace');
    runner.assertTrue(summary[0]?.selected, 'replace should select the image');
    summary = applyReportImageSelection(sessionState, [imageId], 'clear');
    runner.assertFalse(summary[0]?.selected, 'clear should deselect the image');
  });

  await runner.test('trimReportImages keeps selected screenshots when session exceeds limits', async () => {
    const sessionState = createSessionState();
    sessionState.reportImages = Array.from({ length: 51 }, (_, index) => ({
      id: `img-${index}`,
      dataUrl: 'data:image/png;base64,AAAA',
      byteSize: 3,
      capturedAt: index,
      toolCallId: `tool-${index}`,
    }));
    sessionState.reportImageBytes = 51 * 3;
    sessionState.selectedReportImageIds = new Set(['img-0']);

    trimReportImages(sessionState);

    runner.assertEqual(sessionState.reportImages.length, 50);
    runner.assertTrue(sessionState.reportImages.some((image) => image.id === 'img-0'));
    runner.assertFalse(sessionState.reportImages.some((image) => image.id === 'img-1'));
  });
}
