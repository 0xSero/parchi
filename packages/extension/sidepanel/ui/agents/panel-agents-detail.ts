import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

/* ============================================================================
   Mission Control — Detail View, Messaging & Inline Activity
   Split from panel-agents.ts for file-size compliance.
   ============================================================================ */

/**
 * Format elapsed time for an agent.
 */
sidePanelProto.mcFormatElapsed = function mcFormatElapsed(agent: {
  startedAt?: number;
  completedAt?: number;
  status: string;
}): string {
  if (!agent.startedAt) return '';
  const end = agent.completedAt || Date.now();
  const secs = Math.floor((end - agent.startedAt) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
};

/**
 * Select an agent and show its detail view.
 */
sidePanelProto.mcSelectAgent = function mcSelectAgent(agentId: string) {
  this.mcSelectedAgentId = agentId;
  this.activeAgent = agentId;
  this.mcRenderAgentList();
  this.mcRenderDetail(agentId);
  this.mcShowDetail();
  this.renderAgentNav?.();
  this.syncAgentTranscriptVisibility?.();
  this.syncAgentComposerState?.();
};

/**
 * Show the detail view, hide list.
 */
sidePanelProto.mcShowDetail = function mcShowDetail() {
  if (this.elements.mcAgentList) this.elements.mcAgentList.style.display = 'none';
  if (this.elements.mcDetail) this.elements.mcDetail.classList.add('visible');
};

/**
 * Show the list view, hide detail.
 */
sidePanelProto.mcShowList = function mcShowList() {
  if (this.elements.mcAgentList) this.elements.mcAgentList.style.display = '';
  if (this.elements.mcDetail) this.elements.mcDetail.classList.remove('visible');
  this.mcSelectedAgentId = null;
  this.mcRenderAgentList();
};

/**
 * Render the detail view for a specific agent.
 */
sidePanelProto.mcRenderDetail = function mcRenderDetail(agentId: string) {
  const agent = this.subagents.get(agentId);
  if (!agent) return;

  if (this.elements.mcDetailName) this.elements.mcDetailName.textContent = agent.name;
  if (this.elements.mcDetailStatusPill) {
    this.elements.mcDetailStatusPill.className = `mc-detail-status-pill ${agent.status}`;
    this.elements.mcDetailStatusPill.textContent =
      agent.status === 'running' ? 'Running' : agent.status === 'completed' ? 'Completed' : 'Failed';
  }

  const body = this.elements.mcDetailBody;
  if (!body) return;

  let html = '';

  // Tasks section
  if (agent.tasks && agent.tasks.length > 0) {
    html += `<div class="mc-detail-section"><div class="mc-detail-section-title">Tasks</div><ul class="mc-task-list">${agent.tasks
      .map(
        (t: string, i: number) =>
          `<li class="mc-task-item ${i === 0 && agent.status === 'running' ? 'active' : ''}"><span class="mc-task-text">${this.escapeHtml(t)}</span></li>`,
      )
      .join('')}</ul></div>`;
  }

  // Timing section
  const elapsed = this.mcFormatElapsed(agent);
  const startTime = agent.startedAt ? new Date(agent.startedAt).toLocaleTimeString() : '-';
  const endTime = agent.completedAt ? new Date(agent.completedAt).toLocaleTimeString() : '-';
  html += `<div class="mc-detail-section"><div class="mc-detail-section-title">Timing</div>
    <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:12px;">
      <span style="color:var(--muted-dim)">Started</span><span style="color:var(--foreground);font-variant-numeric:tabular-nums">${startTime}</span>
      <span style="color:var(--muted-dim)">Elapsed</span><span style="color:var(--foreground);font-variant-numeric:tabular-nums">${elapsed}</span>
      ${agent.completedAt ? `<span style="color:var(--muted-dim)">Finished</span><span style="color:var(--foreground);font-variant-numeric:tabular-nums">${endTime}</span>` : ''}
    </div></div>`;

  // Activity feed — collapse tool messages into counts
  if (agent.messages && agent.messages.length > 0) {
    const collapsed: Array<{ ts: number; text: string }> = [];
    let toolRun = 0;
    let toolRunTs = 0;
    const flushTools = () => {
      if (toolRun > 0) {
        collapsed.push({ ts: toolRunTs, text: `${toolRun} tool call${toolRun !== 1 ? 's' : ''}` });
        toolRun = 0;
      }
    };
    for (const m of agent.messages as Array<{ ts: number; text: string }>) {
      if (m.text.startsWith('Tool: ') || m.text.startsWith('Tool started:') || m.text.startsWith('Tool completed:')) {
        if (toolRun === 0) toolRunTs = m.ts;
        toolRun++;
      } else {
        flushTools();
        collapsed.push(m);
      }
    }
    flushTools();

    html += `<div class="mc-detail-section"><div class="mc-detail-section-title">Activity</div><div class="mc-activity-feed">${collapsed
      .map(
        (m) =>
          `<div class="mc-activity-item"><span class="mc-activity-ts">${new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><span class="mc-activity-text">${this.escapeHtml(m.text)}</span></div>`,
      )
      .join('')}</div></div>`;
  }

  // Summary section
  if (agent.summary) {
    html += `<div class="mc-detail-section"><div class="mc-detail-section-title">Summary</div><div class="mc-summary-block">${this.renderMarkdown(agent.summary)}</div></div>`;
  }

  body.innerHTML = html;

  if (this.elements.mcMessageInput) {
    this.elements.mcMessageInput.disabled = agent.status !== 'running';
    this.elements.mcMessageInput.placeholder =
      agent.status === 'running' ? 'Queue instruction for next tool step...' : 'Agent is no longer active';
  }
};

/**
 * Send a message/instruction to the selected subagent.
 */
sidePanelProto.mcSendMessage = async function mcSendMessage() {
  const input = this.elements.mcMessageInput;
  if (!input) return;
  const text = (input.value || '').trim();
  if (!text || !this.mcSelectedAgentId) return;

  const agentId = this.mcSelectedAgentId;
  const agent = this.subagents.get(agentId);
  if (!agent || agent.status !== 'running') return;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'subagent_instruction',
      sessionId: this.sessionId,
      agentId,
      instruction: text,
    });
    if (!response?.success) {
      throw new Error(response?.error || 'Failed to queue instruction.');
    }

    if (!Array.isArray(agent.messages)) agent.messages = [];
    agent.messages.push({ ts: Date.now(), text: `[You] ${text}` });
    input.value = '';
    if (this.elements.mcMessageSend) this.elements.mcMessageSend.disabled = true;
    this.mcRenderDetail(agentId);
  } catch (error) {
    if (this.elements.mcMessageSend) {
      this.elements.mcMessageSend.disabled = false;
    }
    this.updateStatus(
      error instanceof Error && error.message ? error.message : 'Failed to queue instruction.',
      'error',
    );
  }
};

