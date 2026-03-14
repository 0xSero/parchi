import type { Message } from '../../ai/messages/schema.js';
import { type RuntimeSendResponse, respondAccepted, respondOk } from '../message-response.js';
import type { ServiceContext } from '../service-context.js';

// Helper to normalize session ID
export function normalizeSessionId(sessionId: unknown, fallback: string): string {
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : fallback;
}

// Relay configuration handler
export async function handleRelayReconfigure(
  _ctx: ServiceContext,
  _message: unknown,
  sendResponse: RuntimeSendResponse,
  applyRelayConfig: () => Promise<void>,
) {
  await applyRelayConfig();
  respondOk(sendResponse);
}

// User message handler
export function handleUserMessage(ctx: ServiceContext, message: any, sendResponse: RuntimeSendResponse) {
  const sessionId = normalizeSessionId(message.sessionId, `session-${Date.now()}`);
  const userMessage = typeof message.message === 'string' ? message.message : '';
  respondAccepted(sendResponse, sessionId);
  void ctx.processUserMessage(
    userMessage,
    message.conversationHistory,
    message.selectedTabs || [],
    sessionId,
    undefined,
    message.recordedContext,
  );
}

// Context compaction handler
export function handleCompactContext(ctx: ServiceContext, message: any, sendResponse: RuntimeSendResponse) {
  const sessionId = normalizeSessionId(message.sessionId, `session-${Date.now()}`);
  const conversationHistory = Array.isArray(message.conversationHistory)
    ? (message.conversationHistory as Message[])
    : [];
  respondAccepted(sendResponse, sessionId);
  void ctx.processContextCompaction(conversationHistory, sessionId, {
    source: typeof message.trigger === 'string' ? message.trigger : 'manual',
    force: true,
  });
}
