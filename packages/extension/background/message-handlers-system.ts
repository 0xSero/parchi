import { recordContentPerfEvent } from './content-perf.js';
import type { ServiceContext } from './service-context.js';

// Content handlers
export function handleContentPerfEvent(
  _ctx: ServiceContext,
  message: any,
  sendResponse: (response?: any) => void,
  sender: chrome.runtime.MessageSender,
) {
  void recordContentPerfEvent(message.event, sender);
  sendResponse({ success: true });
}

export function handleContentScriptReady(
  ctx: ServiceContext,
  _message: unknown,
  sendResponse: (response?: any) => void,
  sender: chrome.runtime.MessageSender,
) {
  if (typeof sender.tab?.id === 'number') {
    ctx.syncSubagentTabBadge(sender.tab.id);
  }
  sendResponse({ success: true });
}

// System handlers
export async function handleResetAllProfiles(
  _ctx: ServiceContext,
  _message: unknown,
  sendResponse: (response?: any) => void,
) {
  await chrome.storage.local.set({
    configs: {},
    providers: {},
    activeConfig: 'default',
    provider: '',
    apiKey: '',
    model: '',
    customEndpoint: '',
    extraHeaders: {},
    providerId: '',
    modelId: '',
  });
  sendResponse({ success: true });
}

export async function handleGenerateWorkflow(
  ctx: ServiceContext,
  message: any,
  sendResponse: (response?: any) => void,
) {
  const result = await ctx.generateWorkflowPrompt(message.sessionContext || '', message.maxOutputTokens);
  sendResponse({ success: true, result });
}
