// Lightweight Sentry-style telemetry for compaction and background errors
// No external dependencies - uses browser APIs and Chrome storage

export type TelemetryEvent = {
  id: string;
  ts: number;
  type: 'error' | 'warning' | 'info' | 'compaction';
  message: string;
  context?: Record<string, unknown>;
  stack?: string;
  sessionId?: string;
  runId?: string;
  turnId?: string;
};

const MAX_EVENTS = 500;
const TELEMETRY_STORE_ID = 'parchi_telemetry_v1';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

async function getStoredEvents(): Promise<TelemetryEvent[]> {
  try {
    const result = await chrome.storage.local.get([TELEMETRY_STORE_ID]);
    return Array.isArray(result[TELEMETRY_STORE_ID]) ? result[TELEMETRY_STORE_ID] : [];
  } catch {
    return [];
  }
}

async function storeEvents(events: TelemetryEvent[]): Promise<void> {
  try {
    await chrome.storage.local.set({ [TELEMETRY_STORE_ID]: events.slice(-MAX_EVENTS) });
  } catch {
    // Silent fail - telemetry should never break functionality
  }
}

export async function captureEvent(
  type: TelemetryEvent['type'],
  message: string,
  context?: Record<string, unknown>,
  meta?: { sessionId?: string; runId?: string; turnId?: string },
): Promise<void> {
  const event: TelemetryEvent = {
    id: generateId(),
    ts: Date.now(),
    type,
    message,
    context,
    sessionId: meta?.sessionId,
    runId: meta?.runId,
    turnId: meta?.turnId,
  };

  if (type === 'error') {
    try {
      throw new Error(message);
    } catch (e) {
      event.stack = (e as Error).stack;
    }
  }

  const events = await getStoredEvents();
  events.push(event);
  await storeEvents(events);
}

export const captureException = (
  error: Error,
  context?: Record<string, unknown>,
  meta?: { sessionId?: string; runId?: string; turnId?: string },
) => captureEvent('error', error.message, { ...context, stack: error.stack }, meta);

export const captureMessage = (
  message: string,
  level: 'info' | 'warning' = 'info',
  context?: Record<string, unknown>,
  meta?: { sessionId?: string; runId?: string; turnId?: string },
) => captureEvent(level, message, context, meta);

export const captureCompaction = (
  stage: string,
  details: Record<string, unknown>,
  meta?: { sessionId?: string; runId?: string; turnId?: string },
) => captureEvent('compaction', `compaction:${stage}`, { stage, ...details }, meta);

export async function getTelemetrySnapshot(sessionId?: string): Promise<TelemetryEvent[]> {
  const events = await getStoredEvents();
  if (!sessionId) return events;
  return events.filter((e) => e.sessionId === sessionId);
}

export async function getCompactionMetrics(sessionId: string): Promise<{
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  avgTokensRemoved?: number;
}> {
  const events = await getStoredEvents();
  const compactionEvents = events.filter((e) => e.type === 'compaction' && e.sessionId === sessionId);

  let successful = 0;
  let failed = 0;
  let skipped = 0;
  let totalRemoved = 0;
  let removalCount = 0;

  for (const e of compactionEvents) {
    const stage = (e.context?.stage as string) || '';
    if (stage === 'applied') {
      successful++;
      const removed = Number((e.context?.removedApproxTokensLowerBound as number) || 0);
      if (removed > 0) {
        totalRemoved += removed;
        removalCount++;
      }
    } else if (stage === 'failed') {
      failed++;
    } else if (stage === 'skipped') {
      skipped++;
    }
  }

  return {
    total: compactionEvents.length,
    successful,
    failed,
    skipped,
    avgTokensRemoved: removalCount > 0 ? Math.round(totalRemoved / removalCount) : undefined,
  };
}

export async function clearTelemetry(): Promise<void> {
  try {
    await chrome.storage.local.remove([TELEMETRY_STORE_ID]);
  } catch {
    // Silent fail
  }
}
