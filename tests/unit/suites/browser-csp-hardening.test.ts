import { evaluateTool } from '../../../packages/extension/tools/browser-read-tools.js';
import type { BrowserToolsDelegate } from '../../../packages/extension/tools/browser-tool-shared.js';
import { waitForTool } from '../../../packages/extension/tools/browser-wait-tools.js';
import { type TestRunner, log } from '../shared/runner.js';

/**
 * PAR-18 Stage 4 — CSP-strict SPA hardening verification.
 *
 * Covers:
 *   - Invalid waitFor guidance (RC-D): missing all conditions → invalid_args + hint.
 *   - CSP-shaped error mapping (RC-A): evaluate / waitFor(script) return csp_blocked.
 *   - Real runInTab classification: raw Chrome errors map to csp_blocked,
 *     frame_detached (with one retry), and executeScript_failed.
 *
 * The tests do not require a real browser. They feed a stub `runInTab` that
 * returns the same shaped error payloads the real `runInTab` in
 * browser-script-execution.ts produces, and inspect that real runInTab to
 * confirm it maps raw Chrome errors into the structured codes we rely on.
 */

const frameRemovedMessage = 'The frame with ID 0 was removed.';
const cspEvalMessage = `Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source of script in the following Content Security Policy directive: "script-src 'self'"`;

type Outcome = { kind: 'throw'; error: string } | { kind: 'return'; value: unknown };

/**
 * A scripted runInTab stub. Throws or returns the configured value at each
 * call. The error shape mirrors what Chrome's `scripting.executeScript`
 * would surface; tools are expected to convert it into a structured result.
 */
function makeScriptingStub(outcomes: Outcome[]): BrowserToolsDelegate['runInTab'] {
  let i = 0;
  return (async (_tabId: number, _func: (...a: unknown[]) => unknown, _args: unknown[]) => {
    const slot = outcomes[i] ?? { kind: 'return', value: { success: true } };
    i += 1;
    if (slot.kind === 'throw') throw new Error(slot.error);
    return slot.value;
  }) as unknown as BrowserToolsDelegate['runInTab'];
}

function makeCtxWithRunInTab(outcomes: Outcome[], overrides: Partial<BrowserToolsDelegate> = {}): BrowserToolsDelegate {
  const stub = makeScriptingStub(outcomes);
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
    runInTab: stub,
    runInAllFrames: stub,
    sendOverlay: async () => {},
    ...overrides,
  } as unknown as BrowserToolsDelegate;
}

