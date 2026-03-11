import { normalizeSessionId } from './message-handlers-core.js';
import type { ServiceContext } from './service-context.js';

// Run control handler
export function handleStopRun(ctx: ServiceContext, message: any, sendResponse: (response?: any) => void) {
  const sessionId = normalizeSessionId(message.sessionId, '');
  const note = typeof message.note === 'string' && message.note.trim() ? message.note.trim() : 'Stopped';
  const stopped = sessionId ? ctx.stopRunBySession(sessionId, note) : false;
  if (!stopped) {
    ctx.stopAllSidepanelRuns(note);
  }
  sendResponse({ success: true });
}
