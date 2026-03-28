import { getSubagentColorStyle } from '../../../subagent-colors.js';
import { SidePanelUI } from '../core/panel-ui.js';
import type { SubagentEntry } from '../types/panel-types.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

/* ============================================================================
   Mission Control — Subagent Setup, Lifecycle & List View
   Detail view, messaging, and inline activity are in panel-agents-detail.ts.
   ============================================================================ */

/** Initialize Mission Control event listeners. */
sidePanelProto.setupMissionControl = function setupMissionControl() {
  this.elements.missionControlFab?.addEventListener('click', () => this.toggleMissionControl());
  this.elements.missionControlScrim?.addEventListener('click', () => this.closeMissionControl());
  this.elements.mcCloseBtn?.addEventListener('click', () => this.closeMissionControl());
  this.elements.mcDetailBack?.addEventListener('click', () => this.mcShowList());
  this.elements.mcMessageInput?.addEventListener('input', () => {
    const val = (this.elements.mcMessageInput?.value || '').trim();
    if (this.elements.mcMessageSend) this.elements.mcMessageSend.disabled = !val;
  });
  this.elements.mcMessageInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.mcSendMessage();
    }
  });
  this.elements.mcMessageSend?.addEventListener('click', () => this.mcSendMessage());
  this.setupTabAgentSwitching?.();
};

/** Add a new subagent to the tracking map and update Mission Control. */
sidePanelProto.addSubagent = function addSubagent(
  id: string,
  name: string,
  tasks: unknown,
  options: { sessionId?: string; parentSessionId?: string; tabId?: number; colorIndex?: number } = {},
) {
  const existing = this.subagents.get(id);
  this.subagents.set(id, {
    name: name || existing?.name || `Sub-Agent ${this.subagents.size + 1}`,
    sessionId: options.sessionId || existing?.sessionId || `${this.sessionId}::${id}`,
    parentSessionId: options.parentSessionId || existing?.parentSessionId || this.sessionId,
    tasks: Array.isArray(tasks) ? tasks : [tasks || 'Task'],
    status: 'running',
    messages: existing?.messages || [],
    pendingText: existing?.pendingText || '',
    pendingReasoning: existing?.pendingReasoning || '',
    startedAt: existing?.startedAt || Date.now(),
    completedAt: undefined,
    summary: undefined,
    tabId: options.tabId ?? existing?.tabId,
    colorIndex: options.colorIndex ?? existing?.colorIndex,
  });
  this.mcUpdateFab();
  this.mcRenderAgentList();
  this.renderAgentNav?.();
  this.syncAgentComposerState?.();
  this.renderSubagentActivity(id, 'start', { name, tasks });
  // Don't auto-open mission control — let user open it manually
};

/** Update the status of a subagent. */
sidePanelProto.updateSubagentStatus = function updateSubagentStatus(id: string, status: string, summary?: string) {
  const agent = this.subagents.get(id);
  if (!agent) return;
  agent.status = status;
  if (status === 'completed' || status === 'error') {
    agent.completedAt = Date.now();
    agent.summary = summary || undefined;
  }
  this.mcUpdateFab();
  this.mcRenderAgentList();
  this.renderAgentNav?.();
  this.syncAgentComposerState?.();
  this.renderSubagentActivity(id, status === 'completed' ? 'complete' : status, { summary });
  if (this.mcSelectedAgentId === id) this.mcRenderDetail(id);
};

/** Toggle Mission Control panel. */
sidePanelProto.toggleMissionControl = function toggleMissionControl() {
  if (this.missionControlOpen) this.closeMissionControl();
  else this.openMissionControl();
};

/** Open Mission Control panel. */
sidePanelProto.openMissionControl = function openMissionControl() {
  this.missionControlOpen = true;
  this.elements.missionControlPanel?.classList.add('open');
  this.elements.missionControlScrim?.classList.add('open');
  this.mcRenderAgentList();
};

/** Close Mission Control panel. */
sidePanelProto.closeMissionControl = function closeMissionControl() {
  this.missionControlOpen = false;
  this.elements.missionControlPanel?.classList.remove('open');
  this.elements.missionControlScrim?.classList.remove('open');
  this.mcSelectedAgentId = null;
  this.mcShowList();
};

/** Update the FAB badge and visibility. */
sidePanelProto.mcUpdateFab = function mcUpdateFab() {
  const fab = this.elements.missionControlFab;
  if (!fab) return;
  const count = this.subagents.size;
  const runningCount = Array.from(this.subagents.values()).filter(
    (a: { status: string }) => a.status === 'running',
  ).length;
  if (count > 0) {
    fab.classList.add('visible');
    fab.classList.toggle('has-running', runningCount > 0);
  } else {
    fab.classList.remove('visible', 'has-running');
  }
  const badge = this.elements.mcFabBadge;
  if (badge) {
    badge.textContent = runningCount > 0 ? String(runningCount) : '';
    badge.style.display = runningCount > 0 ? 'flex' : 'none';
  }
};

/** Render the agent list view inside Mission Control. */
sidePanelProto.mcRenderAgentList = function mcRenderAgentList() {
  const container = this.elements.mcAgentList;
  if (!container) return;
  if (this.elements.mcHeaderMeta) {
    const running = Array.from(this.subagents.values()).filter(
      (a: { status: string }) => a.status === 'running',
    ).length;
    const total = this.subagents.size;
    this.elements.mcHeaderMeta.textContent = running > 0 ? `${running} active / ${total} total` : `${total} agents`;
  }
  if (this.subagents.size === 0) {
    container.innerHTML = `<div class="mc-empty">
      <div class="mc-empty-title">No active agents</div>
      <div class="mc-empty-desc">Sub-agents will appear here when spawned.</div>
    </div>`;
    return;
  }
  let html = '';
  this.subagents.forEach((agent: SubagentEntry, id: string) => {
    const elapsed = this.mcFormatElapsed(agent);
    const isSelected = this.mcSelectedAgentId === id;
    const statusLabel = agent.status === 'running' ? 'Running' : agent.status === 'completed' ? 'Done' : 'Failed';
    const taskCount = Array.isArray(agent.tasks) ? agent.tasks.length : 0;
    const taskMeta = taskCount > 0 ? `${taskCount} task${taskCount !== 1 ? 's' : ''}` : '';
    html += `<div class="mc-agent-card ${agent.status} ${isSelected ? 'selected' : ''}" data-agent-id="${id}" style="${getSubagentColorStyle(agent.colorIndex ?? 0)}">
      <div class="mc-agent-body"><div class="mc-agent-name">${this.escapeHtml(agent.name)}</div><div class="mc-agent-meta"><span class="mc-agent-status-label">${statusLabel}</span>${taskMeta ? `<span class="mc-agent-meta-sep"></span><span>${taskMeta}</span>` : ''}${elapsed ? `<span class="mc-agent-meta-sep"></span><span>${elapsed}</span>` : ''}</div></div>
    </div>`;
  });
  container.innerHTML = html;
  container.querySelectorAll('.mc-agent-card').forEach((card: Element) => {
    card.addEventListener('click', () => {
      const agentId = (card as HTMLElement).dataset.agentId;
      if (agentId) this.mcSelectAgent(agentId);
    });
  });
};
