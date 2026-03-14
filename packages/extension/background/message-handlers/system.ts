import { recordContentPerfEvent } from '../content-perf.js';
import { type RuntimeSendResponse, respondOk } from '../message-response.js';
import type { ServiceContext } from '../service-context.js';

// Content handlers
export function handleContentPerfEvent(
  _ctx: ServiceContext,
  message: any,
  sendResponse: RuntimeSendResponse,
  sender: chrome.runtime.MessageSender,
) {
  void recordContentPerfEvent(message.event, sender);
  respondOk(sendResponse);
}

export function handleContentScriptReady(
  ctx: ServiceContext,
  _message: unknown,
  sendResponse: RuntimeSendResponse,
  sender: chrome.runtime.MessageSender,
) {
  if (typeof sender.tab?.id === 'number') {
    ctx.syncSubagentTabBadge(sender.tab.id);
  }
  respondOk(sendResponse);
}

// System handlers
export async function handleResetAllProfiles(
  _ctx: ServiceContext,
  _message: unknown,
  sendResponse: RuntimeSendResponse,
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
  respondOk(sendResponse);
}

export async function handleGenerateWorkflow(ctx: ServiceContext, message: any, sendResponse: RuntimeSendResponse) {
  const result = await ctx.generateWorkflowPrompt(message.sessionContext || '', message.maxOutputTokens);
  respondOk(sendResponse, { result });
}