/**
 * Render subagent activity inline in the chat as a thread card with horizontal content previews.
 */
sidePanelProto.renderSubagentActivity = function renderSubagentActivity(
  subagentId: string,
  event: 'start' | 'progress' | 'complete' | 'error',
  data?: { name?: string; tasks?: string[]; summary?: string; error?: string },
) {
  const agent = this.subagents.get(subagentId);
  if (!agent || !this.streamingState?.eventsEl) return;

  // Reveal streaming container if hidden
  if (this.streamingState.container?.style.display === 'none') {
    this.streamingState.container.style.display = '';
  }

  let thread = this.streamingState.eventsEl.querySelector(
    `.subagent-thread[data-subagent-id="${subagentId}"]`,
  ) as HTMLElement | null;

  if (!thread) {
    thread = document.createElement('div');
    thread.className = 'subagent-thread running';
    thread.dataset.subagentId = subagentId;
    thread.innerHTML = `
      <div class="subagent-thread-header">
        <span class="subagent-thread-dot"></span>
        <span class="subagent-thread-name"></span>
        <span class="subagent-thread-status"></span>
      </div>
      <div class="subagent-thread-previews"></div>
    `;
    thread.addEventListener('click', () => {
      this.openMissionControl();
      this.mcSelectAgent(subagentId);
    });
    this.streamingState.eventsEl.appendChild(thread);
  }

  // Update status class
  const statusClass =
    event === 'start' ? 'running' : event === 'complete' ? 'completed' : event === 'error' ? 'error' : 'running';
  thread.className = `subagent-thread ${statusClass}`;

  // Update header
  const nameEl = thread.querySelector('.subagent-thread-name') as HTMLElement | null;
  if (nameEl) nameEl.textContent = agent.name;

  const statusEl = thread.querySelector('.subagent-thread-status') as HTMLElement | null;
  if (statusEl) {
    statusEl.textContent =
      event === 'start' ? 'running' : event === 'complete' ? 'done' : event === 'error' ? 'failed' : event;
  }

  // Update horizontal preview chips
  const previews = thread.querySelector('.subagent-thread-previews') as HTMLElement | null;
  if (previews) {
    this._updateThreadPreviews(subagentId, previews, event, data);
  }

  if (!Array.isArray(agent.messages)) agent.messages = [];
  if (event === 'start') {
    agent.messages.push({ ts: Date.now(), text: 'Agent spawned' });
    if (agent.tasks) agent.messages.push({ ts: Date.now(), text: `Tasks: ${agent.tasks.join(', ')}` });
  } else if (event === 'complete') {
    agent.messages.push({ ts: Date.now(), text: 'Completed' });
    if (data?.summary) agent.messages.push({ ts: Date.now(), text: data.summary });
  } else if (event === 'error') {
    agent.messages.push({ ts: Date.now(), text: `Error: ${data?.error || 'Unknown error'}` });
  }

  this.scrollToBottom();
};

