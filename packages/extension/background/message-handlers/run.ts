import { type RuntimeSendResponse, respondOk } from '../message-response.js';
import type { ServiceContext } from '../service-context.js';
import { normalizeSessionId } from './core.js';

// Run control handler
export function handleStopRun(ctx: ServiceContext, message: any, sendResponse: RuntimeSendResponse) {
  const sessionId = normalizeSessionId(message.sessionId, '');
  const note = typeof message.note === 'string' && message.note.trim() ? message.note.trim() : 'Stopped';
  const stopped = sessionId ? ctx.stopRunBySession(sessionId, note) : false;
  if (!stopped) {
    ctx.stopAllSidepanelRuns(note);
  }
  respondOk(sendResponse);
}
