import { type RuntimeSendResponse, assertArray, respondOk } from '../message-response.js';
import type { ServiceContext } from '../service-context.js';
import { normalizeSessionId } from './core.js';

// Test handlers
export function handleConfigureSessionTabsTest(ctx: ServiceContext, message: any, sendResponse: RuntimeSendResponse) {
  const tabs = assertArray<chrome.tabs.Tab>(message.tabs, 'No tabs provided');
  const sessionId = normalizeSessionId(message.sessionId, ctx.currentSessionId || 'test');
  ctx
    .getBrowserTools(sessionId)
    .configureSessionTabs(tabs, { title: 'Test Session', color: 'blue' })
    .then(() => {
      console.log('[test] session tabs configured successfully');
      respondOk(sendResponse);
    })
    .catch((err) => {
      console.error('[test] configure_session_tabs_test error:', err);
      sendResponse({ success: false, error: String(err) });
    });
}

export async function handleApiSmokeTest(ctx: ServiceContext, message: any, sendResponse: RuntimeSendResponse) {
  const settings = message.settings || {};
  const prompt = typeof message.prompt === 'string' ? message.prompt : 'Reply with the word "pong" only.';
  const result = await ctx.runApiSmokeTest(settings, prompt);
  if (result?.error) {
    sendResponse({
      success: false,
      error: String(result.error),
      details: result,
    });
    return;
  }
  respondOk(sendResponse, { result });
}

export function handlePingTest(_ctx: ServiceContext, _message: unknown, sendResponse: RuntimeSendResponse) {
  respondOk(sendResponse, { pong: true, time: Date.now() });
}
