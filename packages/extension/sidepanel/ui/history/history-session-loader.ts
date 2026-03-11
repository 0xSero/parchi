import { createMessage, normalizeConversationHistory } from '../../../ai/message-schema.js';
import type { Message } from '../../../ai/message-schema.js';
import { clampContextHistory, clearReportImages, clearToolCallViews } from '../core/panel-session-memory.js';
import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

const normalizeTranscript = (value: any): any[] => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.values(value).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') return Object.values(parsed).filter(Boolean);
      return [];
    } catch {
      return [];
    }
  }
  return [];
};

sidePanelProto.loadSession = function loadSession(session: any) {
  this.switchView('chat');
  this.recordScrollPosition();

  const transcript = normalizeTranscript(session.transcript);
  const contextTranscriptRaw = normalizeTranscript(session.contextTranscript);
  const normalizedContextTranscript = normalizeConversationHistory(contextTranscriptRaw as unknown as Message[]);
  const normalizedTranscript = normalizeConversationHistory(transcript as unknown as Message[]);
  let turns = normalizeTranscript(session.turns);
  if (turns.length > 0 && transcript.length > 0) {
    const userQueue = normalizedTranscript.filter((msg) => msg.role === 'user');
    const assistantQueue = normalizedTranscript.filter((msg) => msg.role === 'assistant');
    const takeUser = () => userQueue.shift();
    const takeAssistant = () => assistantQueue.shift();

    turns = turns.map((turn: any) => {
      const updated = { ...turn };
      if (!updated.userMessage) {
        const userMessage = takeUser();
        if (userMessage) {
          updated.userMessage =
            typeof userMessage.content === 'string' ? userMessage.content : this.safeJsonStringify(userMessage.content);
        }
      }
      if (!updated.assistantFinal?.content) {
        const assistantMessage = takeAssistant();
        if (assistantMessage) {
          updated.assistantFinal = {
            content:
              typeof assistantMessage.content === 'string'
                ? assistantMessage.content
                : this.safeJsonStringify(assistantMessage.content),
            thinking: assistantMessage.thinking || null,
          };
        }
      }
      return updated;
    });
  }
  if (turns.length > 0) {
    this.isReplayingHistory = true;
    try {
      this.displayHistory = [];
      this.contextHistory = [];
      const suffix = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now());
      this.sessionId = session.id || `session-${suffix}`;
      this.firstUserMessage = session.title || '';
      this.elements.chatMessages.innerHTML = '';
      clearToolCallViews(this.toolCallViews);
      clearReportImages(this.reportImages, this.reportImageOrder, this.selectedReportImageIds);
      this.resetActivityPanel();

      turns.forEach((turn: any) => {
        const userText = String(turn.userMessage || '').trim();
        if (userText) {
          this.displayUserMessage(userText);
          const entry = createMessage({ role: 'user', content: userText });
          if (entry) {
            this.displayHistory.push(entry);
          }
        }

        if (turn.plan) {
          this.applyPlanUpdate(turn.plan);
        }

        const toolEvents = Array.isArray(turn.toolEvents) ? turn.toolEvents : [];
        toolEvents.forEach((evt) => {
          if (evt && typeof evt === 'object' && evt.type === 'tool_execution_start') {
            this.handleRuntimeMessage({
              schemaVersion: 2,
              runId: 'replay',
              sessionId: this.sessionId,
              turnId: turn.id || 'replay',
              timestamp: Number((evt as any).timestamp || Date.now()),
              type: 'tool_execution_start',
              tool: (evt as any).tool,
              id: (evt as any).id,
              args: (evt as any).args || {},
              stepIndex: (evt as any).stepIndex,
              stepTitle: (evt as any).stepTitle,
            });
          }
          if (evt && typeof evt === 'object' && evt.type === 'tool_execution_result') {
            this.handleRuntimeMessage({
              schemaVersion: 2,
              runId: 'replay',
              sessionId: this.sessionId,
              turnId: turn.id || 'replay',
              timestamp: Number((evt as any).timestamp || Date.now()),
              type: 'tool_execution_result',
              tool: (evt as any).tool,
              id: (evt as any).id,
              args: (evt as any).args || {},
              result: (evt as any).result,
              stepIndex: (evt as any).stepIndex,
              stepTitle: (evt as any).stepTitle,
            });
          }
        });

        if (turn.assistantFinal?.content) {
          this.displayAssistantMessage(
            String(turn.assistantFinal.content || ''),
            (turn.assistantFinal.thinking as any) || null,
            (turn.assistantFinal.usage as any) || null,
            (turn.assistantFinal.model as any) || null,
          );
        }
      });

      if (normalizedContextTranscript.length > 0) {
        this.contextHistory = normalizedContextTranscript;
      } else {
        this.contextHistory = normalizedTranscript;
      }
      clampContextHistory(this.contextHistory);
      this.updateContextUsage();
      this.updateChatEmptyState();
      this.scrollToBottom({ force: true });
    } finally {
      this.isReplayingHistory = false;
    }
    return;
  }

  if (transcript.length > 0) {
    this.displayHistory = normalizedTranscript;
    this.contextHistory = normalizedContextTranscript.length > 0 ? normalizedContextTranscript : normalizedTranscript;
    clampContextHistory(this.contextHistory);
    const suffix = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now());
    this.sessionId = session.id || `session-${suffix}`;
    this.firstUserMessage = session.title || '';
    this.renderConversationHistory();
    this.updateContextUsage();
  }
};
