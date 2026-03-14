import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;
const escape = (self: SidePanelUI, value: string) => self.escapeHtml(String(value || ''));

sidePanelProto.closeSubagentSession = async function closeSubagentSession(agentId: string) {
  const agent = this.subagents.get(agentId);
  if (!agent) return;

  if (!this.dismissedSubagentIds) this.dismissedSubagentIds = new Set<string>();
  this.dismissedSubagentIds.add(agentId);

  if (typeof agent.tabId === 'number') {
    this.tabToAgentId.delete(agent.tabId);
    try {
      await chrome.tabs.remove(agent.tabId);
    } catch {
      // Ignore missing or already-closed tab failures.
    }
  } else {
    for (const [tabId, mappedAgentId] of this.tabToAgentId.entries()) {
      if (mappedAgentId === agentId) this.tabToAgentId.delete(tabId);
    }
  }

  this.subagents.delete(agentId);
  const chatMessages = this.elements.chatMessages as HTMLElement | null;
  chatMessages?.querySelectorAll(`[data-agent-view="${CSS.escape(agentId)}"]`).forEach((node) => node.remove());
  if (this.mcSelectedAgentId === agentId) this.mcSelectedAgentId = null;
  if (this.activeAgent === agentId) this.activeAgent = 'main';
  this.mcRenderAgentList?.();
  this.renderAgentNav?.();
  this.syncAgentTranscriptVisibility?.();
  this.syncAgentComposerState?.();
};

sidePanelProto.handleSubagentRuntimeMessage = function handleSubagentRuntimeMessage(message: any) {
  const agentId =
    typeof message.agentId === 'string' ? message.agentId : typeof message.id === 'string' ? message.id : '';
  if (!agentId) return false;
  if (this.dismissedSubagentIds?.has?.(agentId)) return true;

  if (message.type === 'subagent_tab_assigned') {
    const tabId = typeof message.tabId === 'number' ? message.tabId : undefined;
    const colorIndex = typeof message.colorIndex === 'number' ? message.colorIndex : undefined;
    const agent = this.subagents.get(agentId);
    if (!agent) {
      this.subagents.set(agentId, {
        name: message.name || `Agent ${this.subagents.size + 1}`,
        status: 'pending',
        sessionId: message.agentSessionId || `${this.sessionId}::${agentId}`,
        parentSessionId: this.sessionId,
        messages: [],
        pendingText: '',
        pendingReasoning: '',
        tabId,
        colorIndex,
      });
    } else {
      if (tabId !== undefined) agent.tabId = tabId;
      if (colorIndex !== undefined) agent.colorIndex = colorIndex;
    }
    if (tabId !== undefined) this.tabToAgentId.set(tabId, agentId);
    return true;
  }

  if (message.type === 'subagent_start') {
    const stub = this.subagents.get(message.id);
    this.addSubagent(message.id, message.name, message.tasks, {
      sessionId: typeof message.agentSessionId === 'string' ? message.agentSessionId : undefined,
      parentSessionId: typeof message.parentSessionId === 'string' ? message.parentSessionId : this.sessionId,
      tabId: stub?.tabId,
      colorIndex: stub?.colorIndex,
    });
    this.appendSubagentSessionMessage(
      message.id,
      'Session started',
      Array.isArray(message.tasks) && message.tasks.length > 0
        ? message.tasks.map((task: string, index: number) => `${index + 1}. ${task}`).join('\n')
        : 'Waiting for work items.',
    );
    return true;
  }

  const agent = this.subagents.get(agentId);
  if (!agent) return false;

  if (message.type === 'assistant_stream_start') {
    agent.pendingText = '';
    agent.pendingReasoning = '';
    return true;
  }

  if (message.type === 'assistant_stream_delta') {
    const content = String(message.content || '');
    if (message.channel === 'reasoning') agent.pendingReasoning = `${agent.pendingReasoning}${content}`;
    else agent.pendingText = `${agent.pendingText}${content}`;
    return true;
  }

  if (message.type === 'assistant_stream_stop') return true;

  if (message.type === 'assistant_final') {
    this.flushSubagentStream(agentId, String(message.content || ''));
    if (message.content) agent.messages.push({ ts: Date.now(), text: String(message.content || '') });
    return true;
  }

  if (message.type === 'tool_execution_start') {
    const args = message.args && typeof message.args === 'object' ? JSON.stringify(message.args) : '';
    const detail = args && args !== '{}' ? `\n\n\`${escape(this, args)}\`` : '';
    this.appendSubagentSessionMessage(agentId, `Tool · ${String(message.tool || 'tool')}`, `Running${detail}`);
    agent.messages.push({ ts: Date.now(), text: `Tool started: ${String(message.tool || 'tool')}` });
    return true;
  }

  if (message.type === 'tool_execution_result') {
    const resultText =
      message.result && typeof message.result === 'object'
        ? `\n\n\`${escape(this, JSON.stringify(message.result))}\``
        : message.result
          ? `\n\n${escape(this, String(message.result))}`
          : '';
    this.appendSubagentSessionMessage(
      agentId,
      `Tool result · ${String(message.tool || 'tool')}`,
      `Completed${resultText}`,
    );
    agent.messages.push({ ts: Date.now(), text: `Tool completed: ${String(message.tool || 'tool')}` });
    return true;
  }

  if (message.type === 'run_status' && typeof message.note === 'string' && message.note.trim()) {
    const phase = String(message.phase || '');
    if (phase === 'completed') this.updateSubagentStatus(agentId, 'completed', message.note);
    else if (phase === 'failed' || phase === 'stopped') this.updateSubagentStatus(agentId, 'error', message.note);
    this.appendSubagentSessionMessage(
      agentId,
      'Status',
      message.note,
      phase === 'completed' ? 'success' : phase === 'failed' || phase === 'stopped' ? 'error' : 'neutral',
    );
    agent.messages.push({ ts: Date.now(), text: message.note });
    return true;
  }

  if (message.type === 'subagent_complete') {
    this.flushSubagentStream(agentId, String(message.summary || ''));
    this.updateSubagentStatus(agentId, message.success ? 'completed' : 'error', String(message.summary || ''));
    if (message.summary) {
      this.appendSubagentSessionMessage(
        agentId,
        message.success ? 'Session complete' : 'Session failed',
        String(message.summary || ''),
        message.success ? 'success' : 'error',
      );
    }
    return true;
  }

  return false;
};
