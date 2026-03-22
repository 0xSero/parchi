import { setSidebarOpen, showRightPanel as showRightPanelContent } from './panel-navigation.js';
import { clearReportImages, clearToolCallViews } from './panel-session-memory.js';
import { SidePanelUI } from './panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

sidePanelProto.switchView = function switchView(view: 'chat' | 'history') {
  this.currentView = view;
  // History is now a top drawer overlay, not a main view.
  // Keep chat visible and let showRightPanel() control sidebar content.
  if (!this.elements.chatInterface) return;
  this.elements.chatInterface.classList.remove('hidden');
};

sidePanelProto.openSidebar = function openSidebar() {
  setSidebarOpen(this.elements, true);
};

sidePanelProto.closeSidebar = function closeSidebar() {
  setSidebarOpen(this.elements, false);
};

sidePanelProto.showRightPanel = function showRightPanel(panelName: 'settings' | 'account' | null) {
  showRightPanelContent(this.elements, panelName);
};

sidePanelProto.openChatView = function openChatView() {
  this.closeSidebar();
  this.switchView('chat');
};

sidePanelProto.openHistoryDrawer = function openHistoryDrawer() {
  this.elements.historyDrawer?.classList.remove('hidden');
  this.elements.historyDrawerScrim?.classList.remove('hidden');
  this.loadHistoryList();
  // Focus search input for quick filtering
  setTimeout(() => this.elements.historySearchInput?.focus(), 100);
};

sidePanelProto.closeHistoryDrawer = function closeHistoryDrawer() {
  this.elements.historyDrawer?.classList.add('hidden');
  this.elements.historyDrawerScrim?.classList.add('hidden');
  // Clear search on close
  if (this.elements.historySearchInput) {
    this.elements.historySearchInput.value = '';
  }
};

sidePanelProto.openSettingsPanel = function openSettingsPanel() {
  this.openSidebar();
  this.showRightPanel('settings');
  this.switchSettingsTab(this.currentSettingsTab || 'providers');
  void this.refreshAccountPanel?.({ silent: true });
};

sidePanelProto.openAccountPanel = function openAccountPanel() {
  this.openSidebar();
  this.showRightPanel('account');
  void this.refreshAccountPanel?.({ silent: true });
};

sidePanelProto.startNewSession = function startNewSession() {
  // Auto-save current session before clearing state
  this.autoSaveSessionJsonl?.();

  if (this.elements.composer?.classList.contains('running')) {
    this.requestRunStop?.('Stopped (new session)');
  }
  this.displayHistory = [];
  this.contextHistory = [];
  const suffix = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now());
  this.sessionId = `session-${suffix}`;
  this.sessionStartedAt = Date.now();
  this.firstUserMessage = '';
  this.sessionTokensUsed = 0;
  this.contextCompactionState = {
    inProgress: false,
    lastResult: null,
    lastMessage: null,
    lastCompactedAt: 0,
    lastCompletedAt: 0,
  };
  this.lastUsage = null;
  this.streamingUsageEstimatedTokens = 0;
  this.streamingUsageEstimatedTokensApplied = 0;
  this.sessionTokenTotals = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };
  this.currentPlan = null;
  this.hidePlanDrawer();
  this.stopThinkingTimer?.();
  this.stopRunTimer?.();
  this.stopWatchdog?.();
  this.elements.composer?.classList.remove('running');
  this.pendingToolCount = 0;
  this.isStreaming = false;
  this.activeToolName = null;
  this._lastTypingAt = 0;
  this._mascotBubbleOpen = false;
  const mascotBubble = document.getElementById('mascotBubble');
  if (mascotBubble) mascotBubble.classList.add('hidden');
  this.updateMascotEyeState?.();
  this.subagents.clear();
  this.tabToAgentId.clear();
  this.activeAgent = 'main';
  this.mcSelectedAgentId = null;
  if (this.elements.mcMessageInput) this.elements.mcMessageInput.value = '';
  this.closeMissionControl?.();
  this.mcUpdateFab?.();
  this.mcRenderAgentList?.();
  this.historyTurnMap.clear();
  clearReportImages(this.reportImages, this.reportImageOrder, this.selectedReportImageIds);
  this.pendingTurnDraft = null;
  this.elements.chatMessages.innerHTML = '';
  clearToolCallViews(this.toolCallViews);
  this.updateChatEmptyState?.();
  this.resetActivityPanel();
  this.hideAgentNav();
  // Clear session tabs HUD

  this.updateStatus('Ready for a new session', 'success');
  this.syncAgentComposerState?.();
  this.switchView('chat');
  this.updateContextUsage();
  this.scrollToBottom({ force: true });
  // Reset topbar session title
  const titleEl = this.elements.topbarSessionTitle as HTMLElement | null;
  if (titleEl) titleEl.textContent = 'New session';
};
