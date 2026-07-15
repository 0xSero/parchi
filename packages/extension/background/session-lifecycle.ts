import { RUNTIME_MESSAGE_SCHEMA_VERSION } from '@parchi/shared';
import type { ServiceContext } from './service-context.js';
import type { RunMeta } from './service-types.js';

export function isRunCancelled(cancelledRunIds: Set<string>, runId: string) {
  return cancelledRunIds.has(runId);
}

export function stopRun(ctx: ServiceContext, runId: string, note = 'Stopped') {
  const active = ctx.activeRuns.get(runId);
  if (!active) return;

  ctx.sendRuntime(active.runMeta, {
    type: 'run_status',
    phase: 'stopped',
    attempts: { api: 0, tool: 0, finalize: 0 },
    maxRetries: { api: 0, tool: 0, finalize: 0 },
    note,
  });

  ctx.cancelledRunIds.add(runId);

  try {
    active.controller.abort(note);
  } catch {}
}

export function stopRunBySession(ctx: ServiceContext, sessionId: string, note = 'Stopped') {
  const runId = ctx.activeRunIdBySessionId.get(sessionId);
  if (runId) {
    stopRun(ctx, runId, note);
    return true;
  }
  return false;
}

export function stopAllSidepanelRuns(ctx: ServiceContext, note = 'Stopped') {
  for (const [runId] of ctx.activeRuns.entries()) {
    stopRun(ctx, runId, note);
  }
}

export function registerActiveRun(ctx: ServiceContext, runMeta: RunMeta, origin: 'sidepanel'): AbortController {
  stopRunBySession(ctx, runMeta.sessionId, 'Superseded by a new message');
  const controller = new AbortController();
  ctx.activeRuns.set(runMeta.runId, { runMeta, origin, controller });
  ctx.activeRunIdBySessionId.set(runMeta.sessionId, runMeta.runId);
  return controller;
}

export function cleanupRun(ctx: ServiceContext, runMeta: RunMeta, origin: 'sidepanel') {
  const active = ctx.activeRuns.get(runMeta.runId);
  if (active && active.origin === origin) {
    ctx.activeRuns.delete(runMeta.runId);
  }
  const mapped = ctx.activeRunIdBySessionId.get(runMeta.sessionId);
  if (mapped === runMeta.runId) {
    ctx.activeRunIdBySessionId.delete(runMeta.sessionId);
  }
  ctx.cancelledRunIds.delete(runMeta.runId);

  // Detach any chrome.debugger sessions this run may have attached (watchNetwork), so the
  // "this extension is debugging this browser" banner doesn't linger past task completion.
  if (ctx.hasBrowserTools(runMeta.sessionId)) {
    void ctx.getBrowserTools(runMeta.sessionId).detachDebugSessions();
  }
}

export function sendRuntime(ctx: ServiceContext, runMeta: RunMeta, payload: Record<string, unknown>) {
  if (isRunCancelled(ctx.cancelledRunIds, runMeta.runId)) return;
  const message = {
    schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
    runId: runMeta.runId,
    turnId: runMeta.turnId,
    sessionId: runMeta.sessionId,
    timestamp: Date.now(),
    ...payload,
  };
  ctx.sendToSidePanel(message);
}
