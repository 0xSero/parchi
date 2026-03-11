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

  if (active.origin === 'relay') {
    ctx.relayActiveRunIds.delete(runId);
    if (ctx.relay.isConnected()) {
      ctx.relay.notify('run.done', { runId, status: 'stopped', note });
    }
  }
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
  for (const [runId, active] of ctx.activeRuns.entries()) {
    if (active.origin !== 'sidepanel') continue;
    stopRun(ctx, runId, note);
  }
}

export function registerActiveRun(
  ctx: ServiceContext,
  runMeta: RunMeta,
  origin: 'sidepanel' | 'relay',
): AbortController {
  stopRunBySession(ctx, runMeta.sessionId, 'Superseded by a new message');
  const controller = new AbortController();
  ctx.activeRuns.set(runMeta.runId, { runMeta, origin, controller });
  ctx.activeRunIdBySessionId.set(runMeta.sessionId, runMeta.runId);
  return controller;
}

export function cleanupRun(ctx: ServiceContext, runMeta: RunMeta, origin: 'sidepanel' | 'relay') {
  const active = ctx.activeRuns.get(runMeta.runId);
  if (active && active.origin === origin) {
    ctx.activeRuns.delete(runMeta.runId);
  }
  const mapped = ctx.activeRunIdBySessionId.get(runMeta.sessionId);
  if (mapped === runMeta.runId) {
    ctx.activeRunIdBySessionId.delete(runMeta.sessionId);
  }
  ctx.cancelledRunIds.delete(runMeta.runId);
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

  if (ctx.relayActiveRunIds.has(runMeta.runId) && ctx.relay.isConnected()) {
    ctx.relay.notify('run.event', { runId: runMeta.runId, event: message });
    const type = typeof payload.type === 'string' ? payload.type : '';
    if (type === 'assistant_final') {
      ctx.relay.notify('run.done', { runId: runMeta.runId, status: 'completed', final: message });
    } else if (type === 'run_error') {
      ctx.relay.notify('run.done', { runId: runMeta.runId, status: 'failed', error: message });
    }
  }
}