export async function runBrowserCspHardeningSuite(runner: TestRunner) {
  log('\n=== Testing CSP-strict SPA hardening (PAR-18 S4) ===', 'info');

  // -------------------------------------------------------------------------
  // Invalid waitFor (RC-D)
  // -------------------------------------------------------------------------
  await runner.test('waitForTool rejects missing selector/text/script with invalid_args + hint', async () => {
    const ctx = makeCtxWithRunInTab([]);
    const result = (await waitForTool(ctx, { timeoutMs: 1000 })) as {
      success: boolean;
      code?: string;
      hint?: string;
      error?: string;
    };
    runner.assertFalse(result.success, 'should not succeed without a condition');
    runner.assertEqual(result.code, 'invalid_args');
    runner.assertTrue(typeof result.hint === 'string' && result.hint.length > 0, 'should carry a recovery hint');
    runner.assertIncludes(result.error || '', 'Provide at least one of selector, text, or script.');
  });

  // -------------------------------------------------------------------------
  // CSP-shaped error mapping (RC-A)
  // -------------------------------------------------------------------------
  await runner.test(
    'evaluateTool surfaces csp_blocked from the runInTab layer (regression: no more generic failure)',
    async () => {
      // The real runInTab in browser-script-execution.ts classifies Chrome's
      // CSP error into { code: 'csp_blocked', hint: ... }. We feed that
      // classification into the tool's runInTab and assert the tool passes the
      // structured result through.
      const ctx = makeCtxWithRunInTab([
        {
          kind: 'return',
          value: {
            success: false,
            error: 'Script execution blocked by page Content Security Policy.',
            code: 'csp_blocked',
            hint: 'Avoid evaluate/script conditions on this page. Use selector, text, or screenshot instead.',
          },
        },
      ]);
      const result = (await evaluateTool(ctx, { script: 'return 1' })) as {
        success: boolean;
        code?: string;
        hint?: string;
        error?: string;
      };
      runner.assertFalse(result.success, 'should surface a failure when the page CSP blocks eval');
      runner.assertEqual(result.code, 'csp_blocked');
      runner.assertTrue(typeof result.hint === 'string' && result.hint.length > 0, 'should carry a recovery hint');
      runner.assertIncludes(result.error || '', 'Content Security Policy');
    },
  );

  await runner.test('waitForTool(script) surfaces csp_blocked from the runInTab layer', async () => {
    const ctx = makeCtxWithRunInTab([
      {
        kind: 'return',
        value: {
          success: false,
          error: 'Script execution blocked by page Content Security Policy.',
          code: 'csp_blocked',
          hint: 'Script condition blocked by page CSP. Use selector or text instead.',
        },
      },
    ]);
    const result = (await waitForTool(ctx, { script: 'return true', timeoutMs: 500 })) as {
      success: boolean;
      code?: string;
      hint?: string;
    };
    runner.assertFalse(result.success, 'should surface a failure when the page CSP blocks script conditions');
    runner.assertEqual(result.code, 'csp_blocked');
    runner.assertTrue(typeof result.hint === 'string' && result.hint.length > 0);
    runner.assertIncludes(result.hint || '', 'selector or text');
  });

  // -------------------------------------------------------------------------
  // Verify the *real* runInTab in browser-script-execution.ts maps raw
  // Chrome-shaped errors to the structured codes we just fed through.
  // -------------------------------------------------------------------------
  await runner.test(
    'real runInTab classifies raw Chrome errors into structured codes (csp_blocked, frame_detached, executeScript_failed)',
    async () => {
      // We import the real runInTab here. It needs a stubbed `chrome.scripting`
      // that throws the raw messages; runInTab should catch, classify, and
      // retry-once for frame_detached.
      const { runInTab: realRunInTab } = await import('../../../packages/extension/tools/browser-script-execution.js');

      // Stub chrome.scripting.executeScript. The first call throws CSP; the
      // second throws frame-removed twice; the third throws an unrelated error.
      const callCounts: Record<string, number> = { csp: 0, frame: 0, generic: 0 };

      const installChrome = (mode: 'csp' | 'frame' | 'generic') => {
        const g = globalThis as typeof globalThis & { chrome?: any };
        const original = g.chrome;
        g.chrome = {
          scripting: {
            executeScript: async () => {
              callCounts[mode] = (callCounts[mode] || 0) + 1;
              if (mode === 'csp') throw new Error(cspEvalMessage);
              if (mode === 'frame') throw new Error(frameRemovedMessage);
              throw new Error('Some unrelated chrome.scripting.executeScript failure.');
            },
          },
        };
        return () => {
          g.chrome = original;
        };
      };

      // 1. csp_blocked
      {
        const restore = installChrome('csp');
        try {
          const result = (await realRunInTab(1, () => ({ success: true }), [])) as {
            success: boolean;
            code?: string;
            hint?: string;
          };
          runner.assertFalse(result.success, 'csp error should map to a failure');
          runner.assertEqual(result.code, 'csp_blocked');
          runner.assertTrue(typeof result.hint === 'string' && result.hint.length > 0);
          runner.assertEqual(callCounts.csp, 1, 'csp error should not be retried');
        } finally {
          restore();
        }
      }

      // 2. frame_detached — first call throws, retry succeeds
      {
        const restore = installChrome('frame');
        try {
          // Real runInTab retries once on frame_detached then returns the
          // structured error. Since the stub also throws on the retry, we
          // should see the structured frame_detached error after exactly 2 calls.
          const result = (await realRunInTab(1, () => ({ success: true }), [])) as {
            success: boolean;
            code?: string;
            hint?: string;
          };
          runner.assertFalse(result.success, 'frame error after retry should still surface as a failure');
          runner.assertEqual(result.code, 'frame_detached');
          runner.assertTrue(typeof result.hint === 'string' && result.hint.length > 0);
          runner.assertEqual(callCounts.frame, 2, 'frame error should be retried exactly once');
        } finally {
          restore();
        }
      }

      // 3. generic → executeScript_failed
      {
        const restore = installChrome('generic');
        try {
          const result = (await realRunInTab(1, () => ({ success: true }), [])) as {
            success: boolean;
            code?: string;
          };
          runner.assertFalse(result.success);
          runner.assertEqual(result.code, 'executeScript_failed');
          runner.assertEqual(callCounts.generic, 1, 'generic error should not be retried');
        } finally {
          restore();
        }
      }
    },
  );
}
