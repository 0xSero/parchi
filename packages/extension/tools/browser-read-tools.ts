import { type BrowserToolArgs, type BrowserToolsDelegate, missingSessionTabError } from './browser-tool-shared.js';

const EVALUATE_TOOL_MAX_SCRIPT_LENGTH = 20_000;

export async function evaluateTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();

  const script = typeof args.script === 'string' ? args.script.trim() : '';
  if (!script) {
    return { success: false, error: 'Missing script parameter.' };
  }
  if (script.length > EVALUATE_TOOL_MAX_SCRIPT_LENGTH) {
    return {
      success: false,
      error: `Script exceeds ${EVALUATE_TOOL_MAX_SCRIPT_LENGTH} characters.`,
    };
  }

  const scriptArgs = Array.isArray(args.args) ? args.args : [];
  await ctx.sendOverlay(tabId, {
    label: 'Evaluate script',
    note: script.slice(0, 60),
    durationMs: 800,
  });

  const result = await ctx.runInTab(
    tabId,
    async (source: string, runtimeArgs: unknown[]) => {
      const toJsonSafe = (value: unknown, seen = new WeakSet<object>()): unknown => {
        if (value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          return value;
        }
        if (typeof value === 'bigint') {
          return value.toString();
        }
        if (typeof value === 'function') {
          return '[Function]';
        }
        if (value instanceof Date) {
          return value.toISOString();
        }
        if (value instanceof RegExp) {
          return String(value);
        }
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack,
          };
        }
        if (typeof Node !== 'undefined' && value instanceof Node) {
          if (value instanceof Element) {
            return {
              nodeType: value.nodeType,
              tagName: value.tagName,
              id: value.id || undefined,
              className: value.className || undefined,
              textContent: value.textContent?.slice(0, 500) || '',
            };
          }
          return {
            nodeType: value.nodeType,
            textContent: value.textContent?.slice(0, 500) || '',
          };
        }
        if (Array.isArray(value)) {
          return value.map((entry) => toJsonSafe(entry, seen));
        }
        if (value instanceof Map) {
          return Array.from(value.entries()).map(([key, entry]) => [toJsonSafe(key, seen), toJsonSafe(entry, seen)]);
        }
        if (value instanceof Set) {
          return Array.from(value.values()).map((entry) => toJsonSafe(entry, seen));
        }
        if (typeof value === 'object') {
          if (seen.has(value as object)) {
            return '[Circular]';
          }
          seen.add(value as object);
          const output: Record<string, unknown> = {};
          for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
            output[key] = toJsonSafe(entry, seen);
          }
          seen.delete(value as object);
          return output;
        }
        return String(value);
      };

      try {
        const factory = new Function('args', `return (async () => {\n${source}\n})();`);
        let value: unknown;
        try {
          value = await factory(runtimeArgs);
        } catch {
          const expressionFactory = new Function('args', `return (${source});`);
          value = await expressionFactory(runtimeArgs);
        }
        return {
          success: true,
          result: toJsonSafe(value),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    [script, scriptArgs] as const,
  );

  return result || { success: false, error: 'Script execution failed.' };
}

export async function getContentTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();
  const type = String(args.type || args.mode || 'text');
  const selector = args.selector ? String(args.selector) : '';
  const maxChars = typeof args.maxChars === 'number' && args.maxChars > 0 ? args.maxChars : 8000;
  await ctx.sendOverlay(tabId, {
    label: 'Read page',
    note: selector ? `from ${selector}` : type,
    durationMs: 1200,
  });
  const result = await ctx.runInTab(
    tabId,
    (t: string, sel: string, limit: number) => {
      const base = sel ? document.querySelector<HTMLElement>(sel) : document.body;
      if (!base) return { success: false, error: 'Target not found.' };
      const normalizedType = ['text', 'html', 'title', 'url', 'links'].includes(t) ? t : 'text';
      const truncate = (value: string) => {
        const length = value.length;
        if (length <= limit) {
          return { content: value, truncated: false, contentLength: length };
        }
        return { content: value.slice(0, limit), truncated: true, contentLength: length };
      };
      if (normalizedType === 'html') {
        const result = truncate(base.innerHTML);
        return { success: true, ...result };
      }
      if (normalizedType === 'title') {
        const result = truncate(document.title || '');
        return { success: true, ...result };
      }
      if (normalizedType === 'url') {
        const result = truncate(window.location.href || '');
        return { success: true, ...result };
      }
      if (normalizedType === 'links') {
        const links = Array.from(base.querySelectorAll('a'))
          .slice(0, 200)
          .map((link) => ({
            text: link.textContent || '',
            href: link.href,
          }));
        const result = truncate(JSON.stringify(links));
        return { success: true, items: links.length, ...result };
      }
      const result = truncate(base.innerText || '');
      return { success: true, ...result };
    },
    [type, selector, maxChars] as const,
  );
  return result || { success: false, error: 'Script execution failed.' };
}

