import type { ServiceContext, TokenTracePayload } from './service-context.js';
import type { RunMeta, SessionState, SessionTokenVisibility } from './service-types.js';

export function defaultTokenVisibility(): SessionTokenVisibility {
  return {
    providerInputTokens: null,
    providerOutputTokens: null,
    contextApproxTokens: null,
    contextLimit: null,
    contextPercent: null,
    sessionInputTokens: 0,
    sessionOutputTokens: 0,
    sessionTotalTokens: 0,
  };
}

export function normalizeContextPercent(tokens: number | null, limit: number | null): number | null {
  if (typeof tokens !== 'number' || tokens < 0) return null;
  if (typeof limit !== 'number' || limit <= 0) return null;
  const raw = (tokens / Math.max(1, limit)) * 100;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function getTokenVisibilitySnapshot(sessionState: SessionState): SessionTokenVisibility {
  return {
    ...(sessionState.tokenVisibility || defaultTokenVisibility()),
  };
}

export function updateSessionTokenVisibility(
  sessionState: SessionState,
  patch: Partial<SessionTokenVisibility>,
): SessionTokenVisibility {
  const current = sessionState.tokenVisibility || defaultTokenVisibility();
  const merged: SessionTokenVisibility = {
    ...current,
    ...patch,
  };
  merged.sessionInputTokens = Math.max(0, Number(merged.sessionInputTokens || 0));
  merged.sessionOutputTokens = Math.max(0, Number(merged.sessionOutputTokens || 0));
  merged.sessionTotalTokens = Math.max(0, Number(merged.sessionTotalTokens || 0));
  if (typeof merged.contextPercent !== 'number') {
    merged.contextPercent = normalizeContextPercent(merged.contextApproxTokens, merged.contextLimit);
  } else {
    merged.contextPercent = Math.max(0, Math.min(100, Math.round(merged.contextPercent)));
  }
  sessionState.tokenVisibility = merged;
  return getTokenVisibilitySnapshot(sessionState);
}

export function emitTokenTrace(
  ctx: ServiceContext,
  runMeta: RunMeta,
  sessionState: SessionState,
  payload: TokenTracePayload,
) {
  const before = payload.before || getTokenVisibilitySnapshot(sessionState);
  const after = payload.afterPatch
    ? updateSessionTokenVisibility(sessionState, payload.afterPatch)
    : getTokenVisibilitySnapshot(sessionState);
  ctx.sendRuntime(runMeta, {
    type: 'token_trace',
    action: payload.action,
    reason: payload.reason,
    note: payload.note,
    before,
    after,
    details: payload.details,
  });
}
