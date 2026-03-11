import type { Message } from '../ai/message-schema.js';
import type { ServiceContext } from './service-context.js';

// Helper to normalize session ID
export function normalizeSessionId(sessionId: unknown, fallback: string): string {
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : fallback;
}

// Relay configuration handler
export async function handleRelayReconfigure(
  _ctx: ServiceContext,
  _message: unknown,
  sendResponse: (response?: any) => void,
  applyRelayConfig: () => Promise<void>,
) {
  await applyRelayConfig();
  sendResponse({ success: true });
}

// User message handler
export function handleUserMessage(ctx: ServiceContext, message: any, sendResponse: (response?: any) => void) {
  const sessionId = normalizeSessionId(message.sessionId, `session-${Date.now()}`);
  const userMessage = typeof message.message === 'string' ? message.message : '';
  sendResponse({ success: true, accepted: true, sessionId });
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
export function handleCompactContext(ctx: ServiceContext, message: any, sendResponse: (response?: any) => void) {
  const sessionId = normalizeSessionId(message.sessionId, `session-${Date.now()}`);
  const conversationHistory = Array.isArray(message.conversationHistory)
    ? (message.conversationHistory as Message[])
    : [];
  sendResponse({ success: true, accepted: true, sessionId });
  void ctx.processContextCompaction(conversationHistory, sessionId, {
    source: typeof message.trigger === 'string' ? message.trigger : 'manual',
    force: true,
  });
}
