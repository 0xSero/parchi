import type { BrowserTools } from '../../tools/browser-tools.js';
import type { ServiceContext } from '../service-context.js';
import type { SessionState } from '../service-types.js';
import { type ToolExecutionArgs, type ToolExecutionOptions, isObjectRecord } from './tool-executor-shared.js';
import { handleScreenshotResult, handleWatchVideoResult } from './tool-postprocess-vision.js';

const MAX_FAILURE_TRACKER_ENTRIES = 250;
const TAB_MODIFYING_TOOLS = new Set(['openTab', 'closeTab', 'navigate', 'switchTab', 'focusTab']);
const BROWSER_ACTIONS = new Set(['navigate', 'click', 'type', 'scroll', 'pressKey']);

export function applyFailureDedup(
  sessionState: SessionState,
  toolName: string,
  args: ToolExecutionArgs,
  result: unknown,
) {
  const failureKey = `${toolName}:${String(args.selector || args.url || '')}`;
  const resultRecord = isObjectRecord(result) ? result : null;
  if (resultRecord?.success === false || typeof resultRecord?.error === 'string') {
    const tracker = sessionState.failureTracker || new Map();
    sessionState.failureTracker = tracker;
    const existing = tracker.get(failureKey) || { count: 0, lastError: '' };
    existing.count += 1;
    existing.lastError = String(resultRecord.error || '');
    tracker.set(failureKey, existing);

    if (tracker.size > MAX_FAILURE_TRACKER_ENTRIES) {
      const overflow = tracker.size - MAX_FAILURE_TRACKER_ENTRIES;
      const keys = tracker.keys();
      for (let i = 0; i < overflow; i += 1) {
        const key = keys.next().value;
        if (key === undefined) break;
        tracker.delete(key);
      }
    }

    if (existing.count >= 3) {
      resultRecord._failureAdvice = `This tool+target has failed ${existing.count} times. Try a fundamentally different approach (different selector, different strategy, or skip this step).`;
    }
    return;
  }

  sessionState.failureTracker?.delete(failureKey);
}

export function broadcastTabStateIfNeeded(
  _ctx: ServiceContext,
  _browserTools: BrowserTools,
  toolName: string,
  _options: ToolExecutionOptions,
) {
  if (!TAB_MODIFYING_TOOLS.has(toolName)) return;
}

export function updateVerificationState(sessionState: SessionState, toolName: string, result: unknown) {
  const resultRecord = isObjectRecord(result) ? result : null;
  if (BROWSER_ACTIONS.has(toolName) && resultRecord?.success !== false) {
    sessionState.lastBrowserAction = toolName;
    sessionState.awaitingVerification = true;
    sessionState.currentStepVerified = false;
    return;
  }

  if (toolName === 'getContent') {
    sessionState.awaitingVerification = false;
    sessionState.currentStepVerified = true;
  }
}

export async function postprocessBrowserResult(
  ctx: ServiceContext,
  sessionState: SessionState,
  toolName: string,
  result: unknown,
  args: ToolExecutionArgs,
  options: ToolExecutionOptions,
  callId: string,
) {
  let nextResult = result;
  if (toolName === 'screenshot') {
    nextResult = await handleScreenshotResult(ctx, sessionState, nextResult, args, options, callId);
  }
  if (toolName === 'watchVideo') {
    nextResult = await handleWatchVideoResult(nextResult, options);
  }
  return nextResult;
}
