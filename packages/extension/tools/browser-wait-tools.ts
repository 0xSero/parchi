import {
  DEFAULT_WAIT_POLL_INTERVAL_MS,
  EVALUATE_TOOL_MAX_SCRIPT_LENGTH,
  MIN_WAIT_POLL_INTERVAL_MS,
  runPageScript,
} from './browser-eval-shared.js';
import {
  type BrowserToolArgs,
  type BrowserToolsDelegate,
  MAX_WAIT_TIMEOUT_MS,
  missingSessionTabError,
  resolveWaitTimeoutMs,
} from './browser-tool-shared.js';

export async function waitForTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();

  const selector = typeof args.selector === 'string' ? args.selector.trim() : '';
  const expectedText = typeof args.text === 'string' ? args.text : '';
  const script = typeof args.script === 'string' ? args.script.trim() : '';
  if (!selector && !expectedText && !script) {
    return {
      success: false,
      error: 'Provide at least one of selector, text, or script.',
      code: 'invalid_args',
      hint: 'Use selector (CSS), text (page text), or script (JS expression).',
    };
  }
  if (script.length > EVALUATE_TOOL_MAX_SCRIPT_LENGTH) {
    return {
      success: false,
      error: `Script exceeds ${EVALUATE_TOOL_MAX_SCRIPT_LENGTH} characters.`,
    };
  }

  const timeout = resolveWaitTimeoutMs(args.timeoutMs);
  const timeoutMs = timeout.timeoutMs;
  const requestedPollInterval = Number(args.pollIntervalMs);
  const pollIntervalMs = Number.isFinite(requestedPollInterval)
    ? Math.max(MIN_WAIT_POLL_INTERVAL_MS, Math.floor(requestedPollInterval))
    : DEFAULT_WAIT_POLL_INTERVAL_MS;
  const scriptArgs = Array.isArray(args.args) ? args.args : [];

  await ctx.sendOverlay(tabId, {
    label: 'Wait for condition',
    note: selector || expectedText || script.slice(0, 60),
    durationMs: Math.min(timeoutMs, 1500),
  });

  const result = await ctx.runInTab(
    tabId,
    // chrome.scripting.executeScript serializes `func` via Function.prototype.toString()
    // and re-runs it with no closure — runPageScript (a module-scope import) must be
    // reconstructed from its own source, passed in as an arg, rather than referenced directly.
    async (
      scopeSelector: string,
      text: string,
      source: string,
      runtimeArgs: unknown[],
      timeoutLimit: number,
      pollMs: number,
      runPageScriptSrc: string,
    ) => {
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const startedAt = Date.now();
      let attempts = 0;

      let runPageScriptFn: ((s: string, a: unknown[]) => Promise<unknown>) | null = null;
      if (source) {
        try {
          runPageScriptFn = new Function(`return (${runPageScriptSrc});`)() as (
            s: string,
            a: unknown[],
          ) => Promise<unknown>;
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            code: 'csp_blocked',
            hint: 'Script condition blocked by page CSP. Use selector or text instead.',
          };
        }
      }

      const check = async () => {
        let element: Element | null = null;
        if (scopeSelector) {
          try {
            element = document.querySelector(scopeSelector);
          } catch (error) {
            return {
              done: true,
              result: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
          if (!element) return { done: false };
        }

        // Only touch `document` when text matching is requested — pure-script waits
        // must not require a DOM (and unit tests exercise that path in Node).
        if (text) {
          const textScope = element ?? document.body;
          if (!(textScope?.textContent || '').includes(text)) {
            return { done: false };
          }
        }

        if (source) {
          if (!runPageScriptFn) {
            return {
              done: true,
              result: {
                success: false,
                error: 'Script execution blocked.',
                code: 'csp_blocked',
                hint: 'Script condition blocked by page CSP. Use selector or text instead.',
              },
            };
          }
          try {
            if (!(await runPageScriptFn(source, runtimeArgs))) {
              return { done: false };
            }
          } catch (error) {
            return {
              done: true,
              result: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                code: 'csp_blocked',
                hint: 'Script condition blocked by page CSP. Use selector or text instead.',
              },
            };
          }
        }

        return {
          done: true,
          result: {
            success: true,
            matchedSelector: scopeSelector || undefined,
            matchedText: text || undefined,
            elapsedMs: Date.now() - startedAt,
            attempts,
          },
        };
      };

      while (Date.now() - startedAt <= timeoutLimit) {
        attempts += 1;
        const outcome = await check();
        if (outcome.done) return outcome.result;
        await sleep(pollMs);
      }

      return {
        success: false,
        error: 'Timed out waiting for condition.',
        matchedSelector: scopeSelector || undefined,
        matchedText: text || undefined,
        elapsedMs: Date.now() - startedAt,
        attempts,
      };
    },
    [selector, expectedText, script, scriptArgs, timeoutMs, pollIntervalMs, runPageScript.toString()] as const,
  );

  if (timeout.wasClamped && result && typeof result === 'object') {
    return {
      ...result,
      warning: `timeoutMs capped at ${MAX_WAIT_TIMEOUT_MS}ms to prevent runaway polling.`,
      timeoutMsRequested: args.timeoutMs,
      timeoutMsUsed: timeoutMs,
    };
  }

  return result || { success: false, error: 'Script execution failed.' };
}
