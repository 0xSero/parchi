import type { ServiceContext } from './service-context.js';

// Recording handlers
export async function handleRecordingStart(ctx: ServiceContext, message: any, sendResponse: (response?: any) => void) {
  try {
    await ctx.recordingCoordinator.startRecording(message.tabId);
    sendResponse({ success: true });
  } catch (err: any) {
    ctx.sendToSidePanel({ type: 'recording_error', message: err.message || 'Recording failed' });
    sendResponse({ success: false, error: err.message || 'Recording failed' });
  }
}

export async function handleRecordingStop(
  ctx: ServiceContext,
  _message: unknown,
  sendResponse: (response?: any) => void,
) {
  await ctx.recordingCoordinator.stopRecording();
  sendResponse({ success: true });
}

export function handleRecordingSelectImages(ctx: ServiceContext, message: any, sendResponse: (response?: any) => void) {
  ctx.recordingCoordinator.selectImages(message.selectedIds);
  sendResponse({ success: true });
}

export function handleRecordingDiscard(ctx: ServiceContext, _message: unknown, sendResponse: (response?: any) => void) {
  ctx.recordingCoordinator.discard();
  sendResponse({ success: true });
}

export function handleRecordingEvent(ctx: ServiceContext, message: any, sendResponse: (response?: any) => void) {
  ctx.recordingCoordinator.handleContentEvent(message.event);
  sendResponse({ success: true });
}
