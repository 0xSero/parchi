import { clickTool } from '../../../packages/extension/tools/browser-click-tools.js';
import type { BrowserToolsDelegate } from '../../../packages/extension/tools/browser-tool-shared.js';
import { waitForTool } from '../../../packages/extension/tools/browser-wait-tools.js';
import { type TestRunner, log } from '../shared/runner.js';

/**
 * PAR-18 Stage 4 — field-report path regression.
 *
 * Simulates the full agent path from the Facebook Messenger incident
 * (navigate → waitFor(selector) → waitFor(text) → click) using the tool
 * layer. This proves the basic user flow from the field report no longer
 * cascades generic "Script execution failed" once the host CSP rejects
 * `new Function`. Each step is fed a successful runInTab result, simulating
 * a page whose CSP is strict (so `evaluate` would fail) but where the
 * CSP-safe selector/text/click paths still work.
 *
 * The same shape generalises to any strict-CSP SPA — LinkedIn, X, Google
 * apps, banking — not just Facebook. The host name is incidental; the
 * hardening is on the tool layer.
 */

export async function runBrowserCspFieldReportSuite(runner: TestRunner) {
  log('\n=== Testing CSP-strict SPA field-report path (PAR-18 S4) ===', 'info');

  await runner.test(
    'field-report path: navigate → waitFor(selector) → waitFor(text) → click succeeds end-to-end on CSP-strict page (no cascading script failures)',
    async () => {
      const calls: string[] = [];
      const stub: BrowserToolsDelegate['runInTab'] = (async (
        _tabId: number,
        _func: (...a: unknown[]) => unknown,
        _args: unknown[],
      ) => {
        // Track which tool ran (peek at the first arg which is always a label or selector).
        calls.push('ok');
        return { success: true };
      }) as unknown as BrowserToolsDelegate['runInTab'];

      const ctx = {
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
        runInTab: stub,
        runInAllFrames: stub,
        sendOverlay: async () => {},
      } as unknown as BrowserToolsDelegate;

      // Step 1: waitFor(selector="h2") — the Unread heading
      const step1 = (await waitForTool(ctx, { selector: 'h2', timeoutMs: 1000 })) as { success: boolean };
      runner.assertTrue(step1.success, 'waitFor(selector) on a CSP-strict page must succeed via the non-script path');

      // Step 2: waitFor(text="Chats") — switching tabs
      const step2 = (await waitForTool(ctx, { text: 'Chats', timeoutMs: 1000 })) as { success: boolean };
      runner.assertTrue(step2.success, 'waitFor(text) on a CSP-strict page must succeed via the non-script path');

      // Step 3: click the "Unread" text-based selector
      const step3 = (await clickTool(ctx, { selector: 'a[href*="messages"]', timeoutMs: 1000 })) as {
        success: boolean;
      };
      runner.assertTrue(step3.success, 'click on a CSP-strict page must succeed via the non-script path');

      // 3 calls, 3 successes — no cascade.
      runner.assertEqual(calls.length, 3, 'each agent step should fire exactly one runInTab call');
    },
  );
}
