import { type RuntimeSendResponse, respondOk } from '../message-response.js';
import type { ServiceContext } from '../service-context.js';

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

// Recording handlers
export async function handleRecordingStart(ctx: ServiceContext, message: any, sendResponse: RuntimeSendResponse) {
  try {
    await ctx.recordingCoordinator.startRecording(message.tabId);
    respondOk(sendResponse);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err, 'Recording failed');
    ctx.sendToSidePanel({ type: 'recording_error', message: errorMessage });
    sendResponse({ success: false, error: errorMessage });
  }
}

export async function handleRecordingStop(ctx: ServiceContext, _message: unknown, sendResponse: RuntimeSendResponse) {
  await ctx.recordingCoordinator.stopRecording();
  respondOk(sendResponse);
}

export async function handleRecordingSelectImages(
  ctx: ServiceContext,
  message: any,
  sendResponse: RuntimeSendResponse,
) {
  try {
    await ctx.recordingCoordinator.selectImages(message.selectedIds);
    respondOk(sendResponse);
  } catch (err: unknown) {
    sendResponse({ success: false, error: getErrorMessage(err, 'No active recording session') });
  }
}

export function handleRecordingDiscard(ctx: ServiceContext, _message: unknown, sendResponse: RuntimeSendResponse) {
  ctx.recordingCoordinator.discard();
  respondOk(sendResponse);
}

export function handleRecordingEvent(ctx: ServiceContext, message: any, sendResponse: RuntimeSendResponse) {
  ctx.recordingCoordinator.handleContentEvent(message.event);
  respondOk(sendResponse);
}
