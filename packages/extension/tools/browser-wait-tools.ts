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
    async (
      scopeSelector: string,
      text: string,
      source: string,
      runtimeArgs: unknown[],
      timeoutLimit: number,
      pollMs: number,
    ) => {
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const startedAt = Date.now();
      let attempts = 0;

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

        const textScope = element ?? document.body;
        if (text && !(textScope?.textContent || '').includes(text)) {
          return { done: false };
        }

        if (source) {
          try {
            if (!(await runPageScript(source, runtimeArgs))) {
              return { done: false };
            }
          } catch (error) {
            return {
              done: true,
              result: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
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
    [selector, expectedText, script, scriptArgs, timeoutMs, pollIntervalMs] as const,
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
