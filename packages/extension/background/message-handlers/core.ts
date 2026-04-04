import type { Message } from '../../ai/messages/schema.js';
import { type RuntimeSendResponse, respondAccepted } from '../message-response.js';
import type { ServiceContext } from '../service-context.js';

// Helper to normalize session ID
export function normalizeSessionId(sessionId: unknown, fallback: string): string {
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : fallback;
}

// User message handler
export function handleUserMessage(ctx: ServiceContext, message: any, sendResponse: RuntimeSendResponse) {
  const sessionId = normalizeSessionId(message.sessionId, `session-${Date.now()}`);
  const userMessage = typeof message.message === 'string' ? message.message : '';
  respondAccepted(sendResponse, sessionId);
  void ctx
    .processUserMessage(
      userMessage,
      message.conversationHistory,
      message.selectedTabs || [],
      sessionId,
      undefined,
      message.recordedContext,
    )
    .catch((err) => {
      console.warn('[message-handler] User message processing failed:', err);
    });
}

// Context compaction handler
export function handleCompactContext(ctx: ServiceContext, message: any, sendResponse: RuntimeSendResponse) {
  const sessionId = normalizeSessionId(message.sessionId, `session-${Date.now()}`);
  const conversationHistory = Array.isArray(message.conversationHistory)
    ? (message.conversationHistory as Message[])
    : [];
  respondAccepted(sendResponse, sessionId);
  void ctx
    .processContextCompaction(conversationHistory, sessionId, {
      source: typeof message.trigger === 'string' ? message.trigger : 'manual',
      force: true,
    })
    .catch((err) => {
      console.warn('[message-handler] Context compaction failed:', err);
    });
}
