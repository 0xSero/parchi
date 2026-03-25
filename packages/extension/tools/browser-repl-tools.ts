import { EVALUATE_TOOL_MAX_SCRIPT_LENGTH } from './browser-eval-shared.js';
import { type BrowserToolArgs, type BrowserToolsDelegate, missingSessionTabError } from './browser-tool-shared.js';

/**
 * REPL tool — sandboxed JavaScript execution with browserjs() helper.
 * browserjs() returns a proxy for clean DOM interaction from a sandbox.
 * navigate() lets scripts trigger navigation within the REPL session.
 */
export async function replTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();

  const script = typeof args.script === 'string' ? args.script.trim() : '';
  if (!script) {
    return { success: false, error: 'Missing script parameter.' };
  }
  if (script.length > EVALUATE_TOOL_MAX_SCRIPT_LENGTH) {
    return { success: false, error: `Script exceeds ${EVALUATE_TOOL_MAX_SCRIPT_LENGTH} characters.` };
  }

  const scriptArgs = Array.isArray(args.args) ? args.args : [];

  await ctx.sendOverlay(tabId, {
    label: 'REPL',
    note: script.slice(0, 60),
    durationMs: 1200,
  });

  const result = await ctx.runInTabMainWorld(
    tabId,
    async (source: string, runtimeArgs: unknown[]) => {
      const logs: string[] = [];
      const maxLogs = 50;

      const sandboxConsole = {
        log: (...a: unknown[]) => {
          if (logs.length < maxLogs) logs.push(a.map(String).join(' '));
        },
        warn: (...a: unknown[]) => {
          if (logs.length < maxLogs) logs.push(`[warn] ${a.map(String).join(' ')}`);
        },
        error: (...a: unknown[]) => {
          if (logs.length < maxLogs) logs.push(`[error] ${a.map(String).join(' ')}`);
        },
        info: (...a: unknown[]) => {
          if (logs.length < maxLogs) logs.push(`[info] ${a.map(String).join(' ')}`);
        },
      };

      // browserjs() provides clean DOM interaction helpers
      const browserjs = () => ({
        querySelector: (sel: string) => document.querySelector(sel),
        querySelectorAll: (sel: string) => Array.from(document.querySelectorAll(sel)),
        getText: (sel?: string) => {
          const el = sel ? document.querySelector<HTMLElement>(sel) : document.body;
          return el?.innerText || '';
        },
        getHtml: (sel?: string) => {
          const el = sel ? document.querySelector<HTMLElement>(sel) : document.body;
          return el?.innerHTML || '';
        },
        getAttribute: (sel: string, attr: string) => {
          const el = document.querySelector(sel);
          return el?.getAttribute(attr) || null;
        },
        click: (sel: string) => {
          const el = document.querySelector<HTMLElement>(sel);
          if (!el) return { clicked: false, reason: 'not found' };
          el.click();
          return { clicked: true, tag: el.tagName };
        },
        fill: (sel: string, value: string) => {
          const el = document.querySelector<HTMLInputElement>(sel);
          if (!el) return { filled: false, reason: 'not found' };
          el.focus();
          el.value = value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return { filled: true };
        },
        getLinks: (scope?: string) => {
          const base = scope ? document.querySelector(scope) : document;
          if (!base) return [];
          return Array.from(base.querySelectorAll('a'))
            .slice(0, 200)
            .map((a) => ({
              text: (a.textContent || '').trim().slice(0, 80),
              href: a.href,
            }));
        },
        getTableData: (sel?: string) => {
          const table = sel
            ? document.querySelector<HTMLTableElement>(sel)
            : document.querySelector<HTMLTableElement>('table');
          if (!table) return null;
          const rows = Array.from(table.rows);
          return rows.map((row) => Array.from(row.cells).map((cell) => (cell.textContent || '').trim()));
        },
        url: () => window.location.href,
        title: () => document.title,
        scrollTo: (y: number) => {
          window.scrollTo({ top: y, behavior: 'smooth' });
          return { scrolled: true, y };
        },
        waitForSelector: async (sel: string, timeoutMs = 5000) => {
          const start = Date.now();
          while (Date.now() - start < timeoutMs) {
            if (document.querySelector(sel)) return true;
            await new Promise((r) => setTimeout(r, 200));
          }
          return false;
        },
      });

      // navigate() triggers client-side navigation
      const navigate = (url: string) => {
        window.location.href = url;
        return { navigated: true, url };
      };

      try {
        const fn = new Function('args', 'console', 'browserjs', 'navigate', `return (async () => {\n${source}\n})();`);
        const value = await fn(runtimeArgs, sandboxConsole, browserjs, navigate);
        const safeValue = (() => {
          try {
            if (value == null) return null;
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
            const json = JSON.stringify(value);
            if (json && json.length <= 50000) return JSON.parse(json);
            return String(value).slice(0, 5000);
          } catch {
            return String(value).slice(0, 5000);
          }
        })();
        return {
          success: true,
          result: safeValue,
          logs: logs.length > 0 ? logs : undefined,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const isCsp = msg.includes('Content Security Policy') || msg.includes('unsafe-eval');
        return {
          success: false,
          error: isCsp
            ? 'This page blocks dynamic script execution (CSP). Use getContent, click, fill, and other DOM tools instead of repl/evaluate.'
            : msg,
          logs: logs.length > 0 ? logs : undefined,
        };
      }
    },
    [script, scriptArgs] as const,
  );

  return result || { success: false, error: 'REPL execution failed.' };
}
