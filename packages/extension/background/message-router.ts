import type { Message } from '../ai/message-schema.js';
import { recordContentPerfEvent } from './content-perf.js';
import type { ServiceContext } from './service-context.js';

export async function handleMessage(
  ctx: ServiceContext,
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
  applyRelayConfig: () => Promise<void>,
) {
  try {
    switch (message.type) {
      case 'relay_reconfigure': {
        await applyRelayConfig();
        sendResponse({ success: true });
        break;
      }

      case 'user_message': {
        const sessionId = message.sessionId || `session-${Date.now()}`;
        const userMessage = typeof message.message === 'string' ? message.message : '';
        sendResponse({ success: true, accepted: true, sessionId });
        void ctx.processUserMessage(
          userMessage,
          message.conversationHistory,
          message.selectedTabs || [],
          sessionId,
          undefined,
          message.recordedContext,
        );
        break;
      }

      case 'compact_context': {
        const sessionId =
          typeof message.sessionId === 'string' && message.sessionId.trim()
            ? message.sessionId.trim()
            : `session-${Date.now()}`;
        const conversationHistory = Array.isArray(message.conversationHistory)
          ? (message.conversationHistory as Message[])
          : [];
        sendResponse({ success: true, accepted: true, sessionId });
        void ctx.processContextCompaction(conversationHistory, sessionId, {
          source: typeof message.trigger === 'string' ? message.trigger : 'manual',
          force: true,
        });
        break;
      }

      case 'get_telemetry': {
        const { getTelemetrySnapshot, getCompactionMetrics } = await import('./telemetry.js');
        const sessionId = typeof message.sessionId === 'string' ? message.sessionId : undefined;
        const events = await getTelemetrySnapshot(sessionId);
        const metrics = sessionId ? await getCompactionMetrics(sessionId) : undefined;
        sendResponse({ success: true, events, metrics });
        break;
      }

      case 'clear_telemetry': {
        const { clearTelemetry } = await import('./telemetry.js');
        await clearTelemetry();
        sendResponse({ success: true });
        break;
      }

      case 'stop_run': {
        const sessionId = typeof message.sessionId === 'string' ? message.sessionId : '';
        const note = typeof message.note === 'string' && message.note.trim() ? message.note.trim() : 'Stopped';
        const stopped = sessionId ? ctx.stopRunBySession(sessionId, note) : false;
        if (!stopped) {
          ctx.stopAllSidepanelRuns(note);
        }
        sendResponse({ success: true });
        break;
      }

      case 'execute_tool': {
        const sessionId = typeof message.sessionId === 'string' ? message.sessionId : ctx.currentSessionId || 'default';
        const result = await ctx.getBrowserTools(sessionId).executeTool(message.tool, message.args);
        sendResponse({ success: true, result });
        break;
      }

      case 'execute_runtime_tool_test': {
        const sessionId =
          typeof message.sessionId === 'string' && message.sessionId.trim()
            ? message.sessionId.trim()
            : ctx.currentSessionId || 'runtime-tool-test';
        const toolName = typeof message.tool === 'string' ? message.tool.trim() : '';
        if (!toolName) {
          sendResponse({ success: false, error: 'Missing tool name.' });
          break;
        }
        const settings = await chrome.storage.local.get(null);
        const result = await ctx.executeToolByName(
          toolName,
          message.args && typeof message.args === 'object' ? message.args : {},
          {
            runMeta: {
              runId:
                typeof message.runId === 'string' && message.runId.trim()
                  ? message.runId.trim()
                  : `test-run-${Date.now()}`,
              turnId:
                typeof message.turnId === 'string' && message.turnId.trim()
                  ? message.turnId.trim()
                  : `test-turn-${Date.now()}`,
              sessionId,
            },
            settings,
          },
        );
        sendResponse({ success: true, result });
        break;
      }

      case 'subagent_instruction': {
        const sessionId = typeof message.sessionId === 'string' ? message.sessionId.trim() : '';
        const agentId = typeof message.agentId === 'string' ? message.agentId.trim() : '';
        const instruction = typeof message.instruction === 'string' ? message.instruction.trim() : '';
        if (!sessionId || !agentId || !instruction) {
          sendResponse({ success: false, error: 'Missing session, agent, or instruction.' });
          break;
        }

        const sessionState = ctx.getSessionState(sessionId);
        const agent = sessionState.runningSubagents.get(agentId);
        if (!agent || agent.status !== 'running') {
          sendResponse({ success: false, error: 'That agent is no longer running.' });
          break;
        }

        agent.pendingInstructions.push(instruction);
        ctx.sendRuntime(agent.parentRunMeta, {
          type: 'run_status',
          phase: 'executing',
          note: "Queued a new instruction for the agent's next tool step.",
          agentId,
          agentName: agent.name,
          agentKind: 'subagent',
          agentSessionId: agent.agentSessionId,
          parentSessionId: sessionId,
        });
        sendResponse({ success: true });
        break;
      }

      case 'configure_session_tabs_test': {
        const tabs = message.tabs;
        if (!Array.isArray(tabs) || tabs.length === 0) {
          sendResponse({ success: false, error: 'No tabs provided' });
          return;
        }
        const sessionId = typeof message.sessionId === 'string' ? message.sessionId : ctx.currentSessionId || 'test';
        ctx
          .getBrowserTools(sessionId)
          .configureSessionTabs(tabs, { title: 'Test Session', color: 'blue' })
          .then(() => {
            console.log('[test] session tabs configured successfully');
            sendResponse({ success: true });
          })
          .catch((err) => {
            console.error('[test] configure_session_tabs_test error:', err);
            sendResponse({ success: false, error: String(err) });
          });
        break;
      }

      case 'api_smoke_test': {
        const settings = message.settings || {};
        const prompt = typeof message.prompt === 'string' ? message.prompt : 'Reply with the word "pong" only.';
        const result = await ctx.runApiSmokeTest(settings, prompt);
        sendResponse({ success: true, result });
        break;
      }

      case 'generate_workflow': {
        const result = await ctx.generateWorkflowPrompt(message.sessionContext || '', message.maxOutputTokens);
        sendResponse({ success: true, result });
        break;
      }

      case 'ping_test': {
        sendResponse({ success: true, pong: true, time: Date.now() });
        break;
      }

      case 'recording_start': {
        try {
          await ctx.recordingCoordinator.startRecording(message.tabId);
          sendResponse({ success: true });
        } catch (err: any) {
          ctx.sendToSidePanel({ type: 'recording_error', message: err.message || 'Recording failed' });
          sendResponse({ success: false, error: err.message || 'Recording failed' });
        }
        break;
      }

      case 'recording_stop': {
        await ctx.recordingCoordinator.stopRecording();
        sendResponse({ success: true });
        break;
      }

      case 'recording_select_images': {
        await ctx.recordingCoordinator.selectImages(message.selectedIds);
        sendResponse({ success: true });
        break;
      }

      case 'recording_discard': {
        ctx.recordingCoordinator.discard();
        sendResponse({ success: true });
        break;
      }

      case 'recording_event': {
        ctx.recordingCoordinator.handleContentEvent(message.event);
        sendResponse({ success: true });
        break;
      }

      case 'content_perf_event': {
        void recordContentPerfEvent(message.event, sender);
        sendResponse({ success: true });
        break;
      }

      case 'content_script_ready': {
        if (typeof sender.tab?.id === 'number') {
          ctx.syncSubagentTabBadge(sender.tab.id);
        }
        sendResponse({ success: true });
        break;
      }

      case 'reset_all_profiles': {
        await chrome.storage.local.set({
          configs: {},
          providers: {},
          activeConfig: 'default',
          provider: '',
          apiKey: '',
          model: '',
          customEndpoint: '',
          extraHeaders: {},
          providerId: '',
          modelId: '',
        });
        sendResponse({ success: true });
        break;
      }

      default:
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
