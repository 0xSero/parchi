import { setSidebarOpen, showRightPanel as showRightPanelContent } from './panel-navigation.js';
import { SidePanelUI } from './panel-ui.js';

(SidePanelUI.prototype as any).switchView = function switchView(view: 'chat' | 'history') {
  this.currentView = view;
  // History is now a top drawer overlay, not a main view.
  // Keep chat visible and let showRightPanel() control sidebar content.
  if (!this.elements.chatInterface) return;
  this.elements.chatInterface.classList.remove('hidden');
};

(SidePanelUI.prototype as any).openSidebar = function openSidebar() {
  setSidebarOpen(this.elements, true);
};

(SidePanelUI.prototype as any).closeSidebar = function closeSidebar() {
  setSidebarOpen(this.elements, false);
};

(SidePanelUI.prototype as any).showRightPanel = function showRightPanel(panelName: 'settings' | null) {
  showRightPanelContent(this.elements, panelName);
};

(SidePanelUI.prototype as any).openChatView = function openChatView() {
  this.closeSidebar();
  this.switchView('chat');
};

(SidePanelUI.prototype as any).openHistoryDrawer = function openHistoryDrawer() {
  this.elements.historyDrawer?.classList.remove('hidden');
  this.elements.historyDrawerScrim?.classList.remove('hidden');
  this.loadHistoryList();
  // Focus search input for quick filtering
  setTimeout(() => this.elements.historySearchInput?.focus(), 100);
};

(SidePanelUI.prototype as any).closeHistoryDrawer = function closeHistoryDrawer() {
  this.elements.historyDrawer?.classList.add('hidden');
  this.elements.historyDrawerScrim?.classList.add('hidden');
  // Clear search on close
  if (this.elements.historySearchInput) {
    this.elements.historySearchInput.value = '';
  }
};

(SidePanelUI.prototype as any).openSettingsPanel = function openSettingsPanel() {
  this.openSidebar();
  this.showRightPanel('settings');
  this.switchSettingsTab(this.currentSettingsTab || 'setup');
  void this.refreshAccountPanel?.({ silent: true });
};

(SidePanelUI.prototype as any).startNewSession = function startNewSession() {
  this.displayHistory = [];
  this.contextHistory = [];
  const suffix = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now());
  this.sessionId = `session-${suffix}`;
  this.sessionStartedAt = Date.now();
  this.firstUserMessage = '';
  this.sessionTokensUsed = 0;
  this.lastUsage = null;
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
  this.activeAgent = 'main';
  this.historyTurnMap.clear();
  this.pendingTurnDraft = null;
  this.elements.chatMessages.innerHTML = '';
  this.toolCallViews.clear();
  this.updateChatEmptyState?.();
  this.resetActivityPanel();
  this.hideAgentNav();
  // Clear session tabs HUD
  this.sessionTabsState = {
    tabs: [],
    activeTabId: null,
    maxTabs: 5,
    groupTitle: undefined,
    interactingTabId: null,
  };
  this.renderSessionTabsHud?.();
  this.updateStatus('Ready for a new session', 'success');
  this.switchView('chat');
  this.updateContextUsage();
  this.scrollToBottom({ force: true });
};
