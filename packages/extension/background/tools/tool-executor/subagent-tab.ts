import { SUBAGENT_COLORS } from '../../../subagent-colors.js';
import type { BrowserTools } from '../../../tools/browser-tools.js';
import type { ServiceContext } from '../../service-context.js';
import type { RunMeta } from '../../service-types.js';

export type SubagentTab = {
  tabId: number;
  url: string;
  browserTools: BrowserTools;
  colorIndex: number;
};

/**
 * Create a dedicated Chrome tab for a subagent and return an isolated
 * BrowserTools instance scoped to that tab.
 *
 * The new BrowserTools is registered in the session-manager map under
 * `subagentSessionId` so executeToolByName resolves it automatically.
 */
export async function createSubagentTab(
  ctx: ServiceContext,
  runMeta: RunMeta,
  subagentSessionId: string,
  subagentIndex: number,
  requestedUrl?: string,
): Promise<SubagentTab> {
  const url = requestedUrl && requestedUrl.trim() ? requestedUrl.trim() : 'about:blank';

  // Resolve the window from the parent session so the new tab opens nearby.
  const parentBrowserTools = ctx.getBrowserTools(runMeta.sessionId);
  let windowId: number | undefined;
  try {
    windowId = await parentBrowserTools.resolveSessionWindowId();
  } catch {}

  const tab = await chrome.tabs.create({
    url,
    active: false,
    ...(typeof windowId === 'number' ? { windowId } : {}),
  });

  if (typeof tab.id !== 'number') {
    throw new Error('Chrome tab creation returned no tab ID');
  }

  // Create a dedicated BrowserTools scoped to this single tab.
  const browserTools = ctx.getBrowserTools(subagentSessionId);
  browserTools.sessionTabs.set(tab.id, {
    id: tab.id,
    title: tab.title,
    url: tab.url ?? url,
    windowId: typeof tab.windowId === 'number' ? tab.windowId : undefined,
  });
  browserTools.currentSessionTabId = tab.id;

  const colorIndex = subagentIndex % SUBAGENT_COLORS.length;

  return { tabId: tab.id, url, browserTools, colorIndex };
}

/**
 * Clean up a subagent's Chrome tab after it finishes.
 * The tab is NOT closed automatically — the orchestrator may want to inspect it.
 * We only remove the BrowserTools mapping.
 */
export function cleanupSubagentTab(ctx: ServiceContext, subagentSessionId: string) {
  ctx.releaseSessionResources(subagentSessionId);
}
