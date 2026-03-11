import { handleCompactContext, handleRelayReconfigure, handleUserMessage } from './message-handlers-core.js';
import {
  handleRecordingDiscard,
  handleRecordingEvent,
  handleRecordingSelectImages,
  handleRecordingStart,
  handleRecordingStop,
} from './message-handlers-recording.js';
import { handleStopRun } from './message-handlers-run.js';
import {
  handleContentPerfEvent,
  handleContentScriptReady,
  handleGenerateWorkflow,
  handleResetAllProfiles,
} from './message-handlers-system.js';
import { handleClearTelemetry, handleGetTelemetry } from './message-handlers-telemetry.js';
import { handleApiSmokeTest, handleConfigureSessionTabsTest, handlePingTest } from './message-handlers-test.js';
import {
  handleExecuteRuntimeToolTest,
  handleExecuteTool,
  handleSubagentInstruction,
} from './message-handlers-tools.js';
import type { ServiceContext } from './service-context.js';

const HANDLERS: Record<
  string,
  (ctx: ServiceContext, message: any, sendResponse: (response?: any) => void, ...args: any[]) => void | Promise<void>
> = {
  relay_reconfigure: handleRelayReconfigure,
  user_message: handleUserMessage,
  compact_context: handleCompactContext,
  get_telemetry: handleGetTelemetry,
  clear_telemetry: handleClearTelemetry,
  stop_run: handleStopRun,
  execute_tool: handleExecuteTool,
  execute_runtime_tool_test: handleExecuteRuntimeToolTest,
  subagent_instruction: handleSubagentInstruction,
  configure_session_tabs_test: handleConfigureSessionTabsTest,
  api_smoke_test: handleApiSmokeTest,
  generate_workflow: handleGenerateWorkflow,
  ping_test: handlePingTest,
  recording_start: handleRecordingStart,
  recording_stop: handleRecordingStop,
  recording_select_images: handleRecordingSelectImages,
  recording_discard: handleRecordingDiscard,
  recording_event: handleRecordingEvent,
  content_perf_event: handleContentPerfEvent,
  content_script_ready: handleContentScriptReady,
  reset_all_profiles: handleResetAllProfiles,
};

export async function handleMessage(
  ctx: ServiceContext,
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
  applyRelayConfig: () => Promise<void>,
) {
  try {
    const handler = HANDLERS[message.type];
    if (handler) {
      // Relay reconfigure needs special handling for applyRelayConfig
      if (message.type === 'relay_reconfigure') {
        await handleRelayReconfigure(ctx, message, sendResponse, applyRelayConfig);
      } else if (message.type === 'content_perf_event' || message.type === 'content_script_ready') {
        // These handlers need the sender
        await handler(ctx, message, sendResponse, sender);
      } else {
        await handler(ctx, message, sendResponse);
      }
    } else {
      console.warn('Unknown message type:', message.type);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    ctx.sendToSidePanel({
      type: 'error',
      message: (error as any).message,
    });
    sendResponse({ success: false, error: (error as any).message });
  }
}
