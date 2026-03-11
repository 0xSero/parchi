import { normalizeSessionId } from './message-handlers-core.js';
import type { ServiceContext } from './service-context.js';

// Test handlers
export function handleConfigureSessionTabsTest(
  ctx: ServiceContext,
  message: any,
  sendResponse: (response?: any) => void,
) {
  const tabs = message.tabs;
  if (!Array.isArray(tabs) || tabs.length === 0) {
    sendResponse({ success: false, error: 'No tabs provided' });
    return;
  }
  const sessionId = normalizeSessionId(message.sessionId, ctx.currentSessionId || 'test');
  ctx
    .getBrowserTools(sessionId)
    .configureSessionTabs(tabs, { title: 'Test Session', color: 'blue' })
    .then(() => {
      console.log('[test] session tabs configured successfully');
      sendResponse({ success: true });
    })
    .catch((err) => {
      console.error('[test] configure_session_tabs_test error:', err);
      sendResponse({ success: false, error: String(err) });
    });
}

export async function handleApiSmokeTest(ctx: ServiceContext, message: any, sendResponse: (response?: any) => void) {
  const settings = message.settings || {};
  const prompt = typeof message.prompt === 'string' ? message.prompt : 'Reply with the word "pong" only.';
  const result = await ctx.runApiSmokeTest(settings, prompt);
  sendResponse({ success: true, result });
}

export function handlePingTest(_ctx: ServiceContext, _message: unknown, sendResponse: (response?: any) => void) {
  sendResponse({ success: true, pong: true, time: Date.now() });
}
