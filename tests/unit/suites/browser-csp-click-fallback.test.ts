import { clickAtTool, clickTool } from '../../../packages/extension/tools/browser-click-tools.js';
import type { BrowserToolsDelegate } from '../../../packages/extension/tools/browser-tool-shared.js';
import { type TestRunner, log } from '../shared/runner.js';

/**
 * PAR-18 Stage 4 — click / clickAt non-script path.
 *
 * The single-largest CSP regression vector in click/clickAt was the injected
 * closure reconstructing helper functions via `new Function(...)`. When the
 * page's Content Security Policy forbids `unsafe-eval`, Chrome refuses to
 * evaluate that string and the whole click call collapses to a generic
 * "Script execution failed" — which the field report saw on Facebook
 * Messenger. These tests assert that:
 *
 *   1. clickTool passes helper functions (not their source) to the injected
 *      closure, so the closure no longer needs `new Function`.
 *   2. clickAtTool inlines its pointer/mouse dispatch and likewise never
 *      reconstructs helpers via `new Function`.
 *
 * The stub captures the injected function's source string so we can grep it
 * for a literal `new Function(` call — a regression would re-introduce it.
 */

export async function runBrowserCspClickFallbackSuite(runner: TestRunner) {
  log('\n=== Testing CSP-safe click fallback (PAR-18 S4) ===', 'info');

  await runner.test(
    'clickTool dispatches without reconstructing helpers via new Function (CSP-safe path)',
    async () => {
      const calls: Array<{ src: string; args: unknown[] }> = [];
      const stub = async (_tabId: number, func: (...a: unknown[]) => unknown, args: unknown[]) => {
        calls.push({ src: func.toString(), args });
        return { success: true, strategy: 'css', candidates: 1 };
      };
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
      const result = (await clickTool(ctx, { selector: '#submit' })) as {
        success: boolean;
        strategy?: string;
      };
      runner.assertTrue(result.success, `expected click success, got: ${JSON.stringify(result)}`);
      runner.assertEqual(calls.length, 1, 'click should not double-fire when first runInTab succeeds');
      // The four args are: spec, timeoutMs, dispatchSyntheticClick, resolveSelectorSpecElement
      runner.assertEqual(calls[0].args.length, 4);
      runner.assertEqual(
        typeof calls[0].args[2],
        'function',
        'dispatchSyntheticClick must be passed as a function ref',
      );
      runner.assertEqual(
        typeof calls[0].args[3],
        'function',
        'resolveSelectorSpecElement must be passed as a function ref',
      );
      // The injected closure must NOT contain a literal `new Function(` call
      // for the helpers — that would re-introduce the CSP eval trigger.
      runner.assertFalse(
        /new\s+Function\s*\(/.test(calls[0].src),
        'click closure must not reconstruct helpers via new Function (CSP regression)',
      );
    },
  );

  await runner.test(
    'clickAtTool inlines pointer/mouse dispatch and does not reconstruct via new Function (CSP-safe path)',
    async () => {
      const calls: Array<{ src: string; args: unknown[] }> = [];
      const stub = async (_tabId: number, func: (...a: unknown[]) => unknown, args: unknown[]) => {
        calls.push({ src: func.toString(), args });
        return { success: true, x: args[0], y: args[1], button: 'left', doubleClick: false, elementHit: null };
      };
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
      const result = (await clickAtTool(ctx, { x: 100, y: 200 })) as { success: boolean; x: number; y: number };
      runner.assertTrue(result.success, `expected clickAt success, got: ${JSON.stringify(result)}`);
      runner.assertEqual(result.x, 100);
      runner.assertEqual(result.y, 200);
      // The injected closure must NOT contain a literal `new Function(` call —
      // clickAt inlines its dispatch logic.
      runner.assertFalse(
        /new\s+Function\s*\(/.test(calls[0].src),
        'clickAt closure must not reconstruct helpers via new Function (CSP regression)',
      );
    },
  );
}
