import { getSubagentColorStyle } from '../../../subagent-colors.js';
import { SidePanelUI } from '../core/panel-ui.js';

const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

const MAIN_AGENT_ID = 'main';
const MAIN_PLACEHOLDER = 'Message...';
const SUBAGENT_PLACEHOLDER = 'Viewing a sub-agent session. Use Mission Control to message that agent.';

const escape = (self: SidePanelUI, value: string) => self.escapeHtml(String(value || ''));

/**
 * Listen for Chrome tab activation. When a user clicks a tab owned by a
 * subagent, auto-switch the sidepanel to that agent's conversation.
 */
sidePanelProto.setupTabAgentSwitching = function setupTabAgentSwitching() {
  if (typeof chrome === 'undefined' || !chrome.tabs?.onActivated) return;
  chrome.tabs.onActivated.addListener((activeInfo: chrome.tabs.TabActiveInfo) => {
    const agentId = this.tabToAgentId.get(activeInfo.tabId);
    if (agentId && this.subagents.has(agentId)) {
      if (this.activeAgent !== agentId) this.switchAgent(agentId);
    } else if (this.activeAgent !== MAIN_AGENT_ID && this.subagents.size > 0) {
      // Clicked a non-agent tab — switch back to orchestrator view
      this.switchAgent(MAIN_AGENT_ID);
    }
  });
};

sidePanelProto.tagAgentView = function tagAgentView(element: HTMLElement, agentId = MAIN_AGENT_ID) {
  element.dataset.agentView = agentId;
  element.classList.toggle('hidden', this.activeAgent !== agentId);
  return element;
};

sidePanelProto.syncAgentTranscriptVisibility = function syncAgentTranscriptVisibility() {
  const activeAgent = this.activeAgent || MAIN_AGENT_ID;
  const container = this.elements.chatMessages as HTMLElement | null;
  const hasChatChildren = container ? container.children.length > 0 : false;
  if (container) {
    Array.from(container.children).forEach((child) => {
      const el = child as HTMLElement;
      const owner = el.dataset.agentView || MAIN_AGENT_ID;
      el.classList.toggle('hidden', owner !== activeAgent);
    });
  }
  this.elements.chatEmptyState?.classList.toggle('hidden', activeAgent !== MAIN_AGENT_ID || hasChatChildren);
  this.elements.planDrawer?.classList.toggle('hidden', activeAgent !== MAIN_AGENT_ID || !this.currentPlan);
};

sidePanelProto.syncAgentComposerState = function syncAgentComposerState() {
  const isMain = (this.activeAgent || MAIN_AGENT_ID) === MAIN_AGENT_ID;
  if (this.elements.userInput) {
    this.elements.userInput.disabled = !isMain;
    this.elements.userInput.placeholder = isMain ? MAIN_PLACEHOLDER : SUBAGENT_PLACEHOLDER;
  }
  if (this.elements.sendBtn) {
    this.elements.sendBtn.disabled = !isMain && !this.elements.composer?.classList.contains('running');
  }
  this.elements.composer?.classList.toggle('agent-session-readonly', !isMain);
};

sidePanelProto.renderAgentNav = function renderAgentNav() {
  const nav = this.elements.agentNav as HTMLElement | null;
  if (!nav) return;
  if (this.subagents.size === 0) {
    this.hideAgentNav();
    return;
  }
  const active = this.activeAgent || MAIN_AGENT_ID;
  const running = Array.from(this.subagents.values()).filter((a: any) => a.status === 'running').length;
  const total = this.subagents.size;
  const meta = running > 0 ? `${running} active` : `${total}`;
  const orchActive = active === MAIN_AGENT_ID ? ' active' : '';
  const orchTab = `<button type="button" class="agent-tab agent-tab--orch${orchActive}" data-agent-id="${MAIN_AGENT_ID}"><span class="agent-tab-dot"></span><span class="agent-tab-label">Orchestrator</span><span class="agent-tab-meta">${meta}</span></button>`;
  const children = Array.from(this.subagents.entries())
    .map(([id, agent]: [string, any]) => {
      const s = getSubagentColorStyle(agent.colorIndex ?? 0);
      const ac = active === id ? ' active' : '';
      return `<div class="agent-tab ${agent.status}${ac}" data-agent-id="${escape(this, id)}" style="${s}">
        <span class="agent-tab-dot"></span>
        <span class="agent-tab-label">${escape(this, agent.name)}</span>
        <button type="button" class="agent-tab-close" data-close-agent="${escape(this, id)}" aria-label="Close ${escape(this, agent.name)}">×</button>
      </div>`;
    })
    .join('');
  nav.innerHTML = `${orchTab}${children}`;
  nav.classList.remove('hidden');
  nav.querySelectorAll('.agent-tab').forEach((el) => {
    el.addEventListener('click', () => this.switchAgent((el as HTMLElement).dataset.agentId || MAIN_AGENT_ID));
  });
  nav.querySelectorAll('[data-close-agent]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const agentId = (el as HTMLElement).dataset.closeAgent;
      if (agentId) void this.closeSubagentSession?.(agentId);
    });
  });
};

sidePanelProto.hideAgentNav = function hideAgentNav() {
  const nav = this.elements.agentNav as HTMLElement | null;
  if (!nav) return;
  nav.innerHTML = '';
  nav.classList.add('hidden');
  this.activeAgent = MAIN_AGENT_ID;
  this.syncAgentTranscriptVisibility();
  this.syncAgentComposerState();
};

sidePanelProto.switchAgent = function switchAgent(agentId: string) {
  const nextAgentId = agentId !== MAIN_AGENT_ID && this.subagents.has(agentId) ? agentId : MAIN_AGENT_ID;
  this.activeAgent = nextAgentId;
  if (nextAgentId !== MAIN_AGENT_ID) {
    this.openMissionControl?.();
    this.mcSelectedAgentId = nextAgentId;
    this.mcRenderDetail?.(nextAgentId);
    this.mcShowDetail?.();
  }
  this.renderAgentNav();
  this.syncAgentTranscriptVisibility();
  this.syncAgentComposerState();
  this.scrollToBottom?.({ force: true });
};

sidePanelProto.appendSubagentSessionMessage = function appendSubagentSessionMessage(
  agentId: string,
  title: string,
  body: string,
  tone: 'neutral' | 'success' | 'error' = 'neutral',
) {
  const agent = this.subagents.get(agentId);
  const container = this.elements.chatMessages as HTMLElement | null;
  if (!agent || !container) return;

  const block = document.createElement('div');
  block.className = `message assistant agent-session-log ${tone}`;
  this.tagAgentView(block, agentId);
  block.innerHTML = `
    <div class="message-header">${escape(this, agent.name)}</div>
    <div class="message-meta">${escape(this, title)}</div>
    <div class="message-content markdown-body">${this.renderMarkdown(body)}</div>
  `;
  container.appendChild(block);
  if (this.activeAgent === agentId) this.scrollToBottom?.();
};

sidePanelProto.flushSubagentStream = function flushSubagentStream(agentId: string, fallbackContent = '') {
  const agent = this.subagents.get(agentId);
  if (!agent) return;
  const content = (agent.pendingText || fallbackContent || '').trim();
  const reasoning = (agent.pendingReasoning || '').trim();
  if (!content && !reasoning) return;

  const sections: string[] = [];
  if (reasoning) {
    sections.push(`**Thinking**\n\n${reasoning}`);
  }
  if (content) {
    sections.push(content);
  }
  this.appendSubagentSessionMessage(agentId, 'Session output', sections.join('\n\n'));
  agent.pendingText = '';
  agent.pendingReasoning = '';
};