/**
 * Build/update the horizontal preview chips for a thread card.
 */
sidePanelProto._updateThreadPreviews = function _updateThreadPreviews(
  subagentId: string,
  container: HTMLElement,
  event: string,
  data?: { name?: string; tasks?: string[]; summary?: string; error?: string },
) {
  const agent = this.subagents.get(subagentId);
  if (!agent) return;

  // On start — show task chips
  if (event === 'start' && Array.isArray(agent.tasks)) {
    for (const task of agent.tasks) {
      const chip = document.createElement('span');
      chip.className = 'thread-preview-chip chip-task';
      chip.textContent = task;
      chip.title = task;
      container.appendChild(chip);
    }
  }

  // On complete — add summary chip
  if (event === 'complete' && data?.summary) {
    const chip = document.createElement('span');
    chip.className = 'thread-preview-chip chip-summary';
    chip.textContent = data.summary.length > 120 ? data.summary.slice(0, 117) + '...' : data.summary;
    chip.title = data.summary;
    container.appendChild(chip);
    // Scroll to the end
    container.scrollLeft = container.scrollWidth;
  }

  // On error — add error chip
  if (event === 'error') {
    const chip = document.createElement('span');
    chip.className = 'thread-preview-chip chip-error';
    chip.textContent = data?.error || 'Failed';
    container.appendChild(chip);
    container.scrollLeft = container.scrollWidth;
  }
};

/**
 * Add a tool chip to the thread preview for a running subagent.
 */
sidePanelProto._addToolChipToThread = function _addToolChipToThread(subagentId: string, toolName: string) {
  const thread = this.streamingState?.eventsEl?.querySelector(
    `.subagent-thread[data-subagent-id="${subagentId}"]`,
  ) as HTMLElement | null;
  if (!thread) return;
  const previews = thread.querySelector('.subagent-thread-previews') as HTMLElement | null;
  if (!previews) return;

  const chip = document.createElement('span');
  chip.className = 'thread-preview-chip chip-tool';
  chip.textContent = toolName;
  previews.appendChild(chip);
  previews.scrollLeft = previews.scrollWidth;
};

/**
 * Highlight messages from a specific subagent in the chat.
 */
sidePanelProto.highlightSubagentMessages = function highlightSubagentMessages(subagentId: string) {
  this.elements.chatMessages?.querySelectorAll('.subagent-highlight').forEach((el: Element) => {
    el.classList.remove('subagent-highlight');
  });
  this.elements.chatMessages
    ?.querySelectorAll(`.subagent-thread[data-subagent-id="${subagentId}"]`)
    .forEach((el: Element) => el.classList.add('subagent-highlight'));
  const first = this.elements.chatMessages?.querySelector(`.subagent-thread[data-subagent-id="${subagentId}"]`);
  if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

/**
 * Get a summary of all subagent activity.
 */
sidePanelProto.getSubagentSummary = function getSubagentSummary(): string {
  if (!this.subagents || this.subagents.size === 0) return '';
  const parts: string[] = [];
  this.subagents.forEach((agent: { name: string; status: string }) => {
    parts.push(`${agent.name} (${agent.status})`);
  });
  return parts.join(', ');
};
