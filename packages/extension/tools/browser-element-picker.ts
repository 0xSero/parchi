import {
  type BrowserToolArgs,
  type BrowserToolsDelegate,
  formatToolError,
  missingSessionTabError,
} from './browser-tool-shared.js';

/**
 * ask_user_element — inject an overlay so the user can visually pick a DOM element.
 * Returns the CSS selector, tag, text, and attributes of the chosen element.
 */
export async function askUserElementTool(ctx: BrowserToolsDelegate, args: BrowserToolArgs) {
  const tabId = await ctx.resolveTabId(args);
  if (!tabId) return missingSessionTabError();

  const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : 'Select an element';

  try {
    const result = await ctx.runInTab(
      tabId,
      (promptText: string) => {
        return new Promise((resolve) => {
          // Remove any existing picker
          const existing = document.getElementById('__parchi_element_picker');
          if (existing) existing.remove();

          const overlay = document.createElement('div');
          overlay.id = '__parchi_element_picker';
          overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;';

          const banner = document.createElement('div');
          banner.style.cssText =
            'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
            'background:rgba(15,15,20,0.92);color:#e4e4e7;padding:10px 20px;border-radius:12px;' +
            'font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:500;' +
            'backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.1);' +
            'box-shadow:0 8px 32px rgba(0,0,0,0.4);pointer-events:none;max-width:80vw;text-align:center;';
          banner.textContent = promptText;
          overlay.appendChild(banner);

          const highlight = document.createElement('div');
          highlight.style.cssText =
            'position:fixed;pointer-events:none;border:2px solid #818cf8;border-radius:4px;' +
            'background:rgba(129,140,248,0.08);transition:all 80ms ease;z-index:2147483646;display:none;';
          overlay.appendChild(highlight);

          const label = document.createElement('div');
          label.style.cssText =
            'position:fixed;pointer-events:none;background:rgba(15,15,20,0.9);color:#a5b4fc;' +
            'padding:3px 8px;border-radius:6px;font-size:11px;font-family:monospace;' +
            'z-index:2147483647;display:none;white-space:nowrap;border:1px solid rgba(129,140,248,0.3);';
          overlay.appendChild(label);

          let lastTarget: Element | null = null;

          const handleMove = (e: MouseEvent) => {
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (!el || el === overlay || overlay.contains(el)) return;
            lastTarget = el;
            const rect = el.getBoundingClientRect();
            highlight.style.display = 'block';
            highlight.style.top = `${rect.top}px`;
            highlight.style.left = `${rect.left}px`;
            highlight.style.width = `${rect.width}px`;
            highlight.style.height = `${rect.height}px`;

            const tag = el.tagName.toLowerCase();
            const id = el.id ? `#${el.id}` : '';
            const cls =
              el.className && typeof el.className === 'string'
                ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
                : '';
            label.textContent = `${tag}${id}${cls}`;
            label.style.display = 'block';
            label.style.top = `${Math.max(0, rect.top - 28)}px`;
            label.style.left = `${rect.left}px`;
          };

          const cleanup = () => {
            overlay.removeEventListener('mousemove', handleMove);
            overlay.removeEventListener('click', handleClick);
            document.removeEventListener('keydown', handleEscape);
            overlay.remove();
          };

          const buildSelector = (el: Element): string => {
            if (el.id) return `#${el.id}`;
            const tag = el.tagName.toLowerCase();
            if (el.className && typeof el.className === 'string') {
              const classes = el.className.trim().split(/\s+/).slice(0, 3).join('.');
              if (classes) {
                const sel = `${tag}.${classes}`;
                if (document.querySelectorAll(sel).length === 1) return sel;
              }
            }
            const parent = el.parentElement;
            if (parent) {
              const children = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
              if (children.length > 1) {
                const idx = children.indexOf(el) + 1;
                return `${buildSelector(parent)} > ${tag}:nth-child(${idx})`;
              }
            }
            return tag;
          };

          const handleClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const el = lastTarget || document.elementFromPoint(e.clientX, e.clientY);
            cleanup();
            if (!el) {
              resolve({ success: false, error: 'No element selected.' });
              return;
            }
            const rect = el.getBoundingClientRect();
            resolve({
              success: true,
              selector: buildSelector(el),
              tag: el.tagName.toLowerCase(),
              id: (el as HTMLElement).id || undefined,
              className: el.className && typeof el.className === 'string' ? el.className : undefined,
              text: (el.textContent || '').trim().slice(0, 200) || undefined,
              attributes: Object.fromEntries(
                Array.from(el.attributes)
                  .filter((a) => a.name !== 'class' && a.name !== 'id')
                  .map((a) => [a.name, a.value]),
              ),
              position: {
                top: Math.round(rect.top),
                left: Math.round(rect.left),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
            });
          };

          const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
              cleanup();
              resolve({ success: false, error: 'Selection cancelled by user.' });
            }
          };

          overlay.addEventListener('mousemove', handleMove);
          overlay.addEventListener('click', handleClick);
          document.addEventListener('keydown', handleEscape);
          document.body.appendChild(overlay);

          // Auto-timeout after 30s
          setTimeout(() => {
            if (document.getElementById('__parchi_element_picker')) {
              cleanup();
              resolve({ success: false, error: 'Selection timed out after 30 seconds.' });
            }
          }, 30000);
        });
      },
      [prompt] as const,
    );

    return result || { success: false, error: 'Element picker failed.' };
  } catch (error) {
    return {
      success: false,
      error: 'Element picker injection failed.',
      details: formatToolError(error),
    };
  }
}
