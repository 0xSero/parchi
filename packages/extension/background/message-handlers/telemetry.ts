import { type RuntimeSendResponse, respondOk } from '../message-response.js';
import type { ServiceContext } from '../service-context.js';

// Telemetry handlers
export async function handleGetTelemetry(_ctx: ServiceContext, message: any, sendResponse: RuntimeSendResponse) {
  const { getTelemetrySnapshot, getCompactionMetrics } = await import('../telemetry.js');
  const sessionId = typeof message.sessionId === 'string' ? message.sessionId : undefined;
  const events = await getTelemetrySnapshot(sessionId);
  const metrics = sessionId ? await getCompactionMetrics(sessionId) : undefined;
  respondOk(sendResponse, { events, metrics });
}

export async function handleClearTelemetry(_ctx: ServiceContext, _message: unknown, sendResponse: RuntimeSendResponse) {
  const { clearTelemetry } = await import('../telemetry.js');
  await clearTelemetry();
  respondOk(sendResponse);
}
