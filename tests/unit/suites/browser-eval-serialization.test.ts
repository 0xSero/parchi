import { evaluateTool } from '../../../packages/extension/tools/browser-read-tools.js';
import type { BrowserToolsDelegate } from '../../../packages/extension/tools/browser-tool-shared.js';
import { waitForTool } from '../../../packages/extension/tools/browser-wait-tools.js';
import { type TestRunner, log } from '../shared/runner.js';

// chrome.scripting.executeScript serializes `func` via Function.prototype.toString() and
// re-runs it in the page with NO closure over the calling scope. A mock that just invokes
// the function in-process would miss that boundary entirely, so this reproduces it for real:
// stringify the injected function and reconstruct it with `new Function`, exactly like Chrome does.
function fakeRunInTab<TArgs extends unknown[], TResult>(
  _tabId: number,
  func: (...args: TArgs) => TResult | Promise<TResult>,
  args: TArgs,
): Promise<TResult> {
  const rebuilt = new Function(`return (${func.toString()});`)() as (...a: TArgs) => TResult | Promise<TResult>;
  return Promise.resolve(rebuilt(...args));
}

function makeCtx(): BrowserToolsDelegate {
  return {
    sessionTabs: new Map(),
    currentSessionTabId: 1,
    sessionTabGroupId: null,
    supportsTabGroups: false,
    screenshotQuality: undefined,
    getSessionTabSummaries: () => [],
    getGroupTitle: () => '',
    updateGroupTitle: async () => {},
    groupTabsInternal: async () => {},
    resolveTabId: async () => 1,
    resolveSessionWindowId: async () => undefined,
    captureActiveTab: async () => 1,
    runInTab: fakeRunInTab,
    runInAllFrames: fakeRunInTab,
    sendOverlay: async () => {},
  } as unknown as BrowserToolsDelegate;
}

export async function runBrowserEvalSerializationSuite(runner: TestRunner) {
  log('\n=== Testing evaluate/waitFor across the MV3 closure-serialization boundary ===', 'info');

  await runner.test(
    'evaluateTool runs runPageScript/toJsonSafe without a closure (regression for ReferenceError)',
    async () => {
      const result = (await evaluateTool(makeCtx(), { script: 'return args[0] + args[1]', args: [2, 3] })) as {
        success: boolean;
        result?: unknown;
      };
      runner.assertTrue(result.success, `expected success, got: ${JSON.stringify(result)}`);
      runner.assertEqual(result.result, 5);
    },
  );

  await runner.test('waitForTool script condition runs runPageScript without a closure', async () => {
    const result = (await waitForTool(makeCtx(), {
      script: 'return true',
      timeoutMs: 500,
    })) as { success: boolean };
    runner.assertTrue(result.success, `expected success, got: ${JSON.stringify(result)}`);
  });
}