export async function findHtmlTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();

  const htmlSnippet = String(args.htmlSnippet || args.snippet || '').trim();
  if (!htmlSnippet) {
    return {
      success: false,
      error: 'Missing htmlSnippet parameter.',
    };
  }

  const selector = args.selector ? String(args.selector) : '';
  const normalizeWhitespace = args.normalizeWhitespace === true;
  const maxMatches = Math.max(1, Math.min(20, Math.floor(Number(args.maxMatches) || 8)));
  await ctx.sendOverlay(tabId, {
    label: 'Find HTML snippet',
    note: selector ? `within ${selector}` : 'in document markup',
    durationMs: 700,
  });

  const result = await ctx.runInTab(
    tabId,
    (scopeSelector: string, needle: string, normalizeWs: boolean, matchLimit: number) => {
      const normalize = (value: string) => {
        if (!normalizeWs) return value;
        return value.replace(/\s+/g, ' ').trim();
      };

      let scope: HTMLElement | null = null;
      try {
        if (scopeSelector) {
          scope = document.querySelector(scopeSelector);
        }
      } catch {
        scope = null;
      }
      const sourceNode = scope || document.documentElement;
      if (!sourceNode) return { success: false, error: 'Target scope not found.' };

      const rawSource = sourceNode.outerHTML || '';
      const source = normalize(rawSource);
      const normalizedNeedle = normalize(needle);
      const haystack = normalizeWs ? source : rawSource;
      const searchNeedle = normalizeWs ? normalizedNeedle : needle;

      const matches: Array<{ index: number; context: string }> = [];
      if (searchNeedle && searchNeedle.length > 0) {
        let position = 0;
        while (matches.length < matchLimit) {
          const foundAt = haystack.indexOf(searchNeedle, position);
          if (foundAt < 0) break;
          const contextStart = Math.max(0, foundAt - 120);
          const contextEnd = Math.min(haystack.length, foundAt + searchNeedle.length + 120);
          matches.push({
            index: foundAt,
            context: haystack.slice(contextStart, contextEnd),
          });
          position = foundAt + Math.max(1, searchNeedle.length);
        }
      }

      if (!normalizeWs && matches.length === 0 && normalizedNeedle && normalizedNeedle !== needle) {
        let position = 0;
        while (matches.length < matchLimit) {
          const foundAt = source.indexOf(normalizedNeedle, position);
          if (foundAt < 0) break;
          const contextStart = Math.max(0, foundAt - 120);
          const contextEnd = Math.min(source.length, foundAt + normalizedNeedle.length + 120);
          matches.push({
            index: -1,
            context: source.slice(contextStart, contextEnd),
          });
          position = foundAt + Math.max(1, normalizedNeedle.length);
        }
      }

      return {
        success: true,
        hasMatch: matches.length > 0,
        matchCount: matches.length,
        matched: matches.length > 0 ? `Found ${matches.length} match(es) for provided HTML.` : 'No exact match found.',
        scopeSelector: scopeSelector || ':root',
        snippetLength: searchNeedle.length,
        sourceLength: haystack.length,
        matches,
      };
    },
    [selector, htmlSnippet, normalizeWhitespace, maxMatches] as const,
  );

  return result || { success: false, error: 'Script execution failed.' };
}
