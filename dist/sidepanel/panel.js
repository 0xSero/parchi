// packages/extension/sidepanel/ui/core/panel-elements.ts
var byId = (id) => document.getElementById(id);
var bySelector = (selector) => document.querySelector(selector);
var getSidePanelElements = () => ({
  // Sidebar elements
  sidebar: byId("sidebar"),
  sidebarScrim: byId("sidebarScrim"),
  openSidebarBtn: byId("openSidebarBtn"),
  closeSidebarBtn: byId("closeSidebarBtn"),
  rightPanel: byId("rightPanel"),
  rightPanelPanels: byId("rightPanelPanels") ?? bySelector(".right-panel-panels"),
  // Legacy references (kept for compatibility)
  settingsBtn: byId("settingsBtn"),
  settingsPanel: byId("settingsPanel"),
  chatInterface: byId("chatInterface"),
  statusText: byId("statusText"),
  statusMeta: byId("statusMeta"),
  statusBar: byId("statusBar"),
  agentNav: byId("agentNav"),
  tabSelectorBtn: byId("tabSelectorBtn"),
  exportBtn: byId("exportBtn"),
  tabSelector: byId("tabSelector"),
  tabSelectorSummary: byId("tabSelectorSummary"),
  tabSelectorAddActive: byId("tabSelectorAddActive"),
  tabSelectorClear: byId("tabSelectorClear"),
  tabList: byId("tabList"),
  closeTabSelector: byId("closeTabSelector"),
  selectedTabsBar: byId("selectedTabsBar"),
  sessionTabsHud: byId("sessionTabsHud"),
  sessionTabsCount: byId("sessionTabsCount"),
  sessionTabsList: byId("sessionTabsList"),
  scrollToLatestBtn: byId("scrollToLatestBtn"),
  newSessionFab: byId("newSessionFab"),
  historyFab: byId("historyFab"),
  historyDrawer: byId("historyDrawer"),
  historyDrawerScrim: byId("historyDrawerScrim"),
  historySearchInput: byId("historySearchInput"),
  historyDrawerItems: byId("historyDrawerItems"),
  closeHistoryDrawerBtn: byId("closeHistoryDrawerBtn"),
  drawerClearHistoryBtn: byId("drawerClearHistoryBtn"),
  drawerNewSessionBtn: byId("drawerNewSessionBtn"),
  historyPanel: byId("historyPanel"),
  historyItems: byId("historyItems"),
  clearHistoryBtn: byId("clearHistoryBtn"),
  startNewSessionBtn: byId("startNewSessionBtn"),
  settingsTabSetupBtn: byId("settingsTabSetupBtn"),
  settingsTabOauthBtn: byId("settingsTabOauthBtn"),
  settingsTabModelBtn: byId("settingsTabModelBtn"),
  settingsTabBrowserBtn: byId("settingsTabBrowserBtn"),
  settingsTabNetworkBtn: byId("settingsTabNetworkBtn"),
  settingsTabPromptBtn: byId("settingsTabPromptBtn"),
  settingsTabProfilesBtn: byId("settingsTabProfilesBtn"),
  settingsTabSetup: byId("settingsTabSetup"),
  settingsTabOauth: byId("settingsTabOauth"),
  settingsTabModel: byId("settingsTabModel"),
  settingsTabBrowser: byId("settingsTabBrowser"),
  settingsTabNetwork: byId("settingsTabNetwork"),
  settingsTabPrompt: byId("settingsTabPrompt"),
  settingsTabProfiles: byId("settingsTabProfiles"),
  newProfileNameInput: byId("newProfileNameInput"),
  createProfileBtn: byId("createProfileBtn"),
  profileEditorTitle: byId("profileEditorTitle"),
  profileEditorName: byId("profileEditorName"),
  profileEditorProvider: byId("profileEditorProvider"),
  profileEditorApiKey: byId("profileEditorApiKey"),
  profileEditorModel: byId("profileEditorModel"),
  profileEditorEndpoint: byId("profileEditorEndpoint"),
  profileEditorEndpointGroup: byId("profileEditorEndpointGroup"),
  profileEditorHeaders: byId("profileEditorHeaders"),
  profileEditorTemperature: byId("profileEditorTemperature"),
  profileEditorTemperatureValue: byId("profileEditorTemperatureValue"),
  profileEditorMaxTokens: byId("profileEditorMaxTokens"),
  profileEditorContextLimit: byId("profileEditorContextLimit"),
  profileEditorTimeout: byId("profileEditorTimeout"),
  profileEditorEnableScreenshots: byId("profileEditorEnableScreenshots"),
  profileEditorSendScreenshots: byId("profileEditorSendScreenshots"),
  profileEditorScreenshotQuality: byId("profileEditorScreenshotQuality"),
  profileEditorShowThinking: byId("profileEditorShowThinking"),
  profileEditorStreamResponses: byId("profileEditorStreamResponses"),
  profileEditorAutoScroll: byId("profileEditorAutoScroll"),
  profileEditorConfirmActions: byId("profileEditorConfirmActions"),
  profileEditorSaveHistory: byId("profileEditorSaveHistory"),
  profileEditorPrompt: byId("profileEditorPrompt"),
  saveProfileBtn: byId("saveProfileBtn"),
  profileJsonEditor: byId("profileJsonEditor"),
  refreshProfileJsonBtn: byId("refreshProfileJsonBtn"),
  copyProfileJsonBtn: byId("copyProfileJsonBtn"),
  applyProfileJsonBtn: byId("applyProfileJsonBtn"),
  permissionRead: byId("permissionRead"),
  permissionInteract: byId("permissionInteract"),
  permissionNavigate: byId("permissionNavigate"),
  permissionTabs: byId("permissionTabs"),
  permissionScreenshots: byId("permissionScreenshots"),
  allowedDomains: byId("allowedDomains"),
  exportSettingsBtn: byId("exportSettingsBtn"),
  importSettingsBtn: byId("importSettingsBtn"),
  importSettingsInput: byId("importSettingsInput"),
  // Account + billing
  accountOnboardingModal: byId("accountOnboardingModal"),
  accountChooseByokBtn: byId("accountChooseByokBtn"),
  accountChoosePaidBtn: byId("accountChoosePaidBtn"),
  accountAuthUnavailable: byId("accountAuthUnavailable"),
  accountAuthSignedOut: byId("accountAuthSignedOut"),
  accountAuthSignedIn: byId("accountAuthSignedIn"),
  accountEmailInput: byId("accountEmailInput"),
  accountPasswordInput: byId("accountPasswordInput"),
  accountSignInBtn: byId("accountSignInBtn"),
  accountSignUpBtn: byId("accountSignUpBtn"),
  accountGoogleBtn: byId("accountGoogleBtn"),
  accountGithubBtn: byId("accountGithubBtn"),
  accountStatusText: byId("accountStatusText"),
  accountUserValue: byId("accountUserValue"),
  accountPlanValue: byId("accountPlanValue"),
  accountUsageValue: byId("accountUsageValue"),
  accountUpgradeBtn: byId("accountUpgradeBtn"),
  accountManageBtn: byId("accountManageBtn"),
  accountRefreshBtn: byId("accountRefreshBtn"),
  accountSignOutBtn: byId("accountSignOutBtn"),
  // Relay
  relayEnabled: byId("relayEnabled"),
  relayUrl: byId("relayUrl"),
  relayToken: byId("relayToken"),
  saveRelayBtn: byId("saveRelayBtn"),
  copyRelayEnvBtn: byId("copyRelayEnvBtn"),
  relayConnectedBadge: byId("relayConnectedBadge"),
  relayLastErrorText: byId("relayLastErrorText"),
  // Form elements - Provider & model
  provider: byId("provider"),
  apiKey: byId("apiKey"),
  model: byId("model"),
  customEndpoint: byId("customEndpoint"),
  customEndpointGroup: byId("customEndpointGroup"),
  customHeaders: byId("customHeaders"),
  customHeadersGroup: byId("customHeadersGroup"),
  // Form elements - Model parameters
  temperature: byId("temperature"),
  temperatureValue: byId("temperatureValue"),
  maxTokens: byId("maxTokens"),
  contextLimit: byId("contextLimit"),
  timeout: byId("timeout"),
  // Form elements - Screenshots & vision
  enableScreenshots: byId("enableScreenshots"),
  sendScreenshotsAsImages: byId("sendScreenshotsAsImages"),
  screenshotQuality: byId("screenshotQuality"),
  visionBridge: byId("visionBridge"),
  visionProfile: byId("visionProfile"),
  // Form elements - Behavior
  showThinking: byId("showThinking"),
  streamResponses: byId("streamResponses"),
  autoScroll: byId("autoScroll"),
  confirmActions: byId("confirmActions"),
  saveHistory: byId("saveHistory"),
  // Form elements - Orchestrator
  orchestratorToggle: byId("orchestratorToggle"),
  orchestratorProfile: byId("orchestratorProfile"),
  // Form elements - System prompt
  systemPrompt: byId("systemPrompt"),
  orchestratorPromptSection: byId("orchestratorPromptSection"),
  orchestratorPromptTextarea: byId("orchestratorPromptTextarea"),
  visionPromptSection: byId("visionPromptSection"),
  visionPromptTextarea: byId("visionPromptTextarea"),
  // Form elements - Appearance
  uiZoom: byId("uiZoom"),
  uiZoomValue: byId("uiZoomValue"),
  themeGrid: byId("themeGrid"),
  // Settings actions
  saveSettingsBtn: byId("saveSettingsBtn"),
  cancelSettingsBtn: byId("cancelSettingsBtn"),
  // Profile management
  activeConfig: byId("activeConfig"),
  newConfigBtn: byId("newConfigBtn"),
  newProfileInput: byId("newProfileInput"),
  deleteConfigBtn: byId("deleteConfigBtn"),
  refreshProfilesBtn: byId("refreshProfilesBtn"),
  agentGrid: byId("agentGrid"),
  // Chat interface
  chatMessages: byId("chatMessages"),
  chatEmptyState: byId("chatEmptyState"),
  userInput: byId("userInput"),
  sendBtn: byId("sendBtn"),
  composer: byId("composer"),
  modelSelect: byId("modelSelect"),
  fileBtn: byId("fileBtn"),
  fileInput: byId("fileInput"),
  zoomOutBtn: byId("zoomOutBtn"),
  zoomInBtn: byId("zoomInBtn"),
  zoomResetBtn: byId("zoomResetBtn"),
  planDrawer: byId("planDrawer"),
  planDrawerToggle: byId("planDrawerToggle"),
  planChecklist: byId("planChecklist"),
  planStepCount: byId("planStepCount"),
  planClearBtn: byId("planClearBtn"),
  stopRunBtn: byId("stopRunBtn")
  // legacy, stop is now handled by sendBtn
});

// packages/extension/sidepanel/ui/core/panel-ui.ts
var SidePanelUI = class {
  elements;
  displayHistory;
  contextHistory;
  sessionId;
  sessionStartedAt;
  firstUserMessage;
  currentConfig;
  configs;
  toolCallViews;
  lastChatTurn;
  selectedTabs;
  tabGroupInfo;
  scrollPositions;
  pendingToolCount;
  isStreaming;
  thinkingStartedAt;
  thinkingTimerId;
  runStartedAt;
  runTimerId;
  streamingState;
  userScrolledUp;
  isNearBottom;
  chatResizeObserver;
  contextUsage;
  sessionTokensUsed;
  lastUsage;
  sessionTokenTotals;
  uiZoom;
  toolPermissions;
  auxAgentProfiles;
  currentView;
  currentSettingsTab;
  profileEditorTarget;
  subagents;
  activeAgent;
  activityPanelOpen;
  latestThinking;
  activeToolName;
  streamingReasoning;
  currentPlan;
  stepTimeline;
  historyTurnMap;
  pendingTurnDraft;
  isReplayingHistory;
  _lastRuntimeMessageAt;
  _watchdogTimerId;
  _deleteConfirmTarget;
  _deleteConfirmAt;
  timelineCollapsed;
  currentTheme;
  sessionTabsState;
  workflows;
  workflowMenuOpen;
  workflowMenuIndex;
  _lastTypingAt;
  _typingCheckTimerId;
  _mascotBubbleOpen;
  _currentVerb;
  constructor() {
    this.elements = getSidePanelElements();
    this.displayHistory = [];
    this.contextHistory = [];
    const suffix = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : String(Date.now());
    this.sessionId = `session-${suffix}`;
    this.sessionStartedAt = Date.now();
    this.firstUserMessage = "";
    this.currentConfig = "default";
    this.configs = { default: {} };
    this.toolCallViews = /* @__PURE__ */ new Map();
    this.lastChatTurn = null;
    this.selectedTabs = /* @__PURE__ */ new Map();
    this.tabGroupInfo = /* @__PURE__ */ new Map();
    this.scrollPositions = /* @__PURE__ */ new Map();
    this.pendingToolCount = 0;
    this.isStreaming = false;
    this.thinkingStartedAt = null;
    this.thinkingTimerId = null;
    this.runStartedAt = null;
    this.runTimerId = null;
    this.streamingState = null;
    this.userScrolledUp = false;
    this.isNearBottom = true;
    this.chatResizeObserver = null;
    this.contextUsage = {
      approxTokens: 0,
      maxContextTokens: 196e3,
      percent: 0
    };
    this.sessionTokensUsed = 0;
    this.lastUsage = null;
    this.sessionTokenTotals = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0
    };
    this.uiZoom = 1;
    this.toolPermissions = {
      read: true,
      interact: true,
      navigate: true,
      tabs: true,
      screenshots: true
    };
    this.auxAgentProfiles = [];
    this.currentView = "chat";
    this.currentSettingsTab = "setup";
    this.profileEditorTarget = "default";
    this.subagents = /* @__PURE__ */ new Map();
    this.activeAgent = "main";
    this.activityPanelOpen = false;
    this.latestThinking = null;
    this.activeToolName = null;
    this.streamingReasoning = "";
    this.currentPlan = null;
    this.stepTimeline = {
      steps: /* @__PURE__ */ new Map(),
      activeStepIndex: null,
      activeStepBody: null
    };
    this.historyTurnMap = /* @__PURE__ */ new Map();
    this.pendingTurnDraft = null;
    this.isReplayingHistory = false;
    this._lastRuntimeMessageAt = 0;
    this._watchdogTimerId = null;
    this._deleteConfirmTarget = null;
    this._deleteConfirmAt = null;
    this.timelineCollapsed = true;
    this.currentTheme = "void";
    this.sessionTabsState = {
      tabs: [],
      activeTabId: null,
      maxTabs: 5,
      groupTitle: void 0,
      interactingTabId: null
    };
    this.workflows = [];
    this.workflowMenuOpen = false;
    this.workflowMenuIndex = -1;
    this._lastTypingAt = 0;
    this._typingCheckTimerId = null;
    this._mascotBubbleOpen = false;
    this._currentVerb = null;
    void this.init();
  }
};

// packages/extension/sidepanel/ui/agents/panel-agents.ts
SidePanelUI.prototype.addSubagent = function addSubagent(id, name, tasks) {
  this.subagents.set(id, {
    name: name || `Sub-${this.subagents.size + 1}`,
    tasks: Array.isArray(tasks) ? tasks : [tasks || "Task"],
    status: "running",
    messages: [],
    startedAt: Date.now(),
    completedAt: null,
    summary: null
  });
  this.renderAgentNav();
  this.renderSubagentActivity(id, "start", { name, tasks });
};
SidePanelUI.prototype.updateSubagentStatus = function updateSubagentStatus(id, status, summary) {
  const agent = this.subagents.get(id);
  if (agent) {
    agent.status = status;
    if (status === "completed" || status === "error") {
      agent.completedAt = Date.now();
      agent.summary = summary || null;
    }
    this.renderAgentNav();
    this.renderSubagentActivity(id, status === "completed" ? "complete" : status, { summary });
  }
};
SidePanelUI.prototype.renderAgentNav = function renderAgentNav() {
  if (!this.elements.agentNav) return;
  if (this.subagents.size === 0) {
    this.hideAgentNav();
    return;
  }
  this.elements.agentNav.classList.remove("hidden");
  let html = `
      <div class="agent-nav-item main-agent ${this.activeAgent === "main" ? "active" : ""}" data-agent="main">
        <span class="agent-status"></span>
        <span>Main</span>
      </div>
    `;
  this.subagents.forEach((agent, id) => {
    const statusClass = agent.status === "running" ? "running" : agent.status === "completed" ? "completed" : "error";
    const statusIcon = agent.status === "running" ? "\u23F3" : agent.status === "completed" ? "\u2713" : "\u2717";
    html += `
        <div class="agent-nav-item sub-agent ${statusClass} ${this.activeAgent === id ? "active" : ""}" data-agent="${id}" title="${agent.name}: ${agent.status}">
          <span class="agent-status">${statusIcon}</span>
          <span>${agent.name}</span>
        </div>
      `;
  });
  this.elements.agentNav.innerHTML = html;
  this.elements.agentNav.querySelectorAll(".agent-nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      const agentId = item.dataset.agent;
      this.switchAgent(agentId);
    });
  });
};
SidePanelUI.prototype.switchAgent = function switchAgent(agentId) {
  this.activeAgent = agentId;
  this.renderAgentNav();
  if (agentId !== "main") {
    const agent = this.subagents.get(agentId);
    if (agent) {
      this.highlightSubagentMessages(agentId);
    }
  }
};
SidePanelUI.prototype.hideAgentNav = function hideAgentNav() {
  if (this.elements.agentNav) {
    this.elements.agentNav.classList.add("hidden");
  }
};
SidePanelUI.prototype.renderSubagentActivity = function renderSubagentActivity(subagentId, event, data) {
  const agent = this.subagents.get(subagentId);
  if (!agent) return;
  if (!this.streamingState?.eventsEl) return;
  let container = this.streamingState.eventsEl.querySelector(
    `.subagent-block[data-subagent-id="${subagentId}"]`
  );
  if (!container) {
    container = document.createElement("div");
    container.className = "subagent-block";
    container.dataset.subagentId = subagentId;
    this.streamingState.eventsEl.appendChild(container);
  }
  const icon = event === "start" ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' : event === "complete" ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  const statusClass = event === "start" ? "running" : event === "complete" ? "completed" : "error";
  container.className = `subagent-block ${statusClass}`;
  let html = `
    <div class="subagent-header">
      <span class="subagent-icon">${icon}</span>
      <span class="subagent-name">${this.escapeHtml(agent.name)}</span>
      <span class="subagent-status">${event === "start" ? "Running..." : event === "complete" ? "Completed" : "Failed"}</span>
    </div>
  `;
  if (agent.tasks && agent.tasks.length > 0) {
    html += `<div class="subagent-tasks">`;
    for (const task of agent.tasks) {
      html += `<div class="subagent-task">\u2022 ${this.escapeHtml(task)}</div>`;
    }
    html += "</div>";
  }
  if (data?.summary || agent.summary) {
    const summaryText = data?.summary || agent.summary || "";
    html += `
      <div class="subagent-summary">
        <div class="subagent-summary-label">Summary</div>
        <div class="subagent-summary-content">${this.renderMarkdown(summaryText)}</div>
      </div>
    `;
  }
  if (data?.error) {
    html += `<div class="subagent-error">${this.escapeHtml(data.error)}</div>`;
  }
  container.innerHTML = html;
  this.scrollToBottom();
};
SidePanelUI.prototype.highlightSubagentMessages = function highlightSubagentMessages(subagentId) {
  this.elements.chatMessages?.querySelectorAll(".subagent-highlight").forEach((el) => {
    el.classList.remove("subagent-highlight");
  });
  this.elements.chatMessages?.querySelectorAll(`.subagent-block[data-subagent-id="${subagentId}"]`).forEach((el) => {
    el.classList.add("subagent-highlight");
  });
  const first = this.elements.chatMessages?.querySelector(`.subagent-block[data-subagent-id="${subagentId}"]`);
  if (first) {
    first.scrollIntoView({ behavior: "smooth", block: "center" });
  }
};
SidePanelUI.prototype.getSubagentSummary = function getSubagentSummary() {
  if (!this.subagents || this.subagents.size === 0) return "";
  const parts = [];
  this.subagents.forEach((agent) => {
    const status = agent.status === "running" ? "running" : agent.status;
    parts.push(`${agent.name} (${status})`);
  });
  return parts.join(", ");
};

// packages/extension/ai/message-schema.ts
var ROLE_SET = /* @__PURE__ */ new Set(["system", "user", "assistant", "tool"]);
function createMessageId() {
  return `msg_${Date.now()}_${Math.floor(Math.random() * 1e5)}`;
}
function createMessage({ role, content, ...meta } = {}) {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return null;
  const message = {
    id: meta.id || createMessageId(),
    createdAt: meta.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
    role: normalizedRole,
    content: normalizeContent(content)
  };
  if (typeof meta.thinking === "string" && meta.thinking.trim()) {
    message.thinking = meta.thinking;
  }
  if (meta.toolCalls) message.toolCalls = normalizeToolCalls(meta.toolCalls);
  if (meta.toolCallId) message.toolCallId = String(meta.toolCallId);
  if (meta.toolName) message.toolName = String(meta.toolName);
  if (meta.name) message.name = String(meta.name);
  if (meta.usage) message.usage = normalizeUsage(meta.usage);
  if (meta.meta) message.meta = meta.meta;
  return message;
}
function normalizeConversationHistory(history = [], options = {}) {
  const messages = Array.isArray(history) ? history : [];
  const normalized = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const role = normalizeRole(msg.role || options.defaultRole);
    if (!role) continue;
    const base = {
      role,
      content: normalizeContent(msg.content)
    };
    const id = typeof msg.id === "string" ? msg.id : options.addIds === false ? null : createMessageId();
    if (id) base.id = id;
    const createdAt = typeof msg.createdAt === "string" ? msg.createdAt : options.addTimestamps === false ? null : (/* @__PURE__ */ new Date()).toISOString();
    if (createdAt) base.createdAt = createdAt;
    if (typeof msg.thinking === "string" && msg.thinking.trim()) {
      base.thinking = msg.thinking;
    }
    if (role === "assistant") {
      const toolCalls = msg.toolCalls || msg.tool_calls;
      if (Array.isArray(toolCalls)) {
        base.toolCalls = normalizeToolCalls(toolCalls);
      }
    }
    if (role === "tool") {
      const toolCallId = msg.toolCallId || msg.tool_call_id;
      if (toolCallId) base.toolCallId = String(toolCallId);
      if (msg.name) base.name = String(msg.name);
      if (msg.toolName) base.toolName = String(msg.toolName);
    }
    if (msg.usage) base.usage = normalizeUsage(msg.usage);
    if (msg.meta) base.meta = msg.meta;
    normalized.push(base);
  }
  return normalized;
}
function normalizeToolCalls(toolCalls = []) {
  return toolCalls.map((call) => ({
    id: typeof call?.id === "string" ? call.id : createMessageId(),
    name: typeof call?.name === "string" ? call.name : call && typeof call.function?.name === "string" ? String(call.function?.name) : "",
    args: normalizeArgs(
      call?.args ?? call?.arguments ?? call?.function?.arguments
    )
  }));
}
function normalizeUsage(usage = {}) {
  return {
    inputTokens: Number(usage.inputTokens || 0),
    outputTokens: Number(usage.outputTokens || 0),
    totalTokens: Number(usage.totalTokens || 0)
  };
}
function normalizeRole(role) {
  if (typeof role !== "string") return "";
  const lowered = role.toLowerCase();
  return ROLE_SET.has(lowered) ? lowered : "";
}
function normalizeContent(content) {
  if (content === null || content === void 0) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content;
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}
function normalizeArgs(args) {
  if (args && typeof args === "object" && !Array.isArray(args)) return args;
  if (Array.isArray(args)) return { value: args };
  if (typeof args === "string") {
    try {
      return JSON.parse(args);
    } catch {
      return { value: args };
    }
  }
  return {};
}

// packages/extension/ai/message-utils.ts
function extractThinking(content, existingThinking = null) {
  let thinking = existingThinking || null;
  let cleanedContent = content || "";
  const thinkRegex = /<\s*(think|analysis|thinking)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi;
  let match;
  const collected = [];
  while ((match = thinkRegex.exec(cleanedContent)) !== null) {
    if (match[2]) collected.push(match[2].trim());
  }
  if (collected.length > 0) {
    thinking = [existingThinking, ...collected].filter(Boolean).join("\n\n").trim();
    thinkRegex.lastIndex = 0;
    cleanedContent = cleanedContent.replace(thinkRegex, "").trim();
  }
  return { content: cleanedContent, thinking };
}
function dedupeThinking(thinking) {
  if (!thinking) return "";
  const paragraphs = thinking.split(/\n\n+/);
  const seenParagraphs = /* @__PURE__ */ new Set();
  const dedupedParagraphs = [];
  for (const para of paragraphs) {
    const normalized = para.trim().toLowerCase();
    if (normalized && !seenParagraphs.has(normalized)) {
      seenParagraphs.add(normalized);
      dedupedParagraphs.push(para.trim());
    }
  }
  const result = dedupedParagraphs.join("\n\n");
  const lines = result.split("\n");
  const deduplicated = [];
  let lastLine = null;
  let repeatCount = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === lastLine && trimmed !== "") {
      repeatCount++;
      if (repeatCount >= 2) {
      }
    } else {
      deduplicated.push(line);
      lastLine = trimmed;
      repeatCount = 0;
    }
  }
  return deduplicated.join("\n").trim();
}

// packages/extension/utils/active-tab.ts
var getActiveTab = async () => {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return activeTab || null;
};

// packages/extension/sidepanel/ui/chat/panel-chat.ts
var truncate = (value, max = 12e3) => {
  const text = String(value || "");
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\u2026`;
};
var sanitizeForMessaging = (value, depth = 0) => {
  if (value == null) return value;
  if (typeof value === "string") {
    const s = value;
    if (s.startsWith("data:image/") || s.startsWith("data:application/octet-stream")) {
      return "[omitted dataUrl]";
    }
    return truncate(s, 12e3);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "function") return void 0;
  if (depth > 6) return "[truncated]";
  if (Array.isArray(value)) {
    const out = [];
    const limit = Math.min(value.length, 80);
    for (let i = 0; i < limit; i += 1) {
      out.push(sanitizeForMessaging(value[i], depth + 1));
    }
    if (value.length > limit) out.push(`[+${value.length - limit} items truncated]`);
    return out;
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: truncate(value.stack || "", 2e3) };
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v2] of Object.entries(value)) {
      if (k === "dataUrl") {
        out[k] = "[omitted dataUrl]";
        continue;
      }
      out[k] = sanitizeForMessaging(v2, depth + 1);
    }
    return out;
  }
  return String(value);
};
SidePanelUI.prototype.sendMessage = async function sendMessage() {
  const userMessage = this.elements.userInput.value.trim();
  if (!userMessage) return;
  this.pendingTurnDraft = { userMessage, startedAt: Date.now() };
  this.elements.userInput.value = "";
  this.elements.userInput.style.height = "";
  if (!this.firstUserMessage) {
    this.firstUserMessage = userMessage;
  }
  this.pendingToolCount = 0;
  this.isStreaming = false;
  this.streamingState = null;
  this.stepTimeline.steps.clear();
  this.stepTimeline.activeStepIndex = null;
  this.stepTimeline.activeStepBody = null;
  this.activeToolName = null;
  this.latestThinking = null;
  this.clearRunIncompleteBanner();
  this.updateActivityState();
  let selectedTabsPayload = Array.from(this.selectedTabs.values());
  let tabsContext = this.getSelectedTabsContext(selectedTabsPayload);
  if (selectedTabsPayload.length === 0) {
    try {
      const activeTab = await getActiveTab();
      if (activeTab && typeof activeTab.id === "number") {
        const autoTab = this.buildSelectedTab(activeTab);
        selectedTabsPayload = [autoTab];
        tabsContext = this.getSelectedTabsContext(selectedTabsPayload, "active");
      }
    } catch (error) {
      console.warn("Failed to capture active tab context:", error);
    }
  }
  const fullMessage = userMessage + tabsContext;
  this.displayUserMessage(userMessage);
  const displayEntry = createMessage({ role: "user", content: userMessage });
  if (displayEntry) {
    this.displayHistory.push(displayEntry);
  }
  const contextEntry = createMessage({ role: "user", content: fullMessage });
  if (contextEntry) {
    this.contextHistory.push(contextEntry);
  }
  this.updateContextUsage();
  this.updateStatus("Processing...", "active");
  this.elements.composer?.classList.add("running");
  this.startRunTimer?.();
  this.startWatchdog?.();
  try {
    const sendableHistory = sanitizeForMessaging(this.contextHistory || []);
    const response = await chrome.runtime.sendMessage({
      type: "user_message",
      message: fullMessage,
      conversationHistory: sendableHistory,
      selectedTabs: selectedTabsPayload,
      sessionId: this.sessionId
    });
    if (response?.sessionId && typeof response.sessionId === "string") {
      this.sessionId = response.sessionId;
    }
  } catch (error) {
    this.stopThinkingTimer?.();
    this.stopRunTimer?.();
    this.stopWatchdog?.();
    this.pendingTurnDraft = null;
    this.updateStatus("Error: " + error.message, "error");
    this.elements.composer?.classList.remove("running");
    this.displayAssistantMessage("Sorry, an error occurred: " + error.message);
  }
};
SidePanelUI.prototype.displayUserMessage = function displayUserMessage(content) {
  const turn = document.createElement("div");
  turn.className = "chat-turn";
  const messageDiv = document.createElement("div");
  messageDiv.className = "message user";
  messageDiv.innerHTML = `
      <div class="message-header">You</div>
      <div class="message-content">${this.escapeHtml(content)}</div>
    `;
  turn.appendChild(messageDiv);
  this.elements.chatMessages.appendChild(turn);
  this.lastChatTurn = turn;
  this.scrollToBottom({ force: true });
  this.updateChatEmptyState();
};
SidePanelUI.prototype.displaySummaryMessage = function displaySummaryMessage(messageOrEntry) {
  const content = typeof messageOrEntry === "string" ? messageOrEntry : String(messageOrEntry.content || "");
  const container = document.createElement("div");
  container.className = "message summary";
  container.innerHTML = `
      <div class="summary-header">Context compacted</div>
      <div class="summary-body">${this.renderMarkdown(content)}</div>
    `;
  this.elements.chatMessages.appendChild(container);
  this.scrollToBottom();
  this.updateChatEmptyState();
};
SidePanelUI.prototype.updateChatEmptyState = function updateChatEmptyState() {
  const emptyState = this.elements.chatEmptyState;
  if (!emptyState) return;
  const hasMessages = this.displayHistory && this.displayHistory.length > 0 || this.elements.chatMessages && this.elements.chatMessages.children.length > 0;
  emptyState.classList.toggle("hidden", hasMessages);
};
SidePanelUI.prototype.displayAssistantMessage = function displayAssistantMessage(content, thinking = null, usage = null, model = null) {
  this.stopThinkingTimer?.();
  const streamResult = this.finishStreamingMessage();
  const streamedContainer = streamResult?.container;
  const streamEventsEl = streamedContainer?.querySelector(".stream-events");
  const hasStreamEvents = Boolean(streamEventsEl && streamEventsEl.children.length > 0);
  let normalizedUsage = this.normalizeUsage(usage);
  const modelLabel = model || this.getActiveModelLabel();
  const combinedThinking = [streamResult?.thinking, thinking].filter(Boolean).join("\n\n") || null;
  const showThinking = this.elements.showThinking?.value === "true";
  if ((!content || content.trim() === "") && !combinedThinking && !hasStreamEvents) {
    if (streamedContainer) {
      streamedContainer.remove();
    }
    this.updateStatus("Ready", "success");
    this.elements.composer?.classList.remove("running");
    this.stopWatchdog?.();
    this.pendingToolCount = 0;
    this.updateActivityState();
    return;
  }
  const parsed = extractThinking(content, combinedThinking);
  content = parsed.content;
  thinking = parsed.thinking;
  if (thinking) {
  } else {
  }
  this.updateThinkingPanel(thinking, false);
  if (!normalizedUsage) {
    normalizedUsage = this.estimateUsageFromContent(content);
  }
  if (normalizedUsage) {
    this.updateUsageStats(normalizedUsage);
  }
  const messageMeta = this.buildMessageMeta(normalizedUsage, modelLabel);
  const assistantEntry = createMessage({
    role: "assistant",
    content,
    thinking
  });
  if (assistantEntry) {
    this.displayHistory.push(assistantEntry);
  }
  if (streamedContainer) {
    if (!streamedContainer.querySelector(".message-header")) {
      const header = document.createElement("div");
      header.className = "message-header";
      header.textContent = "Assistant";
      streamedContainer.prepend(header);
    }
    if (messageMeta) {
      let metaEl = streamedContainer.querySelector(".message-meta");
      if (!metaEl) {
        metaEl = document.createElement("div");
        metaEl.className = "message-meta";
        const header = streamedContainer.querySelector(".message-header");
        if (header) {
          header.insertAdjacentElement("afterend", metaEl);
        } else {
          streamedContainer.prepend(metaEl);
        }
      }
      metaEl.textContent = messageMeta;
    }
    if (thinking && showThinking && streamEventsEl) {
      const existingThinking = streamedContainer.querySelector(
        ".thinking-block, .inline-thinking-block, .stream-event-reasoning"
      );
      const cleanedThinking = dedupeThinking(thinking);
      if (!existingThinking && cleanedThinking) {
        const thinkingBlock = document.createElement("div");
        thinkingBlock.className = "thinking-block collapsed";
        thinkingBlock.innerHTML = `
            <button class="thinking-header" type="button" aria-expanded="false">
              <svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
              Thought process
            </button>
            <div class="thinking-content">${this.escapeHtml(cleanedThinking)}</div>
          `;
        const targetBody = streamedContainer.querySelector(".step-body");
        const target = targetBody || streamEventsEl;
        const firstChild = target.firstChild;
        if (firstChild) {
          target.insertBefore(thinkingBlock, firstChild);
        } else {
          target.appendChild(thinkingBlock);
        }
        const thinkingHeader2 = thinkingBlock.querySelector(".thinking-header");
        if (thinkingHeader2) {
          thinkingHeader2.addEventListener("click", () => {
            const block = thinkingHeader2.closest(".thinking-block");
            if (!block || block.classList.contains("thinking-hidden")) return;
            block.classList.toggle("collapsed");
            const expanded = !block.classList.contains("collapsed");
            thinkingHeader2.setAttribute("aria-expanded", expanded ? "true" : "false");
          });
        }
      }
    }
    if (streamEventsEl) {
      const textEvents = streamedContainer.querySelectorAll(".stream-event-text");
      Array.from(textEvents).forEach((el) => el.remove());
      if (content && content.trim() !== "") {
        const textEvent = document.createElement("div");
        textEvent.className = "stream-event stream-event-text";
        textEvent.innerHTML = this.renderMarkdown(content);
        streamEventsEl.appendChild(textEvent);
      }
      const toolRows = streamEventsEl.querySelectorAll(".tool-row");
      if (toolRows.length > 0) {
        const errorCount = streamEventsEl.querySelectorAll(".tool-row.error").length;
        const label = `${toolRows.length} tool call${toolRows.length !== 1 ? "s" : ""}${errorCount > 0 ? ` \xB7 ${errorCount} error${errorCount !== 1 ? "s" : ""}` : ""}`;
        const toggle = document.createElement("button");
        toggle.className = "tool-group-toggle";
        toggle.type = "button";
        toggle.innerHTML = `
          <svg class="tool-group-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          <span>${label}</span>
        `;
        toggle.addEventListener("click", () => {
          streamEventsEl.classList.toggle("tools-collapsed");
        });
        toolRows[0].insertAdjacentElement("beforebegin", toggle);
        streamEventsEl.classList.add("tools-collapsed");
      }
    }
    this.scrollToBottom();
    this.updateStatus("Ready", "success");
    this.elements.composer?.classList.remove("running");
    this.stopWatchdog?.();
    this.stopRunTimer?.();
    this.pendingToolCount = 0;
    this.updateActivityState();
    this.persistHistory();
    this.updateChatEmptyState();
    return;
  }
  const messageDiv = document.createElement("div");
  messageDiv.className = "message assistant";
  let html = `<div class="message-header">Assistant</div>`;
  if (messageMeta) {
    html += `<div class="message-meta">${this.escapeHtml(messageMeta)}</div>`;
  }
  if (thinking && showThinking) {
    const cleanedThinking = dedupeThinking(thinking);
    html += `
        <div class="thinking-block collapsed">
          <button class="thinking-header" type="button" aria-expanded="false">
            <svg class="chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            Thought process
          </button>
          <div class="thinking-content">${this.escapeHtml(cleanedThinking)}</div>
        </div>
      `;
  }
  if (content && content.trim() !== "") {
    const renderedContent = this.renderMarkdown(content);
    html += `<div class="message-content markdown-body">${renderedContent}</div>`;
  }
  messageDiv.innerHTML = html;
  const thinkingHeader = messageDiv.querySelector(".thinking-header");
  if (thinkingHeader) {
    thinkingHeader.addEventListener("click", () => {
      const block = thinkingHeader.closest(".thinking-block");
      if (!block || block.classList.contains("thinking-hidden")) return;
      block.classList.toggle("collapsed");
      const expanded = !block.classList.contains("collapsed");
      thinkingHeader.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
  }
  if (this.lastChatTurn) {
    this.lastChatTurn.appendChild(messageDiv);
  } else {
    this.elements.chatMessages.appendChild(messageDiv);
  }
  this.scrollToBottom();
  this.updateStatus("Ready", "success");
  this.elements.composer?.classList.remove("running");
  this.stopWatchdog?.();
  this.stopRunTimer?.();
  this.pendingToolCount = 0;
  this.updateActivityState();
  this.persistHistory();
  this.updateChatEmptyState();
};

// packages/extension/sidepanel/ui/chat/panel-context.ts
SidePanelUI.prototype.updateContextUsage = function updateContextUsage(actualTokens = null) {
  let approxTokens;
  if (actualTokens !== null && actualTokens > 0) {
    this.sessionTokensUsed = Math.max(this.sessionTokensUsed || 0, actualTokens);
    approxTokens = this.sessionTokensUsed;
  } else {
    const joined = this.contextHistory.map((msg) => {
      if (!msg) return "";
      if (typeof msg.content === "string") return msg.content;
      if (Array.isArray(msg.content)) {
        return msg.content.map((p) => {
          if (typeof p === "string") return p;
          if (p?.text) return p.text;
          if (p?.content) return JSON.stringify(p.content);
          if (p?.output) {
            const output = p.output?.value ?? p.output;
            if (typeof output === "string") return output;
            try {
              return JSON.stringify(output);
            } catch {
              return String(output);
            }
          }
          return "";
        }).join("");
      }
      return "";
    }).join("\n");
    const chars = joined.length;
    const baseTokens = this.estimateBaseContextTokens();
    const estimated = baseTokens + Math.ceil(chars / 4);
    approxTokens = Math.max(estimated, this.sessionTokensUsed || 0);
  }
  const maxContextTokens = this.getConfiguredContextLimit();
  const percent = Math.min(100, Math.round(approxTokens / maxContextTokens * 100));
  this.contextUsage = { approxTokens, maxContextTokens, percent };
  this.updateActivityState();
};
SidePanelUI.prototype.getConfiguredContextLimit = function getConfiguredContextLimit() {
  const active = this.configs[this.currentConfig] || {};
  const configured = active.contextLimit || Number.parseInt(this.elements.contextLimit?.value) || 2e5;
  return configured;
};
SidePanelUI.prototype.estimateBaseContextTokens = function estimateBaseContextTokens() {
  const active = this.configs[this.currentConfig] || {};
  const prompt = active.systemPrompt || this.getDefaultSystemPrompt();
  const promptTokens = Math.ceil((prompt?.length || 0) / 4);
  const toolBudget = 1200;
  return promptTokens + toolBudget;
};

// packages/shared/src/runtime-messages.ts
var RUNTIME_MESSAGE_SCHEMA_VERSION = 2;
var runtimeMessageTypes = [
  "user_run_start",
  "assistant_stream_start",
  "assistant_stream_delta",
  "assistant_stream_stop",
  "tool_execution_start",
  "tool_execution_result",
  "plan_update",
  "manual_plan_update",
  "run_status",
  "assistant_response",
  "assistant_final",
  "run_error",
  "run_warning",
  "context_compacted",
  "subagent_start",
  "subagent_complete",
  "session_tabs_update"
];
function isRuntimeMessage(value) {
  if (!value || typeof value !== "object") return false;
  const message = value;
  if (message.schemaVersion !== RUNTIME_MESSAGE_SCHEMA_VERSION) return false;
  if (typeof message.type !== "string") return false;
  if (!runtimeMessageTypes.includes(message.type)) return false;
  if (typeof message.runId !== "string" || !message.runId) return false;
  if (typeof message.sessionId !== "string" || !message.sessionId) return false;
  if (typeof message.timestamp !== "number") return false;
  return true;
}

// packages/extension/sidepanel/ui/core/panel-navigation.ts
var PANEL_SELECTOR = ".right-panel-content";
var setSidebarOpen = (elements, open) => {
  elements.sidebar?.classList.toggle("closed", !open);
  document.body.classList.toggle("sidebar-open", open);
  if (!open) {
    document.body.removeAttribute("data-right-panel");
  }
};
var showRightPanel = (elements, panelName) => {
  const container = elements.rightPanelPanels ?? elements.rightPanel;
  if (!container) return;
  const panels = container.querySelectorAll(PANEL_SELECTOR);
  panels.forEach((panel) => panel.classList.add("hidden"));
  if (!panelName) {
    document.body.removeAttribute("data-right-panel");
    return;
  }
  const targetPanel = container.querySelector(`${PANEL_SELECTOR}[data-panel="${panelName}"]`);
  targetPanel?.classList.remove("hidden");
  document.body.dataset.rightPanel = panelName;
};
var bindSidebarNavigation = (elements, handlers) => {
  elements.openSidebarBtn?.addEventListener("click", () => {
    const sidebar = elements.sidebar;
    if (!sidebar) {
      handlers.onOpen();
      return;
    }
    if (sidebar.classList.contains("closed")) {
      handlers.onOpen();
    } else {
      handlers.onClose();
    }
  });
  elements.closeSidebarBtn?.addEventListener("click", handlers.onClose);
  elements.sidebarScrim?.addEventListener("click", handlers.onClose);
};

// packages/extension/sidepanel/ui/core/panel-core.ts
var debounce = (fn, ms) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};
var resolveTextAreaMaxHeight = (textarea, fallbackHeight) => {
  const computedMaxHeight = Number.parseFloat(getComputedStyle(textarea).maxHeight);
  if (Number.isFinite(computedMaxHeight) && computedMaxHeight > 0) {
    return computedMaxHeight;
  }
  return fallbackHeight;
};
var autoResizeTextArea = (textarea, maxHeight, minHeight = 0) => {
  if (!textarea) return;
  const resolvedMaxHeight = resolveTextAreaMaxHeight(textarea, maxHeight);
  const resolvedMinHeight = Math.min(Math.max(0, minHeight), resolvedMaxHeight);
  textarea.style.height = "auto";
  const nextHeight = Math.min(textarea.scrollHeight, resolvedMaxHeight);
  const clampedHeight = Math.max(nextHeight, resolvedMinHeight);
  textarea.style.height = `${clampedHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > resolvedMaxHeight || clampedHeight >= resolvedMaxHeight ? "auto" : "hidden";
};
SidePanelUI.prototype.init = async function init() {
  try {
    this.setupEventListeners();
    this.setupPlanDrawer();
    this.setupResizeObserver();
    setSidebarOpen(this.elements, false);
    await this.loadSettings();
    await this.initAccountPanel?.();
    await this.loadWorkflows();
    await this.loadHistoryList();
    this.updateStatus("Ready", "success");
    this.updateModelDisplay();
    this.fetchAvailableModels();
    this.updateChatEmptyState?.();
    this.initMascotBubble?.();
  } catch (error) {
    console.error("[Parchi] init() failed:", error);
    this.updateStatus("Initialization failed - check console", "error");
  }
};
SidePanelUI.prototype.setupEventListeners = function setupEventListeners() {
  bindSidebarNavigation(this.elements, {
    onOpen: () => this.openSettingsPanel(),
    onClose: () => this.closeSidebar()
  });
  this.elements.startNewSessionBtn?.addEventListener("click", () => this.startNewSession());
  this.elements.newSessionFab?.addEventListener("click", () => this.startNewSession());
  this.elements.clearHistoryBtn?.addEventListener("click", () => this.clearAllHistory());
  this.elements.historyFab?.addEventListener("click", () => this.openHistoryDrawer());
  this.elements.closeHistoryDrawerBtn?.addEventListener("click", () => this.closeHistoryDrawer());
  this.elements.historyDrawerScrim?.addEventListener("click", () => this.closeHistoryDrawer());
  this.elements.drawerClearHistoryBtn?.addEventListener("click", () => this.clearAllHistory());
  this.elements.drawerNewSessionBtn?.addEventListener("click", () => {
    this.closeHistoryDrawer();
    this.startNewSession();
  });
  this.elements.historySearchInput?.addEventListener("input", debounce(() => {
    const query = (this.elements.historySearchInput?.value || "").trim();
    this.filterHistoryList(query);
  }, 150));
  this.elements.provider?.addEventListener("change", () => {
    this.toggleCustomEndpoint();
    this.updateScreenshotToggleState();
  });
  this.elements.customEndpoint?.addEventListener("input", () => this.validateCustomEndpoint());
  this.elements.temperature?.addEventListener("input", () => {
    if (this.elements.temperatureValue) {
      this.elements.temperatureValue.textContent = this.elements.temperature.value;
    }
  });
  this.elements.newConfigBtn?.addEventListener("click", () => this.createNewConfig());
  this.elements.newProfileInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      this.createNewConfig();
    }
  });
  this.elements.deleteConfigBtn?.addEventListener("click", () => this.deleteConfig());
  this.elements.activeConfig?.addEventListener("change", () => this.switchConfig());
  this.elements.settingsTabSetupBtn?.addEventListener("click", () => this.switchSettingsTab("setup"));
  this.elements.settingsTabOauthBtn?.addEventListener("click", () => this.switchSettingsTab("oauth"));
  this.elements.settingsTabModelBtn?.addEventListener("click", () => this.switchSettingsTab("model"));
  this.elements.settingsTabBrowserBtn?.addEventListener("click", () => this.switchSettingsTab("browser"));
  this.elements.settingsTabNetworkBtn?.addEventListener("click", () => this.switchSettingsTab("network"));
  this.elements.settingsTabPromptBtn?.addEventListener("click", () => this.switchSettingsTab("prompt"));
  this.elements.settingsTabProfilesBtn?.addEventListener("click", () => this.switchSettingsTab("profiles"));
  this.elements.createProfileBtn?.addEventListener("click", () => this.createProfileFromInput());
  this.elements.agentGrid?.addEventListener("click", (event) => {
    const deleteBtn = event.target?.closest(".agent-card-delete");
    if (deleteBtn) {
      event.stopPropagation();
      const profileName = deleteBtn.dataset.deleteProfile;
      if (profileName) this.deleteProfileByName(profileName);
      return;
    }
    const pill = event.target?.closest(".role-pill");
    if (pill) {
      const role = pill.dataset.role;
      const profile = pill.dataset.profile;
      this.assignProfileRole(profile, role);
      return;
    }
    const card = event.target?.closest(".agent-card");
    if (card) {
      const profile = card.dataset.profile;
      this.editProfile(profile);
    }
  });
  this.elements.refreshProfilesBtn?.addEventListener("click", () => this.renderProfileGrid());
  this.elements.enableScreenshots?.addEventListener("change", () => this.updateScreenshotToggleState());
  this.elements.visionProfile?.addEventListener("change", () => {
    this.updateScreenshotToggleState();
    this.updatePromptSections?.();
  });
  this.elements.sendScreenshotsAsImages?.addEventListener("change", () => this.updateScreenshotToggleState());
  this.elements.orchestratorToggle?.addEventListener("change", () => this.updatePromptSections?.());
  this.elements.orchestratorProfile?.addEventListener("change", () => this.updatePromptSections?.());
  this.elements.saveSettingsBtn?.addEventListener("click", () => {
    void this.saveSettings();
  });
  this.elements.saveRelayBtn?.addEventListener("click", async () => {
    await this.persistAllSettings({ silent: false });
    try {
      await chrome.runtime.sendMessage({ type: "relay_reconfigure" });
    } catch {
    }
  });
  this.elements.copyRelayEnvBtn?.addEventListener("click", async () => {
    const rawUrl = String(this.elements.relayUrl?.value || "").trim();
    const token = String(this.elements.relayToken?.value || "").trim();
    if (!rawUrl) {
      this.updateStatus("Enter a relay URL first", "warning");
      return;
    }
    if (!token) {
      this.updateStatus("Enter a relay token first", "warning");
      return;
    }
    let host = "127.0.0.1";
    let port = "17373";
    try {
      const url = new URL(rawUrl);
      host = url.hostname || host;
      port = url.port || port;
    } catch {
      const cleaned = rawUrl.replace(/^https?:\/\//, "");
      const [h, p] = cleaned.split(":");
      if (h) host = h;
      if (p) port = p;
    }
    const text = `export PARCHI_RELAY_TOKEN="${token}"
export PARCHI_RELAY_HOST="${host}"
export PARCHI_RELAY_PORT="${port}"`;
    try {
      await navigator.clipboard.writeText(text);
      this.updateStatus("Relay env vars copied", "success");
    } catch {
      this.updateStatus("Unable to copy relay env vars", "error");
    }
  });
  this.elements.cancelSettingsBtn?.addEventListener("click", () => {
    void this.cancelSettings();
  });
  this.elements.exportSettingsBtn?.addEventListener("click", () => this.exportSettings());
  this.elements.importSettingsBtn?.addEventListener("click", () => {
    this.elements.importSettingsInput?.click();
  });
  this.elements.importSettingsInput?.addEventListener("change", (event) => this.importSettings(event));
  this.elements.sendBtn?.addEventListener("click", () => {
    if (this.elements.composer?.classList.contains("running")) {
      try {
        void chrome.runtime.sendMessage({ type: "stop_run", sessionId: this.sessionId });
      } catch {
      }
      this.stopWatchdog?.();
      this.stopThinkingTimer?.();
      this.stopRunTimer?.();
      this.elements.composer?.classList.remove("running");
      this.pendingTurnDraft = null;
      this.pendingToolCount = 0;
      this.isStreaming = false;
      this.activeToolName = null;
      this.updateActivityState();
      this.finishStreamingMessage();
      this.clearErrorBanner?.();
      this.updateStatus("Stopped", "warning");
    } else {
      this.sendMessage();
    }
  });
  this.elements.userInput?.addEventListener("keydown", (event) => {
    if (this.workflowMenuOpen && this.handleWorkflowKeydown(event)) {
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  });
  const userInput = this.elements.userInput;
  userInput?.addEventListener("input", () => {
    autoResizeTextArea(userInput, 280);
    this.handleWorkflowInput();
  });
  this.elements.systemPrompt?.addEventListener("input", () => {
    autoResizeTextArea(this.elements.systemPrompt, 500, 500);
  });
  this.elements.profileEditorPrompt?.addEventListener("input", () => {
    autoResizeTextArea(this.elements.profileEditorPrompt, 500);
  });
  autoResizeTextArea(userInput, 280);
  autoResizeTextArea(this.elements.systemPrompt, 500, 500);
  autoResizeTextArea(this.elements.profileEditorPrompt, 500);
  this.elements.modelSelect?.addEventListener("change", () => {
    void this.handleModelSelectChange();
  });
  this.elements.fileBtn?.addEventListener("click", () => {
    this.elements.fileInput?.click();
  });
  this.elements.fileInput?.addEventListener("change", (event) => this.handleFileSelection(event));
  this.elements.zoomInBtn?.addEventListener("click", () => this.adjustUiZoom(0.05));
  this.elements.zoomOutBtn?.addEventListener("click", () => this.adjustUiZoom(-0.05));
  this.elements.zoomResetBtn?.addEventListener("click", () => this.applyUiZoom(1));
  this.elements.uiZoom?.addEventListener("input", () => {
    const value = Number.parseFloat(this.elements.uiZoom.value || "1");
    this.applyUiZoom(value);
  });
  this.elements.tabSelectorBtn?.addEventListener("click", () => this.toggleTabSelector());
  this.elements.closeTabSelector?.addEventListener("click", () => this.closeTabSelector());
  this.elements.tabSelectorAddActive?.addEventListener("click", () => this.addActiveTabToSelection());
  this.elements.tabSelectorClear?.addEventListener("click", () => this.clearSelectedTabs());
  const tabBackdrop = this.elements.tabSelector?.querySelector(".modal-backdrop");
  tabBackdrop?.addEventListener("click", () => this.closeTabSelector());
  this.elements.exportBtn?.addEventListener("click", () => this.showExportMenu());
  this.elements.chatMessages?.addEventListener("scroll", () => this.handleChatScroll());
  this.elements.scrollToLatestBtn?.addEventListener("click", () => this.scrollToBottom({ force: true }));
  this.elements.profileEditorProvider?.addEventListener("change", () => this.toggleProfileEditorEndpoint());
  this.elements.profileEditorHeaders?.addEventListener("input", () => this.validateProfileEditorHeaders());
  this.elements.profileEditorTemperature?.addEventListener("input", () => {
    if (this.elements.profileEditorTemperatureValue) {
      this.elements.profileEditorTemperatureValue.textContent = this.elements.profileEditorTemperature.value;
    }
  });
  this.elements.saveProfileBtn?.addEventListener("click", () => this.saveProfileEdits());
  this.elements.refreshProfileJsonBtn?.addEventListener("click", () => this.refreshProfileJsonEditor());
  this.elements.copyProfileJsonBtn?.addEventListener("click", () => this.copyProfileJsonEditor());
  this.elements.applyProfileJsonBtn?.addEventListener("click", () => this.applyProfileJsonEditor());
  this.elements.customHeaders?.addEventListener("input", () => this.validateCustomHeaders());
  chrome.runtime.onMessage.addListener((message) => {
    if (isRuntimeMessage(message)) {
      this.handleRuntimeMessage(message);
    }
  });
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (!changes.relayConnected && !changes.relayLastError) return;
    const next = {};
    if (changes.relayConnected) next.relayConnected = changes.relayConnected.newValue;
    if (changes.relayLastError) next.relayLastError = changes.relayLastError.newValue;
    this.updateRelayStatusFromSettings?.(next);
  });
};
SidePanelUI.prototype.setupResizeObserver = function setupResizeObserver() {
  if (!this.elements.chatMessages || typeof ResizeObserver === "undefined") return;
  this.chatResizeObserver = new ResizeObserver(() => {
    if (this.shouldAutoScroll() && this.isNearBottom) {
      this.scrollToBottom();
    }
  });
  this.chatResizeObserver.observe(this.elements.chatMessages);
};
SidePanelUI.prototype.startWatchdog = function startWatchdog() {
  this.stopWatchdog();
  this._lastRuntimeMessageAt = Date.now();
  this._watchdogTimerId = setInterval(() => {
    const isRunning = this.elements.composer?.classList.contains("running");
    if (!isRunning) {
      this.stopWatchdog();
      return;
    }
    const silence = Date.now() - this._lastRuntimeMessageAt;
    if (silence > 9e4) {
      this.recoverFromStuckState();
    }
  }, 15e3);
};
SidePanelUI.prototype.stopWatchdog = function stopWatchdog() {
  if (this._watchdogTimerId != null) {
    clearInterval(this._watchdogTimerId);
    this._watchdogTimerId = null;
  }
};
SidePanelUI.prototype.recoverFromStuckState = function recoverFromStuckState() {
  this.stopWatchdog();
  this.stopThinkingTimer?.();
  this.stopRunTimer?.();
  this.elements.composer?.classList.remove("running");
  this.pendingTurnDraft = null;
  this.pendingToolCount = 0;
  this.isStreaming = false;
  this.activeToolName = null;
  this.updateActivityState();
  this.finishStreamingMessage();
  this.showErrorBanner("Connection lost \u2014 the background service may have restarted. You can send a new message.", {
    category: "timeout",
    action: "Try sending your message again."
  });
  this.updateStatus("Disconnected", "error");
};
SidePanelUI.prototype.handleRuntimeMessage = function handleRuntimeMessage(message) {
  this._lastRuntimeMessageAt = Date.now();
  if (message?.sessionId && typeof message.sessionId === "string" && message.sessionId !== this.sessionId) {
    return;
  }
  if (message.type === "assistant_stream_start") {
    this.streamingReasoning = "";
    this.handleAssistantStream({ status: "start" });
    return;
  }
  if (message.type === "assistant_stream_delta") {
    if (message.channel === "reasoning") {
      const delta = message.content || "";
      this.streamingReasoning = `${this.streamingReasoning}${delta}`;
      this.latestThinking = this.streamingReasoning;
      if (!this.streamingState) {
        this.startStreamingMessage();
      }
      this.updateStreamReasoning(delta);
      return;
    }
    this.handleAssistantStream({ status: "delta", content: message.content });
    return;
  }
  if (message.type === "assistant_stream_stop") {
    this.handleAssistantStream({ status: "stop" });
    return;
  }
  if (message.type === "run_status") {
    const phase = typeof message.phase === "string" ? message.phase : "";
    if (phase === "stopped" || phase === "failed" || phase === "completed") {
      this.stopWatchdog?.();
      this.stopThinkingTimer?.();
      this.stopRunTimer?.();
      this.elements.composer?.classList.remove("running");
      this.pendingTurnDraft = null;
      this.pendingToolCount = 0;
      this.isStreaming = false;
      this.activeToolName = null;
      this.updateActivityState();
      this.finishStreamingMessage();
    }
    if (phase === "stopped") {
      this.updateStatus(message.note || "Stopped", "warning");
    } else if (phase === "failed") {
      this.updateStatus(message.note || "Failed", "error");
    } else if (phase === "completed") {
      this.updateStatus(message.note || "Ready", "success");
    } else if (phase) {
      this.updateStatus(message.note || phase, "active");
    }
    return;
  }
  if (message.type === "plan_update") {
    this.applyPlanUpdate(message.plan);
    if (!this.isReplayingHistory && this.pendingTurnDraft?.userMessage) {
      const now = Date.now();
      const turnId = message.turnId || `turn-${now}`;
      const existing = this.historyTurnMap.get(turnId);
      const entry = existing || {
        id: turnId,
        startedAt: this.pendingTurnDraft.startedAt,
        userMessage: this.pendingTurnDraft.userMessage,
        plan: null,
        toolEvents: []
      };
      entry.plan = message.plan;
      this.historyTurnMap.set(turnId, entry);
    }
    return;
  }
  if (message.type === "manual_plan_update") {
    this.applyManualPlanUpdate(message.steps);
    return;
  }
  if (message.type === "tool_execution_start") {
    this.pendingToolCount += 1;
    this.clearErrorBanner();
    this.updateActivityState();
    this.activeToolName = message.tool || null;
    const browserTools = [
      "navigate",
      "openTab",
      "click",
      "type",
      "pressKey",
      "scroll",
      "getContent",
      "screenshot",
      "switchTab",
      "focusTab",
      "closeTab",
      "watchVideo",
      "getVideoInfo"
    ];
    let toolTabId = typeof message.args?.tabId === "number" ? message.args.tabId : null;
    if (!toolTabId && browserTools.includes(message.tool)) {
      toolTabId = this.sessionTabsState?.activeTabId ?? null;
    }
    this.setInteractingTab(toolTabId);
    if (!this.streamingState) {
      this.startStreamingMessage();
    }
    if (typeof message.stepIndex === "number") {
      this.ensureStepContainer(message.stepIndex, message.stepTitle);
    }
    if (!this.isReplayingHistory && this.pendingTurnDraft?.userMessage) {
      const now = Date.now();
      const turnId = message.turnId || `turn-${now}`;
      const existing = this.historyTurnMap.get(turnId);
      const entry = existing || {
        id: turnId,
        startedAt: this.pendingTurnDraft.startedAt,
        userMessage: this.pendingTurnDraft.userMessage,
        plan: this.currentPlan || null,
        toolEvents: []
      };
      entry.toolEvents.push({
        type: "tool_execution_start",
        tool: message.tool,
        id: message.id,
        args: message.args,
        stepIndex: message.stepIndex,
        stepTitle: message.stepTitle,
        timestamp: message.timestamp
      });
      this.historyTurnMap.set(turnId, entry);
    }
    this.displayToolExecution(message.tool, message.args, null, message.id);
    return;
  }
  if (message.type === "tool_execution_result") {
    this.pendingToolCount = Math.max(0, this.pendingToolCount - 1);
    this.updateActivityState();
    this.activeToolName = null;
    if (this.pendingToolCount === 0) {
      this.setInteractingTab(null);
    }
    if (!this.streamingState) {
      this.startStreamingMessage();
    }
    if (typeof message.stepIndex === "number") {
      this.ensureStepContainer(message.stepIndex, message.stepTitle);
    }
    if (!this.isReplayingHistory && this.pendingTurnDraft?.userMessage) {
      const now = Date.now();
      const turnId = message.turnId || `turn-${now}`;
      const existing = this.historyTurnMap.get(turnId);
      const entry = existing || {
        id: turnId,
        startedAt: this.pendingTurnDraft.startedAt,
        userMessage: this.pendingTurnDraft.userMessage,
        plan: this.currentPlan || null,
        toolEvents: []
      };
      entry.toolEvents.push({
        type: "tool_execution_result",
        tool: message.tool,
        id: message.id,
        args: message.args,
        result: message.result,
        stepIndex: message.stepIndex,
        stepTitle: message.stepTitle,
        timestamp: message.timestamp
      });
      this.historyTurnMap.set(turnId, entry);
    }
    this.displayToolExecution(message.tool, message.args, message.result, message.id);
    return;
  }
  if (message.type === "assistant_final") {
    if (!this.isReplayingHistory && this.pendingTurnDraft?.userMessage) {
      const now = Date.now();
      const turnId = message.turnId || `turn-${now}`;
      const existing = this.historyTurnMap.get(turnId);
      const entry = existing || {
        id: turnId,
        startedAt: this.pendingTurnDraft.startedAt,
        userMessage: this.pendingTurnDraft.userMessage,
        plan: this.currentPlan || null,
        toolEvents: []
      };
      entry.assistantFinal = {
        content: message.content,
        thinking: message.thinking || null,
        model: message.model || null,
        usage: message.usage || null
      };
      this.historyTurnMap.set(turnId, entry);
    }
    this.displayAssistantMessage(message.content, message.thinking, message.usage, message.model);
    this.appendContextMessages(message.responseMessages, message.content, message.thinking);
    if (message.usage?.inputTokens) {
      this.updateContextUsage(message.usage.inputTokens);
    } else if (message.contextUsage?.approxTokens) {
      this.updateContextUsage(message.contextUsage.approxTokens);
    } else {
      this.updateContextUsage();
    }
    if (!this.isReplayingHistory) {
      this.pendingTurnDraft = null;
    }
    return;
  }
  if (message.type === "context_compacted") {
    this.handleContextCompaction(message);
    return;
  }
  if (message.type === "run_error") {
    this.stopWatchdog?.();
    this.stopThinkingTimer?.();
    this.stopRunTimer?.();
    this.elements.composer?.classList.remove("running");
    this.pendingTurnDraft = null;
    this.pendingToolCount = 0;
    this.isStreaming = false;
    this.activeToolName = null;
    this.updateActivityState();
    this.finishStreamingMessage();
    this.showErrorBanner(message.message, {
      category: message.errorCategory,
      action: message.action
    });
    this.updateStatus("Error", "error");
    return;
  }
  if (message.type === "run_warning") {
    this.showErrorBanner(message.message);
    return;
  }
  if (message.type === "session_tabs_update") {
    this.handleSessionTabsUpdate(message);
    return;
  }
  if (message.type === "subagent_start") {
    this.addSubagent(message.id, message.name, message.tasks);
    this.updateStatus(`Sub-agent "${message.name}" started`, "active");
    return;
  }
  if (message.type === "subagent_complete") {
    const status = message.success ? "completed" : "error";
    this.updateSubagentStatus(message.id, status, message.summary);
    if (message.success) {
      this.updateStatus(`Sub-agent "${message.name || message.id}" completed`, "success");
    } else {
      this.updateStatus(`Sub-agent "${message.name || message.id}" failed`, "error");
    }
    return;
  }
};
SidePanelUI.prototype.appendContextMessages = function appendContextMessages(responseMessages, fallbackContent, fallbackThinking) {
  if (!responseMessages || responseMessages.length === 0) {
    const assistantEntry = createMessage({
      role: "assistant",
      content: fallbackContent || "",
      thinking: fallbackThinking || null
    });
    if (assistantEntry) {
      this.contextHistory.push(assistantEntry);
    }
    return;
  }
  const normalized = normalizeConversationHistory(responseMessages);
  this.contextHistory.push(...normalized);
};
SidePanelUI.prototype.handleContextCompaction = function handleContextCompaction(message) {
  const trimmedCount = Number(message.trimmedCount || 0);
  const preservedCount = Number(message.preservedCount || 0);
  const percent = typeof message.contextUsage?.percent === "number" ? Math.max(0, Math.min(100, Math.round(message.contextUsage.percent))) : null;
  const parts = [
    trimmedCount > 0 ? `${trimmedCount} summarized` : "Context compacted",
    preservedCount > 0 ? `${preservedCount} preserved` : null,
    percent !== null ? `${percent}% after compaction` : null
  ].filter(Boolean);
  if (parts.length > 0) {
    this.updateStatus(`Context compacted: ${parts.join(", ")}`, "success");
  }
  const normalized = normalizeConversationHistory(message.contextMessages);
  this.contextHistory = normalized;
  this.sessionId = message.newSessionId || this.sessionId;
  const summaryText = message.summary || "Context compacted.";
  const summaryEntry = createMessage({
    role: "system",
    content: summaryText,
    meta: {
      kind: "summary",
      summaryOfCount: message.trimmedCount,
      source: "auto"
    }
  });
  if (summaryEntry) {
    this.displayHistory.push(summaryEntry);
    this.displaySummaryMessage(summaryEntry);
  }
  if (message.contextUsage?.approxTokens) {
    this.updateContextUsage(message.contextUsage.approxTokens);
  }
};

// packages/extension/sidepanel/ui/chat/panel-export.ts
SidePanelUI.prototype.showExportMenu = function showExportMenu() {
  const existing = document.getElementById("exportMenu");
  if (existing) {
    existing.remove();
    return;
  }
  const menu = document.createElement("div");
  menu.id = "exportMenu";
  menu.className = "export-menu";
  menu.innerHTML = `
    <div class="export-menu-content">
      <div class="export-menu-header">
        <span>Export</span>
        <button class="export-menu-close" title="Close">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="export-menu-options">
        <button class="export-option" data-action="conversation">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span>
            <strong>Full Conversation</strong>
            <small>Export all messages as markdown</small>
          </span>
        </button>
        <button class="export-option" data-action="response">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          <span>
            <strong>Last Response</strong>
            <small>Export just the last assistant message</small>
          </span>
        </button>
        <button class="export-option" data-action="turns">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
          <span>
            <strong>Detailed Turns</strong>
            <small>Export with tool events and plans</small>
          </span>
        </button>
      </div>
    </div>
  `;
  const btn = this.elements.exportBtn;
  if (btn) {
    const rect = btn.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.bottom = `${window.innerHeight - rect.top + 8}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
  }
  const closeBtn = menu.querySelector(".export-menu-close");
  closeBtn?.addEventListener("click", () => menu.remove());
  menu.querySelectorAll(".export-option").forEach((option) => {
    option.addEventListener("click", () => {
      const action = option.dataset.action;
      menu.remove();
      switch (action) {
        case "conversation":
          this.exportConversationToMarkdown();
          break;
        case "response":
          this.exportLastResponseToMarkdown();
          break;
        case "turns":
          this.exportTurnsToMarkdown();
          break;
      }
    });
  });
  const closeOnOutside = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener("click", closeOnOutside);
    }
  };
  setTimeout(() => document.addEventListener("click", closeOnOutside), 0);
  document.body.appendChild(menu);
};
SidePanelUI.prototype.exportConversationToMarkdown = function exportConversationToMarkdown() {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `conversation-${timestamp}.md`;
  let markdown = "";
  markdown += "# Conversation Export\n\n";
  markdown += `**Exported:** ${(/* @__PURE__ */ new Date()).toLocaleString()}
`;
  markdown += `**Session ID:** ${this.sessionId || "unknown"}

`;
  markdown += "---\n\n";
  if (this.displayHistory && this.displayHistory.length > 0) {
    for (const entry of this.displayHistory) {
      if (entry.role === "user") {
        markdown += "## User\n\n";
        markdown += `${this.extractTextContent(entry.content)}

`;
      } else if (entry.role === "assistant") {
        markdown += "## Assistant\n\n";
        if (entry.thinking) {
          markdown += `<details>
<summary>Thinking</summary>

${entry.thinking}

</details>

`;
        }
        markdown += `${this.extractTextContent(entry.content)}

`;
      } else if (entry.role === "system" && entry.meta?.kind === "summary") {
        markdown += `> **Context Summary:** ${this.extractTextContent(entry.content)}

`;
      }
    }
  }
  if (this.historyTurnMap && this.historyTurnMap.size > 0) {
    markdown += "---\n\n## Tool Events\n\n";
    this.historyTurnMap.forEach((turn, _turnId) => {
      if (turn.toolEvents && turn.toolEvents.length > 0) {
        markdown += `### Turn: ${turn.userMessage?.substring(0, 50) || "Unknown"}...

`;
        for (const event of turn.toolEvents) {
          if (event.type === "tool_execution_start") {
            markdown += `**${event.tool}**`;
            if (event.args && Object.keys(event.args).length > 0) {
              markdown += ` \`${JSON.stringify(event.args).substring(0, 100)}\``;
            }
            markdown += "\n";
          } else if (event.type === "tool_execution_result") {
            const resultPreview = event.result ? JSON.stringify(event.result).substring(0, 200) : "no result";
            markdown += `  \u2192 ${resultPreview}${resultPreview.length >= 200 ? "..." : ""}

`;
          }
        }
      }
    });
  }
  if (this.subagents && this.subagents.size > 0) {
    markdown += "---\n\n## Subagents\n\n";
    this.subagents.forEach((agent, _id) => {
      markdown += `- **${agent.name}** (${agent.status})
`;
      if (agent.tasks && agent.tasks.length > 0) {
        for (const task of agent.tasks) {
          markdown += `  - ${task}
`;
        }
      }
      markdown += "\n";
    });
  }
  if (this.currentPlan && this.currentPlan.steps) {
    markdown += "---\n\n## Plan\n\n";
    for (let i = 0; i < this.currentPlan.steps.length; i++) {
      const step = this.currentPlan.steps[i];
      const checkbox = step.status === "done" ? "[x]" : "[ ]";
      markdown += `${checkbox} ${step.title}
`;
    }
    markdown += "\n";
  }
  if (this.sessionTokenTotals && (this.sessionTokenTotals.inputTokens || this.sessionTokenTotals.outputTokens)) {
    markdown += "---\n\n## Usage Statistics\n\n";
    markdown += `- **Input tokens:** ${this.sessionTokenTotals.inputTokens.toLocaleString()}
`;
    markdown += `- **Output tokens:** ${this.sessionTokenTotals.outputTokens.toLocaleString()}
`;
    markdown += `- **Total tokens:** ${this.sessionTokenTotals.totalTokens.toLocaleString()}
`;
  }
  this.downloadMarkdown(markdown, filename);
};
SidePanelUI.prototype.exportLastResponseToMarkdown = function exportLastResponseToMarkdown() {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `response-${timestamp}.md`;
  let lastAssistant = null;
  if (this.displayHistory && this.displayHistory.length > 0) {
    for (let i = this.displayHistory.length - 1; i >= 0; i--) {
      if (this.displayHistory[i].role === "assistant") {
        lastAssistant = this.displayHistory[i];
        break;
      }
    }
  }
  if (!lastAssistant) {
    this.updateStatus("No assistant response to export", "warning");
    return;
  }
  let markdown = "";
  if (lastAssistant.thinking) {
    markdown += `<details>
<summary>Thinking</summary>

${lastAssistant.thinking}

</details>

`;
  }
  markdown += `${this.extractTextContent(lastAssistant.content)}
`;
  this.downloadMarkdown(markdown, filename);
};
SidePanelUI.prototype.exportTurnsToMarkdown = function exportTurnsToMarkdown() {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `turns-${timestamp}.md`;
  let markdown = "# Conversation Turns\n\n";
  markdown += `**Exported:** ${(/* @__PURE__ */ new Date()).toLocaleString()}

`;
  markdown += "---\n\n";
  if (!this.historyTurnMap || this.historyTurnMap.size === 0) {
    markdown += "No turn data available.\n";
    this.downloadMarkdown(markdown, filename);
    return;
  }
  this.historyTurnMap.forEach((turn, turnId) => {
    markdown += `## Turn ${turnId}

`;
    markdown += `**User:** ${turn.userMessage || "N/A"}

`;
    if (turn.plan && turn.plan.steps) {
      markdown += "### Plan\n\n";
      for (const step of turn.plan.steps) {
        const checkbox = step.status === "done" ? "[x]" : "[ ]";
        markdown += `${checkbox} ${step.title}
`;
      }
      markdown += "\n";
    }
    if (turn.toolEvents && turn.toolEvents.length > 0) {
      markdown += "### Tool Events\n\n";
      markdown += "| Tool | Args | Result |\n";
      markdown += "|------|------|--------|\n";
      for (const event of turn.toolEvents) {
        if (event.type === "tool_execution_result") {
          const argsPreview = event.args ? JSON.stringify(event.args).substring(0, 50).replace(/\|/g, "\\|") : "";
          const resultPreview = event.result ? JSON.stringify(event.result).substring(0, 80).replace(/\|/g, "\\|") : "";
          markdown += `| ${event.tool} | ${argsPreview} | ${resultPreview} |
`;
        }
      }
      markdown += "\n";
    }
    if (turn.assistantFinal) {
      markdown += "### Assistant Response\n\n";
      if (turn.assistantFinal.thinking) {
        markdown += `<details>
<summary>Thinking</summary>

${turn.assistantFinal.thinking}

</details>

`;
      }
      markdown += `${turn.assistantFinal.content || ""}

`;
    }
    markdown += "---\n\n";
  });
  this.downloadMarkdown(markdown, filename);
};
SidePanelUI.prototype.extractTextContent = function extractTextContent(content) {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object") {
        if (part.type === "text" && part.text) return part.text;
        if (part.type === "tool-result") {
          const output = part.output;
          if (output && typeof output === "object") {
            if (output.type === "text" && output.value) return output.value;
            if (output.type === "json") return JSON.stringify(output.value, null, 2);
            return JSON.stringify(output, null, 2);
          }
          return String(output || "");
        }
        return part.text || part.content || "";
      }
      return "";
    }).join("\n");
  }
  return String(content);
};
SidePanelUI.prototype.downloadMarkdown = function downloadMarkdown(content, filename) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
  this.updateStatus(`Exported to ${filename}`, "success");
};

// packages/shared/src/utils/html.ts
var coerce = (value) => value == null ? "" : String(value);
var escapeHtmlBasic = (value) => {
  const text = coerce(value);
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
};
var escapeHtml = (value) => {
  return escapeHtmlBasic(value).replace(/\n/g, "<br>");
};
var escapeAttribute = (value) => {
  return escapeHtmlBasic(value);
};

// packages/shared/src/utils/json.ts
var safeJsonStringify = (value) => {
  try {
    if (value === void 0) return "";
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

// packages/extension/sidepanel/ui/core/panel-helpers.ts
SidePanelUI.prototype.safeJsonStringify = (value) => safeJsonStringify(value);
SidePanelUI.prototype.truncateText = function truncateText(text, limit = 1200) {
  if (!text) return "";
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
};
SidePanelUI.prototype.escapeHtmlBasic = (text) => escapeHtmlBasic(text);
SidePanelUI.prototype.escapeHtml = (text) => escapeHtml(text);
SidePanelUI.prototype.escapeAttribute = (value) => escapeAttribute(value);
SidePanelUI.prototype.createStepContainer = function createStepContainer(stepIndex, title) {
  const el = document.createElement("div");
  el.className = "step-block current";
  el.dataset.stepIndex = String(stepIndex);
  el.innerHTML = `
    <button class="step-header" type="button" aria-expanded="true">
      <span class="step-title">${this.escapeHtmlBasic(`Step ${stepIndex + 1}: ${title}`)}</span>
      <span class="step-meta"></span>
      <span class="step-chevron" aria-hidden="true">\u25BE</span>
    </button>
    <div class="step-content">
      <div class="step-tools"></div>
      <div class="step-body"></div>
    </div>
  `;
  const header = el.querySelector(".step-header");
  header?.addEventListener("click", () => {
    el.classList.toggle("collapsed");
    const expanded = !el.classList.contains("collapsed");
    header.setAttribute("aria-expanded", expanded ? "true" : "false");
  });
  return {
    el,
    toolsEl: el.querySelector(".step-tools") || el,
    bodyEl: el.querySelector(".step-body") || el
  };
};
SidePanelUI.prototype.ensureStepContainer = function ensureStepContainer(stepIndex, stepTitle) {
  if (!this.streamingState?.eventsEl) return null;
  const normalizedIndex = Number.isFinite(stepIndex) ? stepIndex : 0;
  const existing = this.stepTimeline.steps.get(normalizedIndex);
  if (existing) {
    this.setActiveStep(normalizedIndex);
    if (stepTitle) {
      const titleEl = existing.el.querySelector(".step-title");
      if (titleEl) titleEl.textContent = `Step ${normalizedIndex + 1}: ${stepTitle}`;
    }
    return existing;
  }
  const title = stepTitle || `Step ${normalizedIndex + 1}`;
  const created = this.createStepContainer(normalizedIndex, title);
  this.streamingState.eventsEl.appendChild(created.el);
  this.stepTimeline.steps.set(normalizedIndex, created);
  this.setActiveStep(normalizedIndex);
  return created;
};
SidePanelUI.prototype.setActiveStep = function setActiveStep(stepIndex) {
  this.stepTimeline.activeStepIndex = stepIndex;
  const target = this.stepTimeline.steps.get(stepIndex) || null;
  this.stepTimeline.activeStepBody = target?.bodyEl || null;
  this.stepTimeline.steps.forEach((step, idx) => {
    step.el.classList.toggle("current", idx === stepIndex);
  });
};

// packages/extension/sidepanel/ui/history/panel-history.ts
var normalizeStoredSessions = (raw) => {
  if (Array.isArray(raw)) {
    return raw.filter(Boolean);
  }
  if (raw && typeof raw === "object") {
    return Object.values(raw).filter(Boolean);
  }
  return [];
};
var normalizeTranscript = (value) => {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") return Object.values(parsed).filter(Boolean);
      return [];
    } catch {
      return [];
    }
  }
  return [];
};
SidePanelUI.prototype.persistHistory = async function persistHistory() {
  const saveEnabled = this.elements.saveHistory?.value !== "false";
  if (!saveEnabled) return;
  if (!this.displayHistory || this.displayHistory.length === 0) return;
  const now = Date.now();
  const turns = Array.from(this.historyTurnMap.values()).filter((turn) => turn && typeof turn === "object").sort((a, b) => Number(a.startedAt || 0) - Number(b.startedAt || 0));
  const entry = {
    id: this.sessionId,
    startedAt: this.sessionStartedAt,
    updatedAt: now,
    title: this.firstUserMessage || "Session",
    messageCount: this.displayHistory.length,
    transcript: this.displayHistory.slice(-200),
    turns
  };
  try {
    const existing = await chrome.storage.local.get(["chatSessions"]);
    const sessions = normalizeStoredSessions(existing.chatSessions);
    const filtered = sessions.filter((s) => s?.id !== entry.id);
    filtered.unshift(entry);
    const trimmed = filtered.slice(0, 50);
    await chrome.storage.local.set({ chatSessions: trimmed });
    this.loadHistoryList();
  } catch (e) {
    console.error("Failed to persist history:", e);
  }
};
var resolveHistoryContainer = (self) => {
  if (self.elements.historyDrawerItems) return self.elements.historyDrawerItems;
  const el = document.getElementById("historyDrawerItems");
  if (el) {
    self.elements.historyDrawerItems = el;
    return el;
  }
  if (self.elements.historyItems) return self.elements.historyItems;
  const legacy = document.getElementById("historyItems");
  if (legacy) {
    self.elements.historyItems = legacy;
    return legacy;
  }
  return null;
};
SidePanelUI.prototype.loadHistoryList = async function loadHistoryList() {
  const container = resolveHistoryContainer(this);
  if (!container) return;
  const saveEnabled = this.elements.saveHistory?.value !== "false";
  if (!saveEnabled) {
    container.innerHTML = '<div class="history-empty">History is off. Enable "Save History" in Settings to see past chats.</div>';
    return;
  }
  try {
    const { chatSessions } = await chrome.storage.local.get(["chatSessions"]);
    const sessions = normalizeStoredSessions(chatSessions);
    container.innerHTML = "";
    if (!sessions.length) {
      container.innerHTML = '<div class="history-empty">No saved chats yet.</div>';
      return;
    }
    sessions.forEach((session) => {
      const item = document.createElement("div");
      item.className = "history-item";
      item.dataset.title = (session.title || "").toLowerCase();
      const date = new Date(session.updatedAt || session.startedAt || Date.now());
      const transcript = normalizeTranscript(session.transcript);
      const msgCount = session.messageCount || transcript.length || 0;
      const timeAgo = this.formatTimeAgo(date);
      const rawTitle = session.title || "Untitled Session";
      const words = rawTitle.split(/\s+/);
      const truncatedTitle = words.length > 30 ? words.slice(0, 30).join(" ") + "..." : rawTitle;
      item.innerHTML = `
        <div class="history-item-main">
          <div class="history-title">${this.escapeHtml(truncatedTitle)}</div>
          <div class="history-meta">
            <span>${timeAgo}</span>
            <span class="history-meta-dot">\xB7</span>
            <span>${msgCount} messages</span>
          </div>
        </div>
        <button class="history-delete" title="Delete" data-session-id="${session.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;
      item.querySelector(".history-item-main")?.addEventListener("click", () => {
        this.closeHistoryDrawer?.();
        this.loadSession(session);
      });
      item.querySelector(".history-delete")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteSession(session.id);
      });
      container.appendChild(item);
    });
  } catch (e) {
    console.error("Failed to load history:", e);
    container.innerHTML = '<div class="history-empty">Failed to load history.</div>';
  }
};
SidePanelUI.prototype.filterHistoryList = function filterHistoryList(query) {
  const container = resolveHistoryContainer(this);
  if (!container) return;
  const lowerQuery = query.toLowerCase();
  const items = container.querySelectorAll(".history-item");
  items.forEach((item) => {
    const el = item;
    if (!lowerQuery) {
      el.style.display = "";
      return;
    }
    const title = el.dataset.title || "";
    el.style.display = title.includes(lowerQuery) ? "" : "none";
  });
};
SidePanelUI.prototype.loadSession = function loadSession(session) {
  this.switchView("chat");
  this.recordScrollPosition();
  const transcript = normalizeTranscript(session.transcript);
  let turns = normalizeTranscript(session.turns);
  if (turns.length > 0 && transcript.length > 0) {
    const normalizedTranscript = normalizeConversationHistory(transcript);
    const userQueue = normalizedTranscript.filter((msg) => msg.role === "user");
    const assistantQueue = normalizedTranscript.filter((msg) => msg.role === "assistant");
    const takeUser = () => userQueue.shift();
    const takeAssistant = () => assistantQueue.shift();
    turns = turns.map((turn) => {
      const updated = { ...turn };
      if (!updated.userMessage) {
        const userMessage = takeUser();
        if (userMessage) {
          updated.userMessage = typeof userMessage.content === "string" ? userMessage.content : this.safeJsonStringify(userMessage.content);
        }
      }
      if (!updated.assistantFinal?.content) {
        const assistantMessage = takeAssistant();
        if (assistantMessage) {
          updated.assistantFinal = {
            content: typeof assistantMessage.content === "string" ? assistantMessage.content : this.safeJsonStringify(assistantMessage.content),
            thinking: assistantMessage.thinking || null
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
      const suffix = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : String(Date.now());
      this.sessionId = session.id || `session-${suffix}`;
      this.firstUserMessage = session.title || "";
      this.elements.chatMessages.innerHTML = "";
      this.toolCallViews.clear();
      this.resetActivityPanel();
      turns.forEach((turn) => {
        const userText = String(turn.userMessage || "").trim();
        if (userText) {
          this.displayUserMessage(userText);
          const entry = createMessage({ role: "user", content: userText });
          if (entry) {
            this.displayHistory.push(entry);
            this.contextHistory.push(entry);
          }
        }
        if (turn.plan) {
          this.applyPlanUpdate(turn.plan);
        }
        const toolEvents = Array.isArray(turn.toolEvents) ? turn.toolEvents : [];
        toolEvents.forEach((evt) => {
          if (evt && typeof evt === "object" && evt.type === "tool_execution_start") {
            this.handleRuntimeMessage({
              schemaVersion: 2,
              runId: "replay",
              sessionId: this.sessionId,
              turnId: turn.id || "replay",
              timestamp: Number(evt.timestamp || Date.now()),
              type: "tool_execution_start",
              tool: evt.tool,
              id: evt.id,
              args: evt.args || {},
              stepIndex: evt.stepIndex,
              stepTitle: evt.stepTitle
            });
          }
          if (evt && typeof evt === "object" && evt.type === "tool_execution_result") {
            this.handleRuntimeMessage({
              schemaVersion: 2,
              runId: "replay",
              sessionId: this.sessionId,
              turnId: turn.id || "replay",
              timestamp: Number(evt.timestamp || Date.now()),
              type: "tool_execution_result",
              tool: evt.tool,
              id: evt.id,
              args: evt.args || {},
              result: evt.result,
              stepIndex: evt.stepIndex,
              stepTitle: evt.stepTitle
            });
          }
        });
        if (turn.assistantFinal?.content) {
          this.displayAssistantMessage(
            String(turn.assistantFinal.content || ""),
            turn.assistantFinal.thinking || null,
            turn.assistantFinal.usage || null,
            turn.assistantFinal.model || null
          );
        }
      });
      this.updateContextUsage();
      this.updateChatEmptyState();
      this.scrollToBottom({ force: true });
    } finally {
      this.isReplayingHistory = false;
    }
    return;
  }
  if (transcript.length > 0) {
    const normalized = normalizeConversationHistory(transcript || []);
    this.displayHistory = normalized;
    this.contextHistory = normalized;
    const suffix = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : String(Date.now());
    this.sessionId = session.id || `session-${suffix}`;
    this.firstUserMessage = session.title || "";
    this.renderConversationHistory();
    this.updateContextUsage();
  }
};
SidePanelUI.prototype.deleteSession = async function deleteSession(sessionId) {
  try {
    const { chatSessions } = await chrome.storage.local.get(["chatSessions"]);
    const sessions = normalizeStoredSessions(chatSessions);
    const filtered = sessions.filter((s) => s?.id !== sessionId);
    await chrome.storage.local.set({ chatSessions: filtered });
    this.loadHistoryList();
  } catch (e) {
    console.error("Failed to delete session:", e);
  }
};
SidePanelUI.prototype.clearAllHistory = async function clearAllHistory() {
  const now = Date.now();
  if (this._clearHistoryPendingAt && now - this._clearHistoryPendingAt < 3e3) {
    this._clearHistoryPendingAt = 0;
    try {
      await chrome.storage.local.set({ chatSessions: [] });
      this.loadHistoryList();
      this.updateStatus("History cleared", "success");
    } catch (e) {
      console.error("Failed to clear history:", e);
    }
    return;
  }
  this._clearHistoryPendingAt = now;
  this.updateStatus("Click Clear again to confirm", "warning");
};
SidePanelUI.prototype.formatTimeAgo = function formatTimeAgo(date) {
  const now = /* @__PURE__ */ new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 6e4);
  const hours = Math.floor(diff / 36e5);
  const days = Math.floor(diff / 864e5);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};
SidePanelUI.prototype.renderConversationHistory = function renderConversationHistory() {
  this.elements.chatMessages.innerHTML = "";
  this.toolCallViews.clear();
  this.lastChatTurn = null;
  this.resetActivityPanel();
  this.displayHistory.forEach((msg) => {
    if (msg.role === "system" || msg.meta?.kind === "summary") {
      this.displaySummaryMessage(msg);
      return;
    }
    if (msg.role === "user") {
      const messageDiv = document.createElement("div");
      messageDiv.className = "message user";
      messageDiv.innerHTML = `
          <div class="message-header">You</div>
          <div class="message-content">${this.escapeHtml(msg.content || "")}</div>
        `;
      this.elements.chatMessages.appendChild(messageDiv);
    } else if (msg.role === "assistant") {
      const rawContent = typeof msg.content === "string" ? msg.content : this.safeJsonStringify(msg.content);
      const parsed = extractThinking(rawContent, msg.thinking || null);
      const messageDiv = document.createElement("div");
      messageDiv.className = "message assistant";
      let html = `<div class="message-header">Assistant</div>`;
      const showThinking = this.elements.showThinking.value === "true";
      if (parsed.thinking && showThinking) {
        const cleanedThinking = dedupeThinking(parsed.thinking);
        html += `
            <div class="thinking-block collapsed">
              <button class="thinking-header" type="button" aria-expanded="false">
                <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                Thinking
              </button>
              <div class="thinking-content">${this.escapeHtml(cleanedThinking)}</div>
            </div>
          `;
      }
      if (parsed.content && parsed.content.trim() !== "") {
        html += `<div class="message-content markdown-body">${this.renderMarkdown(parsed.content)}</div>`;
      }
      messageDiv.innerHTML = html;
      const thinkingHeader = messageDiv.querySelector(".thinking-header");
      if (thinkingHeader) {
        thinkingHeader.addEventListener("click", () => {
          const block = thinkingHeader.closest(".thinking-block");
          if (!block || block.classList.contains("thinking-hidden")) return;
          block.classList.toggle("collapsed");
          const expanded = !block.classList.contains("collapsed");
          thinkingHeader.setAttribute("aria-expanded", expanded ? "true" : "false");
        });
      }
      this.elements.chatMessages.appendChild(messageDiv);
    }
  });
  this.restoreScrollPosition();
  this.updateChatEmptyState();
};

// packages/extension/sidepanel/ui/chat/panel-markdown.ts
SidePanelUI.prototype.renderMarkdown = function renderMarkdown(text) {
  if (!text) return "";
  const escape = (value = "") => this.escapeHtmlBasic(value);
  const escapeAttr = (value = "") => this.escapeAttribute(value);
  let working = String(text).replace(/\r\n/g, "\n");
  const codeBlocks = [];
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  working = working.replace(codeBlockRegex, (_, lang = "", body = "") => {
    const placeholder = `@@CODE_BLOCK_${codeBlocks.length}@@`;
    const languageClass = lang ? ` class="language-${escapeAttr(lang.toLowerCase())}"` : "";
    codeBlocks.push(`<pre><code${languageClass}>${escape(body)}</code></pre>`);
    return placeholder;
  });
  const tables = [];
  const tableRegex = /(?:^|\n)((?:\|[^\n]*)+\|(?:\n|\r?\n?))+/gm;
  working = working.replace(tableRegex, (match) => {
    const placeholder = `@@TABLE_${tables.length}@@`;
    tables.push(this.renderMarkdownTable(match.trim()));
    return placeholder;
  });
  const applyInline = (value = "") => {
    let html2 = escape(value);
    const inlineCode = [];
    html2 = html2.replace(/`([^`]+)`/g, (_, code2) => {
      const placeholder = `@@INLINECODE${inlineCode.length}@@`;
      inlineCode.push(`<code>${escape(code2)}</code>`);
      return placeholder;
    });
    html2 = html2.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (_, alt, url) => `<img alt="${escape(alt)}" src="${escapeAttr(url)}">`
    );
    html2 = html2.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, label, url) => `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    );
    html2 = html2.replace(
      /(^|[\s(])((?:https?:\/\/|www\.)[^\s<]+[^\s<\.)\],])/gi,
      (_, prefix, rawUrl) => {
        let url = rawUrl;
        let trailing = "";
        while (/[),.\]]$/.test(url)) {
          trailing = url.slice(-1) + trailing;
          url = url.slice(0, -1);
        }
        const href = url.startsWith("http") ? url : `https://${url}`;
        return `${prefix}<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${escape(
          url
        )}</a>${trailing}`;
      }
    );
    html2 = html2.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html2 = html2.replace(/__(.+?)__/g, "<strong>$1</strong>");
    html2 = html2.replace(/~~(.+?)~~/g, "<del>$1</del>");
    html2 = html2.replace(/(?<!\*)\*(?!\s)(.+?)\*(?!\*)/g, "<em>$1</em>");
    html2 = html2.replace(/(?<!_)_(?!\s)(.+?)_(?!_)/g, "<em>$1</em>");
    inlineCode.forEach((codeBlock, index) => {
      const placeholder = `@@INLINECODE${index}@@`;
      html2 = html2.split(placeholder).join(codeBlock);
    });
    return html2;
  };
  const lines = working.split("\n");
  const blocks = [];
  let paragraph = [];
  let inUl = false;
  let inOl = false;
  const closeLists = () => {
    if (inUl) {
      blocks.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      blocks.push("</ol>");
      inOl = false;
    }
  };
  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${applyInline(paragraph.join("\n"))}</p>`);
    paragraph = [];
  };
  for (const rawLine of lines) {
    const line = rawLine;
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeLists();
      continue;
    }
    const placeholderMatch = trimmed.match(/^@@CODE_BLOCK_(\d+)@@$/);
    if (placeholderMatch) {
      flushParagraph();
      closeLists();
      blocks.push(trimmed);
      continue;
    }
    const tableMatch = trimmed.match(/^@@TABLE_(\d+)@@$/);
    if (tableMatch) {
      flushParagraph();
      closeLists();
      blocks.push(trimmed);
      continue;
    }
    if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) {
      flushParagraph();
      closeLists();
      blocks.push("<hr>");
      continue;
    }
    const headingMatch = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeLists();
      const level = headingMatch[1].length;
      blocks.push(`<h${level}>${applyInline(headingMatch[2])}</h${level}>`);
      continue;
    }
    if (/^\s*>\s*/.test(line)) {
      flushParagraph();
      closeLists();
      blocks.push(`<blockquote>${applyInline(line.replace(/^\s*>\s?/, ""))}</blockquote>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      if (inOl) {
        blocks.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        blocks.push("<ul>");
        inUl = true;
      }
      blocks.push(`<li>${applyInline(line.replace(/^\s*[-*]\s+/, ""))}</li>`);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushParagraph();
      if (inUl) {
        blocks.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        blocks.push("<ol>");
        inOl = true;
      }
      blocks.push(`<li>${applyInline(line.replace(/^\s*\d+[.)]\s+/, ""))}</li>`);
      continue;
    }
    paragraph.push(line);
  }
  flushParagraph();
  closeLists();
  let html = blocks.join("");
  codeBlocks.forEach((block, index) => {
    const placeholder = `@@CODE_BLOCK_${index}@@`;
    html = html.split(placeholder).join(block);
  });
  tables.forEach((table, index) => {
    const placeholder = `@@TABLE_${index}@@`;
    html = html.split(placeholder).join(table);
  });
  return html;
};
SidePanelUI.prototype.renderMarkdownTable = function renderMarkdownTable(tableText) {
  const escape = (value = "") => this.escapeHtmlBasic(value);
  const escapeAttr = (value = "") => this.escapeAttribute(value);
  const applyCell = (value = "") => {
    let html2 = escape(value);
    const inlineCode = [];
    html2 = html2.replace(/`([^`]+)`/g, (_, code2) => {
      const ph = `@@TCODE${inlineCode.length}@@`;
      inlineCode.push(`<code>${escape(code2)}</code>`);
      return ph;
    });
    html2 = html2.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_, label, url) => `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
    );
    html2 = html2.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html2 = html2.replace(/__(.+?)__/g, "<strong>$1</strong>");
    html2 = html2.replace(/~~(.+?)~~/g, "<del>$1</del>");
    html2 = html2.replace(/(?<!\*)\*(?!\s)(.+?)\*(?!\*)/g, "<em>$1</em>");
    html2 = html2.replace(/(?<!_)_(?!\s)(.+?)_(?!_)/g, "<em>$1</em>");
    inlineCode.forEach((codeBlock, i) => {
      html2 = html2.split(`@@TCODE${i}@@`).join(codeBlock);
    });
    return html2;
  };
  const lines = tableText.trim().split("\n").filter((line) => line.trim());
  if (lines.length < 2) return `<p>${escape(tableText)}</p>`;
  const headerLine = lines[0];
  const headers = headerLine.split("|").map((cell) => cell.trim()).filter((cell) => cell);
  const separatorLine = lines[1];
  const isSeparator = /^\s*[-:|\s]+$/.test(separatorLine);
  const bodyStartIndex = isSeparator ? 2 : 1;
  const bodyLines = lines.slice(bodyStartIndex);
  if (headers.length === 0) return `<p>${escape(tableText)}</p>`;
  let html = '<div class="table-wrapper"><table class="markdown-table">';
  html += "<thead><tr>";
  headers.forEach((header) => {
    html += `<th>${applyCell(header)}</th>`;
  });
  html += "</tr></thead>";
  if (bodyLines.length > 0) {
    html += "<tbody>";
    bodyLines.forEach((rowLine) => {
      const cells = rowLine.split("|").map((cell) => cell.trim()).filter((cell) => cell);
      if (cells.length > 0) {
        html += "<tr>";
        cells.forEach((cell, idx) => {
          const tag = idx === 0 ? "th" : "td";
          html += `<${tag}>${applyCell(cell)}</${tag}>`;
        });
        for (let i = cells.length; i < headers.length; i++) {
          html += "<td></td>";
        }
        html += "</tr>";
      }
    });
    html += "</tbody>";
  }
  html += "</table></div>";
  return html;
};

// packages/extension/sidepanel/ui/chat/panel-plan.ts
SidePanelUI.prototype.setupPlanDrawer = function setupPlanDrawer() {
  this.elements.planDrawerToggle?.addEventListener("click", (e) => {
    if (e.target.closest(".plan-drawer-actions")) return;
    this.togglePlanDrawer();
  });
  this.elements.planClearBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    this.clearPlan();
  });
};
SidePanelUI.prototype.togglePlanDrawer = function togglePlanDrawer() {
  this.elements.planDrawer?.classList.toggle("collapsed");
};
SidePanelUI.prototype.showPlanDrawer = function showPlanDrawer() {
  this.elements.planDrawer?.classList.remove("hidden");
  this.elements.planDrawer?.classList.remove("collapsed");
};
SidePanelUI.prototype.hidePlanDrawer = function hidePlanDrawer() {
  this.elements.planDrawer?.classList.add("hidden");
};
SidePanelUI.prototype.clearPlan = function clearPlan() {
  this.currentPlan = null;
  this.hidePlanDrawer();
  if (this.elements.planChecklist) {
    this.elements.planChecklist.innerHTML = "";
  }
};
SidePanelUI.prototype.renderPlanDrawer = function renderPlanDrawer(plan) {
  if (!plan || !plan.steps || plan.steps.length === 0) {
    this.hidePlanDrawer();
    return;
  }
  const steps = plan.steps;
  const completedCount = steps.filter((s) => s.status === "done").length;
  const totalCount = steps.length;
  if (this.elements.planStepCount) {
    this.elements.planStepCount.textContent = completedCount === totalCount ? `${totalCount} steps \xB7 Done` : `${completedCount}/${totalCount} steps`;
  }
  if (this.elements.planChecklist) {
    this.elements.planChecklist.innerHTML = steps.map((step, index) => {
      const isDone = step.status === "done";
      const isBlocked = step.status === "blocked";
      const previousStepsDone = steps.slice(0, index).every((s) => s.status === "done");
      const canCheck = !isDone && previousStepsDone && !isBlocked;
      const isCurrent = !isDone && previousStepsDone && !isBlocked;
      const itemClass = [
        "plan-checklist-item",
        isDone ? "completed" : "",
        isCurrent ? "current" : "",
        isBlocked ? "blocked" : ""
      ].filter(Boolean).join(" ");
      const checkboxClass = ["plan-checklist-checkbox", isDone ? "checked" : ""].filter(Boolean).join(" ");
      const notes = step.notes ? `<div class="plan-checklist-notes">${this.escapeHtml(step.notes)}</div>` : "";
      return `
          <li class="${itemClass}" data-step-index="${index}" data-step-id="${step.id}">
            <button
              class="${checkboxClass}"
              ${!canCheck && !isDone ? "disabled" : ""}
              data-action="toggle-step"
              data-step-index="${index}"
              title="${isDone ? "Completed" : canCheck ? "Mark as done" : "Complete previous steps first"}"
            ></button>
            <div class="plan-checklist-content">
              <div class="plan-checklist-title">${this.escapeHtml(step.title)}</div>
              ${notes}
            </div>
          </li>
        `;
    }).join("");
    this.elements.planChecklist.querySelectorAll('[data-action="toggle-step"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = Number.parseInt(btn.dataset.stepIndex || "0", 10);
        this.togglePlanStep(index);
      });
    });
  }
  this.showPlanDrawer();
};
SidePanelUI.prototype.togglePlanStep = function togglePlanStep(index) {
  if (!this.currentPlan || !this.currentPlan.steps[index]) return;
  const step = this.currentPlan.steps[index];
  const previousStepsDone = this.currentPlan.steps.slice(0, index).every((s) => s.status === "done");
  if (!previousStepsDone && step.status !== "done") {
    this.updateStatus("Complete previous steps first", "warning");
    return;
  }
  if (step.status === "done") {
    for (let i = index; i < this.currentPlan.steps.length; i++) {
      if (this.currentPlan.steps[i].status === "done") {
        this.currentPlan.steps[i].status = "pending";
      }
    }
  } else {
    step.status = "done";
  }
  this.currentPlan.updatedAt = Date.now();
  this.renderPlanDrawer(this.currentPlan);
};

// packages/extension/sidepanel/ui/settings/panel-profiles.ts
var parseHeadersJson = (raw) => {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Headers must be a JSON object");
  }
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, value == null ? "" : String(value)]));
};
var formatHeadersJson = (headers) => {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) return "";
  const entries = Object.entries(headers).filter(([_, value]) => value != null && String(value).length > 0);
  if (!entries.length) return "";
  const normalized = Object.fromEntries(entries.map(([key, value]) => [key, String(value)]));
  return JSON.stringify(normalized, null, 2);
};
var resizeProfilePromptInput = (textarea) => {
  if (!textarea) return;
  textarea.style.height = "auto";
  const nextHeight = Math.min(textarea.scrollHeight, 500);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY = textarea.scrollHeight > 500 ? "auto" : "hidden";
};
SidePanelUI.prototype.createNewConfig = async function createNewConfig(name) {
  const inputA = this.elements.newProfileInput;
  const inputB = this.elements.newProfileNameInput;
  const trimmedName = (name || inputA?.value || inputB?.value || "").trim();
  if (!trimmedName) {
    this.updateStatus("Enter a profile name", "warning");
    return;
  }
  if (this.configs[trimmedName]) {
    this.updateStatus("Profile already exists", "warning");
    return;
  }
  if (inputA) inputA.value = "";
  if (inputB) inputB.value = "";
  const current = this.configs[this.currentConfig] || {};
  this.configs[trimmedName] = {
    provider: current.provider || "openai",
    apiKey: current.apiKey || "",
    model: current.model || "gpt-4o",
    customEndpoint: current.customEndpoint || "",
    extraHeaders: current.extraHeaders || {},
    systemPrompt: current.systemPrompt || "",
    temperature: current.temperature ?? 0.7,
    maxTokens: current.maxTokens || 4096,
    contextLimit: current.contextLimit || 2e5,
    timeout: current.timeout || 3e4,
    sendScreenshotsAsImages: current.sendScreenshotsAsImages || false,
    screenshotQuality: current.screenshotQuality || "high",
    streamResponses: current.streamResponses !== false,
    enableScreenshots: current.enableScreenshots || false,
    saveHistory: current.saveHistory !== false,
    showThinking: current.showThinking !== false,
    autoScroll: current.autoScroll !== false,
    confirmActions: current.confirmActions !== false
  };
  this.refreshConfigDropdown();
  this.setActiveConfig(trimmedName, true);
  await this.persistAllSettings({ silent: true });
  this.updateStatus(`Profile "${trimmedName}" created`, "success");
};
SidePanelUI.prototype.deleteConfig = async function deleteConfig() {
  if (this.currentConfig === "default") {
    this.updateStatus("Cannot delete default profile", "warning");
    return;
  }
  await this.deleteProfileByName(this.currentConfig);
};
SidePanelUI.prototype.deleteProfileByName = async function deleteProfileByName(name) {
  if (!name || name === "default") {
    this.updateStatus("Cannot delete default profile", "warning");
    return;
  }
  if (!this.configs[name]) return;
  delete this.configs[name];
  if (this.currentConfig === name) {
    this.currentConfig = "default";
  }
  if (this.profileEditorTarget === name) {
    this.profileEditorTarget = this.currentConfig;
    this.editProfile(this.currentConfig, true);
  }
  this.refreshConfigDropdown();
  this.updateModelDisplay();
  this.setActiveConfig(this.currentConfig, true);
  await this.persistAllSettings({ silent: true });
  this.updateStatus(`Profile "${name}" deleted`, "success");
};
SidePanelUI.prototype.switchConfig = async function switchConfig() {
  const newConfig = this.elements.activeConfig.value;
  if (!this.configs[newConfig]) {
    this.updateStatus("Profile not found", "warning");
    return;
  }
  this.configs[this.currentConfig] = this.collectCurrentFormProfile();
  this.setActiveConfig(newConfig);
  await this.persistAllSettings({ silent: true });
};
SidePanelUI.prototype.refreshConfigDropdown = function refreshConfigDropdown() {
  if (this.elements.activeConfig) {
    this.elements.activeConfig.innerHTML = "";
    Object.keys(this.configs).forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      if (name === this.currentConfig) {
        option.selected = true;
      }
      this.elements.activeConfig.appendChild(option);
    });
  }
  this.refreshProfileSelectors();
  this.updateModelDisplay();
  this.renderProfileGrid();
  this.updateContextUsage();
};
SidePanelUI.prototype.refreshProfileSelectors = function refreshProfileSelectors() {
  const names = Object.keys(this.configs);
  const selects = [this.elements.orchestratorProfile, this.elements.visionProfile];
  selects.forEach((select) => {
    if (!select) return;
    select.innerHTML = '<option value="">Use active config</option>';
    names.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      select.appendChild(option);
    });
    const currentValue = select.value;
    if (!currentValue) return;
    if (!names.includes(currentValue)) {
      select.value = "";
    }
  });
};
SidePanelUI.prototype.renderProfileGrid = function renderProfileGrid() {
  if (!this.elements.agentGrid) return;
  this.elements.agentGrid.innerHTML = "";
  const currentVision = this.elements.visionProfile?.value;
  const currentOrchestrator = this.elements.orchestratorProfile?.value;
  const configs = Object.keys(this.configs);
  if (!configs.length) {
    this.elements.agentGrid.innerHTML = '<div class="history-empty">No profiles yet.</div>';
    return;
  }
  configs.forEach((name) => {
    const card = document.createElement("div");
    card.className = "agent-card";
    if (name === this.profileEditorTarget) {
      card.classList.add("editing");
    }
    card.dataset.profile = name;
    const rolePills = ["main", "vision", "orchestrator", "aux"].map((role) => {
      const isActive = this.isProfileActiveForRole(name, role, currentVision, currentOrchestrator);
      const label = this.getRoleLabel(role);
      return `<span class="role-pill ${isActive ? "active" : ""} ${role}-pill" data-role="${role}" data-profile="${name}">${label}</span>`;
    }).join("");
    const config = this.configs[name] || {};
    const deleteBtn = name !== "default" ? `<button class="agent-card-delete" data-delete-profile="${this.escapeHtml(name)}" title="Delete profile">&times;</button>` : "";
    card.innerHTML = `
        <div class="agent-card-header">
          <div>
            <h4>${this.escapeHtml(name)}</h4>
            <span>${this.escapeHtml(config.provider || "Provider")} \xB7 ${this.escapeHtml(config.model || "Model")}</span>
          </div>
          ${deleteBtn}
        </div>
        <div class="role-pills">${rolePills}</div>
      `;
    this.elements.agentGrid.appendChild(card);
  });
};
SidePanelUI.prototype.getRoleLabel = function getRoleLabel(role) {
  switch (role) {
    case "main":
      return "Main";
    case "vision":
      return "Vision";
    case "orchestrator":
      return "Orchestrator";
    default:
      return "Team";
  }
};
SidePanelUI.prototype.isProfileActiveForRole = function isProfileActiveForRole(name, role, visionName, orchestratorName) {
  if (role === "main") return name === this.currentConfig;
  if (role === "vision") return name && visionName === name;
  if (role === "orchestrator") return name && orchestratorName === name;
  if (role === "aux") return this.auxAgentProfiles.includes(name);
  return false;
};
SidePanelUI.prototype.assignProfileRole = function assignProfileRole(profileName, role) {
  if (!profileName) return;
  if (role === "main") {
    this.setActiveConfig(profileName);
    return;
  }
  if (role === "vision") {
    this.toggleProfileRole("visionProfile", profileName);
  } else if (role === "orchestrator") {
    this.toggleProfileRole("orchestratorProfile", profileName);
  } else if (role === "aux") {
    this.toggleAuxProfile(profileName);
  }
};
SidePanelUI.prototype.toggleProfileRole = function toggleProfileRole(elementId, profileName) {
  const element = this.elements[elementId];
  if (!element) return;
  element.value = element.value === profileName ? "" : profileName;
  this.renderProfileGrid();
};
SidePanelUI.prototype.toggleAuxProfile = function toggleAuxProfile(profileName) {
  const idx = this.auxAgentProfiles.indexOf(profileName);
  if (idx === -1) {
    this.auxAgentProfiles.push(profileName);
  } else {
    this.auxAgentProfiles.splice(idx, 1);
  }
  this.auxAgentProfiles = Array.from(new Set(this.auxAgentProfiles));
  this.renderProfileGrid();
};
SidePanelUI.prototype.editProfile = function editProfile(name, silent = false) {
  if (!name || !this.configs[name]) return;
  this.profileEditorTarget = name;
  const config = this.configs[name];
  if (this.elements.profileEditorTitle) this.elements.profileEditorTitle.textContent = `Editing: ${name}`;
  if (this.elements.profileEditorName) this.elements.profileEditorName.value = name;
  if (this.elements.profileEditorProvider) this.elements.profileEditorProvider.value = config.provider || "openai";
  if (this.elements.profileEditorApiKey) this.elements.profileEditorApiKey.value = config.apiKey || "";
  if (this.elements.profileEditorModel) this.elements.profileEditorModel.value = config.model || "";
  if (this.elements.profileEditorEndpoint) this.elements.profileEditorEndpoint.value = config.customEndpoint || "";
  if (this.elements.profileEditorHeaders)
    this.elements.profileEditorHeaders.value = formatHeadersJson(config.extraHeaders) || "";
  if (this.elements.profileEditorTemperature) {
    this.elements.profileEditorTemperature.value = config.temperature ?? 0.7;
    if (this.elements.profileEditorTemperatureValue) {
      this.elements.profileEditorTemperatureValue.textContent = this.elements.profileEditorTemperature.value;
    }
  }
  if (this.elements.profileEditorMaxTokens) this.elements.profileEditorMaxTokens.value = config.maxTokens || 2048;
  if (this.elements.profileEditorContextLimit)
    this.elements.profileEditorContextLimit.value = config.contextLimit || 2e5;
  if (this.elements.profileEditorTimeout) this.elements.profileEditorTimeout.value = config.timeout || 3e4;
  if (this.elements.profileEditorEnableScreenshots)
    this.elements.profileEditorEnableScreenshots.value = config.enableScreenshots ? "true" : "false";
  if (this.elements.profileEditorSendScreenshots)
    this.elements.profileEditorSendScreenshots.value = config.sendScreenshotsAsImages ? "true" : "false";
  if (this.elements.profileEditorScreenshotQuality)
    this.elements.profileEditorScreenshotQuality.value = config.screenshotQuality || "high";
  if (this.elements.profileEditorShowThinking)
    this.elements.profileEditorShowThinking.value = config.showThinking !== false ? "true" : "false";
  if (this.elements.profileEditorStreamResponses)
    this.elements.profileEditorStreamResponses.value = config.streamResponses !== false ? "true" : "false";
  if (this.elements.profileEditorAutoScroll)
    this.elements.profileEditorAutoScroll.value = config.autoScroll !== false ? "true" : "false";
  if (this.elements.profileEditorConfirmActions)
    this.elements.profileEditorConfirmActions.value = config.confirmActions !== false ? "true" : "false";
  if (this.elements.profileEditorSaveHistory)
    this.elements.profileEditorSaveHistory.value = config.saveHistory !== false ? "true" : "false";
  if (this.elements.profileEditorPrompt)
    this.elements.profileEditorPrompt.value = config.systemPrompt || this.getDefaultSystemPrompt();
  resizeProfilePromptInput(this.elements.profileEditorPrompt);
  this.toggleProfileEditorEndpoint();
  this.refreshProfileJsonEditor?.();
  this.renderProfileGrid();
  if (!silent) {
    this.switchSettingsTab("profiles");
  }
};
SidePanelUI.prototype.collectProfileEditorData = function collectProfileEditorData() {
  return {
    provider: this.elements.profileEditorProvider.value,
    apiKey: this.elements.profileEditorApiKey.value,
    model: this.elements.profileEditorModel.value,
    customEndpoint: this.elements.profileEditorEndpoint.value,
    extraHeaders: (() => {
      const raw = this.elements.profileEditorHeaders?.value || "";
      if (!raw.trim()) return {};
      try {
        return parseHeadersJson(raw);
      } catch {
        return {};
      }
    })(),
    temperature: Number.parseFloat(this.elements.profileEditorTemperature.value) || 0.7,
    maxTokens: Number.parseInt(this.elements.profileEditorMaxTokens.value) || 2048,
    contextLimit: Number.parseInt(this.elements.profileEditorContextLimit?.value || "") || 2e5,
    timeout: Number.parseInt(this.elements.profileEditorTimeout.value) || 3e4,
    enableScreenshots: this.elements.profileEditorEnableScreenshots.value === "true",
    sendScreenshotsAsImages: this.elements.profileEditorSendScreenshots.value === "true",
    screenshotQuality: this.elements.profileEditorScreenshotQuality.value || "high",
    showThinking: this.elements.profileEditorShowThinking?.value !== "false",
    streamResponses: this.elements.profileEditorStreamResponses?.value !== "false",
    autoScroll: this.elements.profileEditorAutoScroll?.value !== "false",
    confirmActions: this.elements.profileEditorConfirmActions?.value !== "false",
    saveHistory: this.elements.profileEditorSaveHistory?.value !== "false",
    systemPrompt: this.elements.profileEditorPrompt.value || this.getDefaultSystemPrompt()
  };
};
SidePanelUI.prototype.saveProfileEdits = async function saveProfileEdits() {
  const target = this.profileEditorTarget;
  if (!target || !this.configs[target]) {
    this.updateStatus("Select a profile to edit", "warning");
    return;
  }
  if (!this.validateProfileEditorHeaders?.()) {
    this.updateStatus("Invalid headers JSON", "error");
    return;
  }
  const newName = (this.elements.profileEditorName?.value || "").trim();
  const isRename = newName && newName !== target;
  if (isRename) {
    if (!newName) {
      this.updateStatus("Profile name cannot be empty", "warning");
      return;
    }
    if (this.configs[newName]) {
      this.updateStatus(`Profile "${newName}" already exists`, "warning");
      return;
    }
    if (target === "default") {
      this.updateStatus("Cannot rename the default profile", "warning");
      return;
    }
  }
  const existing = this.configs[target] || {};
  const updated = { ...existing, ...this.collectProfileEditorData() };
  if (isRename) {
    this.configs[newName] = updated;
    delete this.configs[target];
    if (this.currentConfig === target) this.currentConfig = newName;
    this.profileEditorTarget = newName;
    if (this.elements.visionProfile?.value === target) this.elements.visionProfile.value = newName;
    if (this.elements.orchestratorProfile?.value === target) this.elements.orchestratorProfile.value = newName;
    const auxIdx = this.auxAgentProfiles.indexOf(target);
    if (auxIdx !== -1) this.auxAgentProfiles[auxIdx] = newName;
    if (this.elements.profileEditorTitle) this.elements.profileEditorTitle.textContent = `Editing: ${newName}`;
    this.refreshConfigDropdown();
    await this.persistAllSettings({ silent: true });
    this.updateStatus(`Profile renamed to "${newName}"`, "success");
  } else {
    this.configs[target] = updated;
    await this.persistAllSettings({ silent: true });
    if (target === this.currentConfig) {
      this.populateFormFromConfig(this.configs[target]);
      this.toggleCustomEndpoint();
    }
    this.renderProfileGrid();
    this.updateStatus(`Profile "${target}" saved`, "success");
  }
};
SidePanelUI.prototype.populateFormFromConfig = function populateFormFromConfig(config = {}) {
  if (this.elements.provider) this.elements.provider.value = config.provider || "openai";
  if (this.elements.apiKey) this.elements.apiKey.value = config.apiKey || "";
  if (this.elements.model) this.elements.model.value = config.model || "gpt-4o";
  if (this.elements.customEndpoint) this.elements.customEndpoint.value = config.customEndpoint || "";
  if (this.elements.customHeaders) this.elements.customHeaders.value = formatHeadersJson(config.extraHeaders) || "";
  if (this.elements.systemPrompt)
    this.elements.systemPrompt.value = config.systemPrompt || this.getDefaultSystemPrompt();
  if (this.elements.temperature) {
    this.elements.temperature.value = config.temperature !== void 0 ? config.temperature : 0.7;
    if (this.elements.temperatureValue) {
      this.elements.temperatureValue.textContent = this.elements.temperature.value;
    }
  }
  if (this.elements.maxTokens) this.elements.maxTokens.value = config.maxTokens || 4096;
  if (this.elements.contextLimit) this.elements.contextLimit.value = config.contextLimit || 2e5;
  if (this.elements.timeout) this.elements.timeout.value = config.timeout || 3e4;
  if (this.elements.enableScreenshots)
    this.elements.enableScreenshots.value = config.enableScreenshots ? "true" : "false";
  if (this.elements.sendScreenshotsAsImages)
    this.elements.sendScreenshotsAsImages.value = config.sendScreenshotsAsImages ? "true" : "false";
  if (this.elements.screenshotQuality) this.elements.screenshotQuality.value = config.screenshotQuality || "high";
  if (this.elements.streamResponses)
    this.elements.streamResponses.value = config.streamResponses !== false ? "true" : "false";
  if (this.elements.showThinking) this.elements.showThinking.value = config.showThinking !== false ? "true" : "false";
  if (this.elements.autoScroll) this.elements.autoScroll.value = config.autoScroll !== false ? "true" : "false";
  if (this.elements.confirmActions)
    this.elements.confirmActions.value = config.confirmActions !== false ? "true" : "false";
  if (this.elements.saveHistory) this.elements.saveHistory.value = config.saveHistory !== false ? "true" : "false";
};
SidePanelUI.prototype.setActiveConfig = function setActiveConfig(name, quiet = false) {
  if (!this.configs[name]) return;
  this.currentConfig = name;
  if (this.elements.activeConfig) this.elements.activeConfig.value = name;
  this.populateFormFromConfig(this.configs[name]);
  this.toggleCustomEndpoint();
  this.renderProfileGrid?.();
  this.updateScreenshotToggleState?.();
  this.editProfile?.(name, true);
  this.fetchAvailableModels();
  if (!quiet) {
    this.updateStatus(`Switched to "${name}"`, "success");
  }
};
SidePanelUI.prototype.refreshProfileJsonEditor = function refreshProfileJsonEditor() {
  if (!this.elements.profileJsonEditor) return;
  const target = this.profileEditorTarget || this.currentConfig;
  const config = this.configs[target] || {};
  this.elements.profileJsonEditor.value = JSON.stringify(config, null, 2);
};
SidePanelUI.prototype.copyProfileJsonEditor = async function copyProfileJsonEditor() {
  if (!this.elements.profileJsonEditor) return;
  const text = this.elements.profileJsonEditor.value || "";
  if (!text.trim()) {
    this.updateStatus("Profile JSON is empty", "warning");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    this.updateStatus("Profile JSON copied", "success");
  } catch {
    this.updateStatus("Unable to copy profile JSON", "error");
  }
};
SidePanelUI.prototype.applyProfileJsonEditor = async function applyProfileJsonEditor() {
  if (!this.elements.profileJsonEditor) return;
  const target = this.profileEditorTarget || this.currentConfig;
  if (!target || !this.configs[target]) {
    this.updateStatus("Select a profile to edit", "warning");
    return;
  }
  const raw = this.elements.profileJsonEditor.value || "";
  if (!raw.trim()) {
    this.updateStatus("Paste profile JSON first", "warning");
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    this.updateStatus("Invalid JSON format", "error");
    return;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    this.updateStatus("Profile JSON must be an object", "error");
    return;
  }
  const existing = this.configs[target] || {};
  if (parsed.extraHeaders && typeof parsed.extraHeaders === "string") {
    try {
      parsed.extraHeaders = parseHeadersJson(parsed.extraHeaders);
    } catch {
      parsed.extraHeaders = existing.extraHeaders || {};
    }
  }
  this.configs[target] = { ...existing, ...parsed };
  await this.persistAllSettings({ silent: true });
  this.editProfile(target, true);
  if (target === this.currentConfig) {
    this.populateFormFromConfig(this.configs[target]);
  }
  this.updateStatus(`Profile "${target}" updated`, "success");
};

// packages/extension/sidepanel/ui/core/panel-scroll.ts
SidePanelUI.prototype.scrollToBottom = function scrollToBottom({ force = false } = {}) {
  if (!this.elements.chatMessages) return;
  if (!force && !this.shouldAutoScroll()) return;
  requestAnimationFrame(() => {
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    this.isNearBottom = true;
    this.userScrolledUp = false;
    this.updateScrollButton();
  });
};
SidePanelUI.prototype.shouldAutoScroll = function shouldAutoScroll() {
  const autoScrollEnabled = this.elements.autoScroll?.value !== "false";
  return autoScrollEnabled && !this.userScrolledUp;
};
SidePanelUI.prototype.handleChatScroll = function handleChatScroll() {
  if (!this.elements.chatMessages) return;
  const { scrollTop, scrollHeight, clientHeight } = this.elements.chatMessages;
  const nearBottom = scrollHeight - scrollTop - clientHeight < 60;
  this.isNearBottom = nearBottom;
  this.userScrolledUp = !nearBottom;
  this.recordScrollPosition();
  this.updateScrollButton();
};
SidePanelUI.prototype.recordScrollPosition = function recordScrollPosition() {
  if (!this.elements.chatMessages) return;
  this.scrollPositions.set(this.sessionId, this.elements.chatMessages.scrollTop);
};
SidePanelUI.prototype.restoreScrollPosition = function restoreScrollPosition() {
  if (!this.elements.chatMessages) return;
  const saved = this.scrollPositions.get(this.sessionId);
  if (saved !== void 0) {
    requestAnimationFrame(() => {
      this.elements.chatMessages.scrollTop = saved;
      this.handleChatScroll();
    });
  } else {
    this.scrollToBottom({ force: true });
  }
};
SidePanelUI.prototype.updateScrollButton = function updateScrollButton() {
  if (!this.elements.scrollToLatestBtn) return;
  this.elements.scrollToLatestBtn.classList.toggle("hidden", !this.userScrolledUp);
};

// packages/shared/src/prompts.ts
var DEFAULT_AGENT_SYSTEM_PROMPT = `You are a browser automation agent. You execute tasks by calling tools in a strict sequence.

<rules priority="CRITICAL">
VIOLATIONS CAUSE TASK FAILURE. NO EXCEPTIONS.

   1. NO PLAN = NO ACTION
   You CANNOT call navigate, click, type, scroll, or pressKey without an active plan.
   Your FIRST tool call in a session MUST be set_plan.
   You may call set_plan again later to append more steps to the existing plan.

2. ACTION \u2192 VERIFY \u2192 MARK
   Every browser action MUST be followed by getContent.
   Every completed step MUST be followed by update_plan.
   
3. SEQUENTIAL EXECUTION  
   Complete step N before starting step N+1.
   Never skip update_plan. Never.

4. EVIDENCE ONLY
   Never claim to see content you didn't fetch with getContent.
   Quote actual text from getContent results.

5. TAB AWARENESS
   Prefer existing session tabs. Call describeSessionTabs/getTabs before opening new tabs.
</rules>

<execution_protocol>
\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502  MANDATORY SEQUENCE FOR EVERY STEP                          \u2502
\u2502                                                             \u2502
\u2502  1. CHECK: Read <execution_state> for current step          \u2502
\u2502  2. ACT: Call ONE browser tool for that step                \u2502
\u2502  3. VERIFY: Call getContent (REQUIRED - no exceptions)      \u2502
\u2502  4. MARK: Call update_plan(step_index=N, status="done")     \u2502
\u2502  5. REPEAT: Go to step 1 for next step                      \u2502
\u2502                                                             \u2502
\u2502  \u26A0\uFE0F NEVER skip steps 3 or 4. The system tracks compliance.  \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
</execution_protocol>

<correct_example>
User: "Find the price of AirPods on Apple's website"

\u2705 CORRECT execution:

TURN 1:
set_plan({ steps: [
  { title: "Navigate to apple.com" },
  { title: "Search for AirPods" },
  { title: "Find and extract price" },
  { title: "Report findings" }
]})

TURN 2:
navigate({ url: "https://apple.com" })

TURN 3:
getContent({ mode: "text" })  \u2190 REQUIRED after navigate

TURN 4:
update_plan({ step_index: 0, status: "done" })  \u2190 REQUIRED before step 1

TURN 5:
click({ selector: "button[aria-label='Search']" })

TURN 6:
getContent({ mode: "text" })  \u2190 REQUIRED after click

... and so on, always: action \u2192 getContent \u2192 update_plan
</correct_example>

<wrong_example>
\u274C WRONG - Missing getContent:
navigate({ url: "https://apple.com" })
update_plan({ step_index: 0, status: "done" })  \u2190 ERROR: No getContent!

\u274C WRONG - Missing update_plan:
navigate({ url: "https://apple.com" })
getContent({ mode: "text" })
click({ selector: "..." })  \u2190 ERROR: Didn't mark step 0 done!

\u274C WRONG - No plan:
navigate({ url: "https://apple.com" })  \u2190 ERROR: No plan exists!

\u274C WRONG - Vague plan steps:
set_plan({ steps: [
  { title: "Research AirPods" },      \u2190 Too vague
  { title: "Phase 1: Discovery" },    \u2190 Not an action
  { title: "Gather information" }     \u2190 What information? How?
]})
</wrong_example>

<tools>
PLANNING (use these to manage your task):
  \u2022 set_plan - Create action checklist. MUST BE YOUR FIRST CALL, and can be used again later to append steps.
\u2022 update_plan - Mark step complete. CALL AFTER EACH STEP IS VERIFIED.

BROWSER ACTIONS (require getContent after):
\u2022 navigate - Go to URL
\u2022 click - Click element by CSS selector  
\u2022 type - Enter text into input field
\u2022 pressKey - Press keyboard key (Enter, Tab, Escape)
\u2022 scroll - Scroll page (up/down/top/bottom)

READING (call after every action):
\u2022 getContent - Read page content. REQUIRED after every browser action.
\u2022 screenshot - Capture visible area when screenshot/vision tools are enabled.
\u2022 findHtml - Verify whether a specific HTML snippet exists in the DOM structure.
\u2022 watchVideo - Analyze video on the current page (vision mode only).
\u2022 getVideoInfo - Read duration/state/metadata for page video elements (vision mode only).

TABS:
\u2022 getTabs, switchTab, openTab, closeTab, focusTab, groupTabs
\u2022 ALWAYS check describeSessionTabs/getTabs before openTab unless explicitly required.

ORCHESTRATOR TOOLS (if enabled):
\u2022 spawn_subagent - Launch a focused helper agent with a separate goal/prompt.
\u2022 subagent_complete - Return a sub-agent summary payload.
</tools>

<error_recovery>
If a tool fails:
1. Call getContent to understand current page state
2. Try a different CSS selector
3. Scroll to find the element  
4. Try an alternative approach
5. If stuck, explain what's blocking you

Never give up after one failure. Adapt and retry.
</error_recovery>

<output_format>
During execution: Minimal commentary. Your tool calls are your actions.

After ALL steps are marked done:
**Task:** [What was requested]
**Result:** [What you found, with quotes from getContent]
**Sources:** [URLs you visited]
</output_format>`;

// packages/shared/src/settings.ts
var PARCHI_STORAGE_KEYS = [
  "provider",
  "apiKey",
  "model",
  "customEndpoint",
  "extraHeaders",
  "systemPrompt",
  "temperature",
  "maxTokens",
  "contextLimit",
  "timeout",
  "enableScreenshots",
  "sendScreenshotsAsImages",
  "screenshotQuality",
  "showThinking",
  "streamResponses",
  "autoScroll",
  "confirmActions",
  "saveHistory",
  "toolPermissions",
  "allowedDomains",
  "activeConfig",
  "configs",
  "auxAgentProfiles",
  "useOrchestrator",
  "orchestratorProfile",
  "visionProfile",
  "visionBridge",
  "uiZoom",
  "timelineCollapsed",
  "relayEnabled",
  "relayUrl",
  "relayToken",
  "relayConnected",
  "relayLastConnectedAt",
  "relayLastError",
  "accountModeChoice",
  "convexUrl",
  "convexAccessToken",
  "convexRefreshToken",
  "convexTokenExpiresAt",
  "convexUserId",
  "convexUserEmail",
  "convexSubscriptionPlan",
  "convexSubscriptionStatus",
  "convexSubscriptionCurrentPeriodEnd",
  "convexSubscriptionCheckedAt",
  "theme",
  "workflows"
];

// packages/extension/sidepanel/ui/settings/themes.ts
var THEMES = [
  {
    id: "void",
    name: "Void",
    preview: { bg: "#09090b", accent: "#818cf8", card: "#18181b" },
    vars: {
      "--background": "#09090b",
      "--foreground": "#fafafa",
      "--muted": "#a1a1aa",
      "--muted-dim": "#71717a",
      "--border": "#27272a",
      "--card": "#18181b",
      "--card-hover": "#1f1f23",
      "--accent": "#818cf8",
      "--accent-rgb": "129 140 248",
      "--accent-light": "#a5b4fc",
      "--accent-dark": "#6366f1",
      "--success": "#4ade80",
      "--warning": "#fbbf24",
      "--error": "#f87171"
    }
  },
  {
    id: "ember",
    name: "Ember",
    preview: { bg: "#0f0a07", accent: "#f59e0b", card: "#1a1209" },
    vars: {
      "--background": "#0f0a07",
      "--foreground": "#faf5ef",
      "--muted": "#a8977e",
      "--muted-dim": "#7a6d5a",
      "--border": "#2a2117",
      "--card": "#1a1209",
      "--card-hover": "#231a0f",
      "--accent": "#f59e0b",
      "--accent-rgb": "245 158 11",
      "--accent-light": "#fbbf24",
      "--accent-dark": "#d97706",
      "--success": "#4ade80",
      "--warning": "#fbbf24",
      "--error": "#f87171"
    }
  },
  {
    id: "forest",
    name: "Forest",
    preview: { bg: "#060e08", accent: "#34d399", card: "#0f1a12" },
    vars: {
      "--background": "#060e08",
      "--foreground": "#ecfdf5",
      "--muted": "#86a894",
      "--muted-dim": "#5c7a68",
      "--border": "#1a2e20",
      "--card": "#0f1a12",
      "--card-hover": "#152118",
      "--accent": "#34d399",
      "--accent-rgb": "52 211 153",
      "--accent-light": "#6ee7b7",
      "--accent-dark": "#10b981",
      "--success": "#4ade80",
      "--warning": "#fbbf24",
      "--error": "#f87171"
    }
  },
  {
    id: "ocean",
    name: "Ocean",
    preview: { bg: "#060a10", accent: "#22d3ee", card: "#0c1420" },
    vars: {
      "--background": "#060a10",
      "--foreground": "#ecfeff",
      "--muted": "#7faaba",
      "--muted-dim": "#567a8a",
      "--border": "#162233",
      "--card": "#0c1420",
      "--card-hover": "#121c2a",
      "--accent": "#22d3ee",
      "--accent-rgb": "34 211 238",
      "--accent-light": "#67e8f9",
      "--accent-dark": "#06b6d4",
      "--success": "#4ade80",
      "--warning": "#fbbf24",
      "--error": "#f87171"
    }
  },
  {
    id: "sakura",
    name: "Sakura",
    preview: { bg: "#0d080b", accent: "#f472b6", card: "#1a1017" },
    vars: {
      "--background": "#0d080b",
      "--foreground": "#fdf2f8",
      "--muted": "#b08a9d",
      "--muted-dim": "#7d5f70",
      "--border": "#2d1e28",
      "--card": "#1a1017",
      "--card-hover": "#22161e",
      "--accent": "#f472b6",
      "--accent-rgb": "244 114 182",
      "--accent-light": "#f9a8d4",
      "--accent-dark": "#ec4899",
      "--success": "#4ade80",
      "--warning": "#fbbf24",
      "--error": "#f87171"
    }
  },
  {
    id: "copper",
    name: "Copper",
    preview: { bg: "#0c0908", accent: "#d4845a", card: "#1a1210" },
    vars: {
      "--background": "#0c0908",
      "--foreground": "#f5ebe4",
      "--muted": "#a8917e",
      "--muted-dim": "#7a6b5c",
      "--border": "#2a2018",
      "--card": "#1a1210",
      "--card-hover": "#221916",
      "--accent": "#d4845a",
      "--accent-rgb": "212 132 90",
      "--accent-light": "#e4a580",
      "--accent-dark": "#b86e44",
      "--success": "#4ade80",
      "--warning": "#fbbf24",
      "--error": "#f87171"
    }
  },
  {
    id: "arctic",
    name: "Arctic",
    preview: { bg: "#080a0e", accent: "#7dd3fc", card: "#101418" },
    vars: {
      "--background": "#080a0e",
      "--foreground": "#f0f9ff",
      "--muted": "#94a3b8",
      "--muted-dim": "#64748b",
      "--border": "#1e293b",
      "--card": "#101418",
      "--card-hover": "#171c22",
      "--accent": "#7dd3fc",
      "--accent-rgb": "125 211 252",
      "--accent-light": "#bae6fd",
      "--accent-dark": "#38bdf8",
      "--success": "#4ade80",
      "--warning": "#fbbf24",
      "--error": "#f87171"
    }
  },
  {
    id: "neon",
    name: "Neon",
    preview: { bg: "#030303", accent: "#4ade80", card: "#111111" },
    vars: {
      "--background": "#030303",
      "--foreground": "#e8ffe8",
      "--muted": "#6ba87a",
      "--muted-dim": "#4a7a56",
      "--border": "#1a2a1e",
      "--card": "#111111",
      "--card-hover": "#181818",
      "--accent": "#4ade80",
      "--accent-rgb": "74 222 128",
      "--accent-light": "#86efac",
      "--accent-dark": "#22c55e",
      "--success": "#4ade80",
      "--warning": "#fbbf24",
      "--error": "#f87171"
    }
  },
  {
    id: "dusk",
    name: "Dusk",
    preview: { bg: "#0a090e", accent: "#a78bfa", card: "#141220" },
    vars: {
      "--background": "#0a090e",
      "--foreground": "#f5f3ff",
      "--muted": "#9d92b8",
      "--muted-dim": "#6e6590",
      "--border": "#251f3a",
      "--card": "#141220",
      "--card-hover": "#1a1828",
      "--accent": "#a78bfa",
      "--accent-rgb": "167 139 250",
      "--accent-light": "#c4b5fd",
      "--accent-dark": "#8b5cf6",
      "--success": "#4ade80",
      "--warning": "#fbbf24",
      "--error": "#f87171"
    }
  },
  {
    id: "rust",
    name: "Rust",
    preview: { bg: "#0d0907", accent: "#c2523c", card: "#1a120e" },
    vars: {
      "--background": "#0d0907",
      "--foreground": "#f5ebe6",
      "--muted": "#a08a7e",
      "--muted-dim": "#756358",
      "--border": "#2a1e18",
      "--card": "#1a120e",
      "--card-hover": "#221815",
      "--accent": "#c2523c",
      "--accent-rgb": "194 82 60",
      "--accent-light": "#e0776a",
      "--accent-dark": "#a03828",
      "--success": "#4ade80",
      "--warning": "#fbbf24",
      "--error": "#f87171"
    }
  }
];
var DEFAULT_THEME_ID = "void";
function getThemeById(id) {
  return THEMES.find((t) => t.id === id);
}
function applyTheme(id) {
  const theme = getThemeById(id) || THEMES[0];
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(theme.vars)) {
    root.style.setProperty(prop, value);
  }
}

// packages/extension/sidepanel/ui/settings/panel-settings.ts
var parseHeadersJson2 = (raw) => {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Headers must be a JSON object");
  }
  return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, value == null ? "" : String(value)]));
};
SidePanelUI.prototype.applyUiZoom = function applyUiZoom(value, { persist = true } = {}) {
  const next = Number.isFinite(value) ? value : 1;
  const clamped = Math.min(1.25, Math.max(0.85, next));
  this.uiZoom = clamped;
  document.documentElement.style.setProperty("--ui-zoom", String(clamped));
  if (this.elements.uiZoom) this.elements.uiZoom.value = clamped.toFixed(2);
  if (this.elements.uiZoomValue) this.elements.uiZoomValue.textContent = `${Math.round(clamped * 100)}%`;
  if (persist) {
    chrome.storage.local.set({ uiZoom: clamped }).catch(() => {
    });
  }
};
SidePanelUI.prototype.adjustUiZoom = function adjustUiZoom(delta) {
  const next = (this.uiZoom || 1) + delta;
  this.applyUiZoom(next);
};
SidePanelUI.prototype.cancelSettings = async function cancelSettings() {
  await this.loadSettings();
  this.openChatView?.();
};
SidePanelUI.prototype.toggleCustomEndpoint = function toggleCustomEndpoint() {
  const provider = this.elements.provider?.value;
  const isCustom = provider === "custom" || provider === "kimi";
  if (this.elements.customEndpointGroup) {
    this.elements.customEndpointGroup.classList.toggle("required", isCustom);
  }
  if (this.elements.customEndpoint) {
    if (provider === "kimi") {
      if (!this.elements.customEndpoint.value || this.elements.customEndpoint.value === "https://openrouter.ai/api/v1") {
        this.elements.customEndpoint.value = "https://api.kimi.com/coding";
      }
      this.elements.customEndpoint.placeholder = "https://api.kimi.com/coding";
    } else if (isCustom) {
      this.elements.customEndpoint.placeholder = "https://openrouter.ai/api/v1";
    } else {
      this.elements.customEndpoint.placeholder = "Leave empty for default API URL";
    }
  }
  const modelHint = document.getElementById("modelHint");
  if (modelHint) {
    switch (provider) {
      case "anthropic":
        modelHint.textContent = "Recommended: claude-sonnet-4-20250514";
        break;
      case "openai":
        modelHint.textContent = "Recommended: gpt-4o or gpt-4-turbo";
        break;
      case "kimi":
        modelHint.textContent = "Recommended: kimi-for-coding (or your Kimi model ID)";
        break;
      case "custom":
        modelHint.textContent = "Enter the model ID from your provider";
        break;
      default:
        modelHint.textContent = "";
    }
  }
};
SidePanelUI.prototype.validateCustomEndpoint = function validateCustomEndpoint() {
  if (!this.elements.customEndpoint) return true;
  const url = this.elements.customEndpoint.value.trim();
  if (!url) return true;
  try {
    new URL(url);
    this.elements.customEndpoint.style.borderColor = "";
    return true;
  } catch {
    this.elements.customEndpoint.style.borderColor = "var(--status-error)";
    return false;
  }
};
SidePanelUI.prototype.validateCustomHeaders = function validateCustomHeaders() {
  if (!this.elements.customHeaders) return true;
  const raw = this.elements.customHeaders.value || "";
  if (!raw.trim()) {
    this.elements.customHeaders.style.borderColor = "";
    return true;
  }
  try {
    parseHeadersJson2(raw);
    this.elements.customHeaders.style.borderColor = "";
    return true;
  } catch {
    this.elements.customHeaders.style.borderColor = "var(--status-error)";
    return false;
  }
};
SidePanelUI.prototype.validateProfileEditorHeaders = function validateProfileEditorHeaders() {
  if (!this.elements.profileEditorHeaders) return true;
  const raw = this.elements.profileEditorHeaders.value || "";
  if (!raw.trim()) {
    this.elements.profileEditorHeaders.style.borderColor = "";
    return true;
  }
  try {
    parseHeadersJson2(raw);
    this.elements.profileEditorHeaders.style.borderColor = "";
    return true;
  } catch {
    this.elements.profileEditorHeaders.style.borderColor = "var(--status-error)";
    return false;
  }
};
SidePanelUI.prototype.toggleProfileEditorEndpoint = function toggleProfileEditorEndpoint() {
  if (!this.elements.profileEditorEndpointGroup) return;
  const provider = this.elements.profileEditorProvider?.value;
  this.elements.profileEditorEndpointGroup.style.display = provider === "custom" || provider === "kimi" ? "block" : "none";
};
SidePanelUI.prototype.switchSettingsTab = function switchSettingsTab(tabName = "setup") {
  if (this.currentSettingsTab === "setup" && tabName !== "setup") {
    this.configs[this.currentConfig] = this.collectCurrentFormProfile();
    void this.persistAllSettings({ silent: true });
  }
  this.currentSettingsTab = tabName;
  const tabs = ["setup", "oauth", "model", "browser", "network", "prompt", "profiles"];
  const tabElements = {
    setup: this.elements.settingsTabSetup,
    oauth: this.elements.settingsTabOauth,
    model: this.elements.settingsTabModel,
    browser: this.elements.settingsTabBrowser,
    network: this.elements.settingsTabNetwork,
    prompt: this.elements.settingsTabPrompt,
    profiles: this.elements.settingsTabProfiles
  };
  const btnElements = {
    setup: this.elements.settingsTabSetupBtn,
    oauth: this.elements.settingsTabOauthBtn,
    model: this.elements.settingsTabModelBtn,
    browser: this.elements.settingsTabBrowserBtn,
    network: this.elements.settingsTabNetworkBtn,
    prompt: this.elements.settingsTabPromptBtn,
    profiles: this.elements.settingsTabProfilesBtn
  };
  for (const tab of tabs) {
    const isActive = tab === tabName;
    tabElements[tab]?.classList.toggle("hidden", !isActive);
    btnElements[tab]?.classList.toggle("active", isActive);
    const pane = tabElements[tab]?.querySelector(".settings-tab-pane");
    pane?.classList.toggle("active", isActive);
  }
};
SidePanelUI.prototype.createProfileFromInput = function createProfileFromInput() {
  const name = (this.elements.newProfileNameInput?.value || "").trim();
  if (!name) {
    this.updateStatus("Enter a profile name first", "warning");
    return;
  }
  if (this.configs[name]) {
    this.updateStatus("Profile already exists", "warning");
    return;
  }
  if (this.elements.newProfileNameInput) this.elements.newProfileNameInput.value = "";
  this.createNewConfig(name);
  this.editProfile(name, true);
};
SidePanelUI.prototype.loadSettings = async function loadSettings() {
  let settings = {};
  try {
    settings = await chrome.storage.local.get(PARCHI_STORAGE_KEYS);
  } catch (error) {
    console.error("[Parchi] Failed to load settings from storage:", error);
    this.updateStatus("Failed to load settings", "error");
  }
  const storedConfigs = settings.configs || {};
  const baseConfig = {
    provider: "openai",
    apiKey: "",
    model: "gpt-4o",
    customEndpoint: "",
    extraHeaders: {},
    systemPrompt: this.getDefaultSystemPrompt(),
    temperature: 0.7,
    maxTokens: 4096,
    contextLimit: 2e5,
    timeout: 3e4,
    sendScreenshotsAsImages: false,
    screenshotQuality: "high",
    showThinking: true,
    streamResponses: true,
    autoScroll: true,
    confirmActions: true,
    saveHistory: true,
    enableScreenshots: true
  };
  this.configs = {
    default: { ...baseConfig, ...storedConfigs.default || {} },
    ...storedConfigs
  };
  this.currentConfig = this.configs[settings.activeConfig] ? settings.activeConfig : "default";
  this.auxAgentProfiles = settings.auxAgentProfiles || [];
  this.applyUiZoom(settings.uiZoom ?? 1, { persist: false });
  this.currentTheme = settings.theme || DEFAULT_THEME_ID;
  applyTheme(this.currentTheme);
  this.renderThemeGrid?.();
  if (this.elements.visionBridge)
    this.elements.visionBridge.value = settings.visionBridge !== void 0 ? String(settings.visionBridge) : "true";
  if (this.elements.visionProfile) this.elements.visionProfile.value = settings.visionProfile || "";
  if (this.elements.orchestratorToggle)
    this.elements.orchestratorToggle.value = settings.useOrchestrator !== void 0 ? String(settings.useOrchestrator) : "false";
  if (this.elements.orchestratorProfile) this.elements.orchestratorProfile.value = settings.orchestratorProfile || "";
  if (this.elements.showThinking)
    this.elements.showThinking.value = settings.showThinking !== void 0 ? String(settings.showThinking) : "true";
  if (this.elements.streamResponses)
    this.elements.streamResponses.value = settings.streamResponses !== void 0 ? String(settings.streamResponses) : "true";
  if (this.elements.autoScroll)
    this.elements.autoScroll.value = settings.autoScroll !== void 0 ? String(settings.autoScroll) : "true";
  if (this.elements.confirmActions)
    this.elements.confirmActions.value = settings.confirmActions !== void 0 ? String(settings.confirmActions) : "true";
  if (this.elements.saveHistory)
    this.elements.saveHistory.value = settings.saveHistory !== void 0 ? String(settings.saveHistory) : "true";
  this.timelineCollapsed = settings.timelineCollapsed !== void 0 ? settings.timelineCollapsed !== false : true;
  if (this.elements.relayEnabled)
    this.elements.relayEnabled.value = settings.relayEnabled !== void 0 ? String(settings.relayEnabled) : "false";
  if (this.elements.relayUrl) this.elements.relayUrl.value = settings.relayUrl || "http://127.0.0.1:17373";
  if (this.elements.relayToken) this.elements.relayToken.value = settings.relayToken || "";
  this.updateRelayStatusFromSettings?.(settings);
  const defaultPermissions = {
    read: true,
    interact: true,
    navigate: true,
    tabs: true,
    screenshots: true
  };
  const toolPermissions = {
    ...defaultPermissions,
    ...settings.toolPermissions || {}
  };
  this.toolPermissions = toolPermissions;
  if (this.elements.permissionRead) this.elements.permissionRead.value = String(toolPermissions.read);
  if (this.elements.permissionInteract) this.elements.permissionInteract.value = String(toolPermissions.interact);
  if (this.elements.permissionNavigate) this.elements.permissionNavigate.value = String(toolPermissions.navigate);
  if (this.elements.permissionTabs) this.elements.permissionTabs.value = String(toolPermissions.tabs);
  if (this.elements.permissionScreenshots)
    this.elements.permissionScreenshots.value = String(toolPermissions.screenshots);
  if (this.elements.allowedDomains) this.elements.allowedDomains.value = settings.allowedDomains || "";
  this.refreshConfigDropdown();
  this.setActiveConfig(this.currentConfig, true);
  this.toggleCustomEndpoint();
  this.updateScreenshotToggleState();
  this.editProfile(this.currentConfig, true);
  this.updatePromptSections?.();
  await this.refreshAccountPanel?.({ silent: true });
};
SidePanelUI.prototype.updateRelayStatusFromSettings = function updateRelayStatusFromSettings(settings = {}) {
  const connected = settings.relayConnected === true;
  if (this.elements.relayConnectedBadge) {
    this.elements.relayConnectedBadge.textContent = connected ? "Connected" : "Disconnected";
    this.elements.relayConnectedBadge.classList.toggle("connected", connected);
  }
  if (this.elements.relayLastErrorText) {
    const raw = settings.relayLastError;
    this.elements.relayLastErrorText.textContent = raw ? String(raw) : "";
  }
};
SidePanelUI.prototype.saveSettings = async function saveSettings() {
  if ((this.elements.provider?.value === "custom" || this.elements.provider?.value === "kimi") && !this.validateCustomEndpoint()) {
    this.updateStatus("Invalid custom endpoint URL", "error");
    return;
  }
  if (!this.validateCustomHeaders()) {
    this.updateStatus("Invalid headers JSON", "error");
    return;
  }
  const profile = this.collectCurrentFormProfile();
  this.configs[this.currentConfig] = profile;
  this.savePromptSections?.();
  await this.persistAllSettings();
  this.fetchAvailableModels();
  this.updateStatus("Settings saved successfully", "success");
};
SidePanelUI.prototype.exportSettings = async function exportSettings() {
  try {
    const settings = await chrome.storage.local.get(PARCHI_STORAGE_KEYS);
    const payload = {
      ...settings,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      exportVersion: 1
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `parchi-settings-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    this.updateStatus("Settings export downloaded", "success");
  } catch (error) {
    this.updateStatus("Unable to export settings", "error");
  }
};
SidePanelUI.prototype.importSettings = async function importSettings(event) {
  const input = event?.target;
  const file = input?.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const payload = {};
    PARCHI_STORAGE_KEYS.forEach((key) => {
      if (data[key] !== void 0) {
        payload[key] = data[key];
      }
    });
    if (payload.configs && typeof payload.configs !== "object") {
      throw new Error("Invalid configs payload");
    }
    await chrome.storage.local.set(payload);
    await this.loadSettings();
    this.renderProfileGrid();
    this.updateStatus("Settings imported successfully", "success");
  } catch (error) {
    this.updateStatus("Unable to import settings", "error");
  } finally {
    if (input) input.value = "";
  }
};
SidePanelUI.prototype.collectCurrentFormProfile = function collectCurrentFormProfile() {
  const current = this.configs[this.currentConfig] || {};
  let extraHeaders = current.extraHeaders || {};
  if (this.elements.customHeaders) {
    const raw = this.elements.customHeaders.value || "";
    if (raw.trim().length > 0) {
      try {
        extraHeaders = parseHeadersJson2(raw);
      } catch {
        extraHeaders = current.extraHeaders || {};
      }
    } else {
      extraHeaders = {};
    }
  }
  return {
    provider: this.elements.provider?.value || current.provider || "openai",
    apiKey: this.elements.apiKey?.value || current.apiKey || "",
    model: this.elements.model?.value || current.model || "gpt-4o",
    customEndpoint: this.elements.customEndpoint?.value || current.customEndpoint || "",
    extraHeaders,
    systemPrompt: this.elements.systemPrompt?.value || current.systemPrompt || "",
    temperature: Number.parseFloat(this.elements.temperature?.value) || current.temperature || 0.7,
    maxTokens: Number.parseInt(this.elements.maxTokens?.value) || current.maxTokens || 4096,
    contextLimit: Number.parseInt(this.elements.contextLimit?.value) || current.contextLimit || 2e5,
    timeout: Number.parseInt(this.elements.timeout?.value) || current.timeout || 3e4,
    enableScreenshots: this.elements.enableScreenshots?.value === "true" || current.enableScreenshots || false,
    sendScreenshotsAsImages: this.elements.sendScreenshotsAsImages?.value === "true" || current.sendScreenshotsAsImages || false,
    screenshotQuality: this.elements.screenshotQuality?.value || current.screenshotQuality || "high",
    showThinking: this.elements.showThinking?.value === "true",
    streamResponses: this.elements.streamResponses?.value === "true",
    autoScroll: this.elements.autoScroll?.value === "true",
    confirmActions: this.elements.confirmActions?.value === "true",
    saveHistory: this.elements.saveHistory?.value === "true"
  };
};
SidePanelUI.prototype.collectToolPermissions = function collectToolPermissions() {
  const fallback = this.toolPermissions || {
    read: true,
    interact: true,
    navigate: true,
    tabs: true,
    screenshots: true
  };
  return {
    read: this.elements.permissionRead ? this.elements.permissionRead.value !== "false" : fallback.read !== false,
    interact: this.elements.permissionInteract ? this.elements.permissionInteract.value !== "false" : fallback.interact !== false,
    navigate: this.elements.permissionNavigate ? this.elements.permissionNavigate.value !== "false" : fallback.navigate !== false,
    tabs: this.elements.permissionTabs ? this.elements.permissionTabs.value !== "false" : fallback.tabs !== false,
    screenshots: this.elements.permissionScreenshots ? this.elements.permissionScreenshots.value === "true" : fallback.screenshots !== false
  };
};
SidePanelUI.prototype.persistAllSettings = async function persistAllSettings({ silent = false } = {}) {
  try {
    const activeProfile = this.configs[this.currentConfig] || {};
    const rawRelayUrl = (this.elements.relayUrl?.value || "").trim();
    const normalizedRelayUrl = rawRelayUrl && !rawRelayUrl.includes("://") ? `http://${rawRelayUrl}` : rawRelayUrl;
    const payload = {
      provider: activeProfile.provider || "openai",
      apiKey: activeProfile.apiKey || "",
      model: activeProfile.model || "gpt-4o",
      customEndpoint: activeProfile.customEndpoint || "",
      extraHeaders: activeProfile.extraHeaders || {},
      systemPrompt: activeProfile.systemPrompt || this.getDefaultSystemPrompt(),
      temperature: activeProfile.temperature ?? 0.7,
      maxTokens: activeProfile.maxTokens || 4096,
      contextLimit: activeProfile.contextLimit || 2e5,
      timeout: activeProfile.timeout || 3e4,
      enableScreenshots: activeProfile.enableScreenshots ?? false,
      sendScreenshotsAsImages: activeProfile.sendScreenshotsAsImages ?? false,
      screenshotQuality: activeProfile.screenshotQuality || "high",
      showThinking: activeProfile.showThinking !== false,
      streamResponses: activeProfile.streamResponses !== false,
      autoScroll: activeProfile.autoScroll !== false,
      confirmActions: activeProfile.confirmActions !== false,
      saveHistory: activeProfile.saveHistory !== false,
      visionBridge: this.elements.visionBridge?.value === "true",
      visionProfile: this.elements.visionProfile?.value || "",
      useOrchestrator: this.elements.orchestratorToggle?.value === "true",
      orchestratorProfile: this.elements.orchestratorProfile?.value || "",
      toolPermissions: this.collectToolPermissions(),
      allowedDomains: this.elements.allowedDomains?.value || "",
      auxAgentProfiles: this.auxAgentProfiles,
      uiZoom: this.uiZoom ?? 1,
      theme: this.currentTheme || DEFAULT_THEME_ID,
      relayEnabled: this.elements.relayEnabled?.value === "true",
      relayUrl: normalizedRelayUrl,
      relayToken: this.elements.relayToken?.value || "",
      activeConfig: this.currentConfig,
      configs: this.configs
    };
    await chrome.storage.local.set(payload);
    this.updateContextUsage();
    if (!silent) {
      this.updateStatus("Settings saved successfully", "success");
    }
  } catch (error) {
    console.error("[Parchi] persistAllSettings error:", error);
    if (!silent) {
      this.updateStatus("Failed to save settings", "error");
    }
    throw error;
  }
};
SidePanelUI.prototype.getDefaultSystemPrompt = function getDefaultSystemPrompt() {
  return DEFAULT_AGENT_SYSTEM_PROMPT;
};
SidePanelUI.prototype.renderThemeGrid = function renderThemeGrid() {
  const grid = this.elements.themeGrid;
  if (!grid) return;
  grid.innerHTML = "";
  for (const theme of THEMES) {
    const swatch = document.createElement("button");
    swatch.className = "theme-swatch";
    if (theme.id === this.currentTheme) swatch.classList.add("active");
    swatch.title = theme.name;
    swatch.dataset.themeId = theme.id;
    swatch.innerHTML = `
      <span class="theme-swatch-color" style="background:${theme.preview.bg}; border-color:${theme.preview.accent}">
        <span class="theme-swatch-accent" style="background:${theme.preview.accent}"></span>
      </span>
      <span class="theme-swatch-label">${theme.name}</span>
    `;
    swatch.addEventListener("click", () => this.setTheme(theme.id));
    grid.appendChild(swatch);
  }
};
SidePanelUI.prototype.setTheme = function setTheme(id) {
  this.currentTheme = id;
  applyTheme(id);
  this.renderThemeGrid();
  chrome.storage.local.set({ theme: id }).catch(() => {
  });
};
SidePanelUI.prototype.updateScreenshotToggleState = function updateScreenshotToggleState() {
  if (!this.elements.enableScreenshots) return;
  const wantsScreens = this.elements.enableScreenshots.value === "true";
  const visionProfile = this.elements.visionProfile?.value;
  const provider = this.elements.provider?.value;
  const hasVision = provider && provider !== "custom" || visionProfile;
  const controls = [this.elements.sendScreenshotsAsImages, this.elements.screenshotQuality];
  controls.forEach((ctrl) => {
    if (!ctrl) return;
    ctrl.disabled = !wantsScreens;
    ctrl.parentElement?.classList.toggle("disabled", !wantsScreens);
  });
  if (wantsScreens && !hasVision) {
    this.updateStatus("Enable a vision-capable profile before sending screenshots.", "warning");
  }
};
SidePanelUI.prototype.updatePromptSections = function updatePromptSections() {
  const orchSection = this.elements.orchestratorPromptSection || document.getElementById("orchestratorPromptSection");
  const orchTextarea = this.elements.orchestratorPromptTextarea || document.getElementById("orchestratorPromptTextarea");
  const visSection = this.elements.visionPromptSection || document.getElementById("visionPromptSection");
  const visTextarea = this.elements.visionPromptTextarea || document.getElementById("visionPromptTextarea");
  if (orchSection) this.elements.orchestratorPromptSection = orchSection;
  if (orchTextarea) this.elements.orchestratorPromptTextarea = orchTextarea;
  if (visSection) this.elements.visionPromptSection = visSection;
  if (visTextarea) this.elements.visionPromptTextarea = visTextarea;
  const orchEnabled = this.elements.orchestratorToggle?.value === "true";
  const orchProfileName = this.elements.orchestratorProfile?.value || this.currentConfig;
  if (orchSection) {
    orchSection.classList.toggle("hidden", !orchEnabled);
  }
  if (orchEnabled && orchTextarea) {
    const orchProfile = this.configs[orchProfileName] || {};
    orchTextarea.value = orchProfile.systemPrompt || "";
  }
  const visProfileName = this.elements.visionProfile?.value;
  const visEnabled = !!visProfileName && visProfileName !== "" && visProfileName !== this.currentConfig;
  if (visSection) {
    visSection.classList.toggle("hidden", !visEnabled);
  }
  if (visEnabled && visTextarea) {
    const visProfile = this.configs[visProfileName] || {};
    visTextarea.value = visProfile.systemPrompt || "";
  }
};
SidePanelUI.prototype.savePromptSections = function savePromptSections() {
  const orchEnabled = this.elements.orchestratorToggle?.value === "true";
  if (orchEnabled && this.elements.orchestratorPromptTextarea) {
    const orchProfileName = this.elements.orchestratorProfile?.value || this.currentConfig;
    if (this.configs[orchProfileName]) {
      this.configs[orchProfileName].systemPrompt = this.elements.orchestratorPromptTextarea.value || "";
    }
  }
  const visProfileName = this.elements.visionProfile?.value;
  if (visProfileName && visProfileName !== this.currentConfig && this.elements.visionPromptTextarea) {
    if (this.configs[visProfileName]) {
      this.configs[visProfileName].systemPrompt = this.elements.visionPromptTextarea.value || "";
    }
  }
};

// packages/extension/sidepanel/ui/status/panel-status.ts
SidePanelUI.prototype.updateStatus = function updateStatus(text, type = "default") {
  if (this.elements.statusText) {
    this.elements.statusText.textContent = text;
  }
  const statusDot = document.getElementById("statusDot");
  if (statusDot) {
    statusDot.className = "status-dot";
    if (type === "error") statusDot.classList.add("error");
    else if (type === "warning") statusDot.classList.add("warning");
    else if (type === "active") statusDot.classList.add("active");
  }
  this.updateActivityState();
};
SidePanelUI.prototype.startRunTimer = function startRunTimer() {
  if (this.runTimerId) {
    window.clearInterval(this.runTimerId);
  }
  this.runStartedAt = Date.now();
  const tick = () => {
    this.updateActivityState?.();
  };
  tick();
  this.runTimerId = window.setInterval(tick, 1e3);
};
SidePanelUI.prototype.stopRunTimer = function stopRunTimer() {
  if (this.runTimerId) {
    window.clearInterval(this.runTimerId);
    this.runTimerId = null;
  }
  this.runStartedAt = null;
  this.updateActivityState?.();
};
SidePanelUI.prototype.updateModelDisplay = function updateModelDisplay() {
  if (this.elements.modelSelect) {
    this.elements.modelSelect.value = this.currentConfig;
  }
};
SidePanelUI.prototype.fetchAvailableModels = async function fetchAvailableModels() {
  this.populateModelSelect();
  this.updateModelDisplay();
};
SidePanelUI.prototype.populateModelSelect = function populateModelSelect() {
  let select = this.elements.modelSelect;
  if (!select) {
    select = document.getElementById("modelSelect");
    if (select) {
      this.elements.modelSelect = select;
    }
  }
  if (!select) {
    console.error("[Parchi] modelSelect element not found!");
    return;
  }
  select.innerHTML = "";
  const configNames = Object.keys(this.configs);
  if (configNames.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No profiles";
    select.appendChild(option);
    return;
  }
  for (const name of configNames) {
    const config = this.configs[name];
    const option = document.createElement("option");
    option.value = name;
    const providerIcon = this.getProviderIcon(config.provider);
    const modelShort = this.shortenModelName(config.model || "no-model");
    option.textContent = `${providerIcon} ${config.provider}/${modelShort}`;
    if (name === this.currentConfig) {
      option.selected = true;
    }
    select.appendChild(option);
  }
};
SidePanelUI.prototype.shortenModelName = function shortenModelName(model) {
  if (!model) return "unknown";
  const clean = model.replace(/^claude-/, "").replace(/^gpt-/, "").replace(/^kimi-/, "");
  if (clean.length <= 20) return clean;
  return clean.slice(0, 19) + "\u2026";
};
SidePanelUI.prototype.handleModelSelectChange = async function handleModelSelectChange() {
  const select = this.elements.modelSelect;
  if (!select) return;
  const selectedProfile = select.value;
  if (!selectedProfile || !this.configs[selectedProfile]) return;
  if (selectedProfile === this.currentConfig) return;
  try {
    this.setActiveConfig(selectedProfile, true);
    await this.persistAllSettings({ silent: true });
    this.updateStatus(
      `Switched to ${this.configs[selectedProfile].provider}/${this.configs[selectedProfile].model}`,
      "success"
    );
  } catch (error) {
    console.error("[Parchi] Failed to persist selected profile:", error);
    this.updateStatus("Failed to switch profile", "error");
  }
};
SidePanelUI.prototype.getProviderIcon = function getProviderIcon(provider) {
  const icons = {
    anthropic: "\u{1F152}",
    openai: "\u{1F15E}",
    kimi: "\u{1F15A}",
    custom: "\u2699\uFE0F"
  };
  return icons[provider] || "\u2699\uFE0F";
};

// packages/extension/sidepanel/ui/chat/panel-streaming.ts
var formatElapsed = (elapsedMs) => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1e3));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const minuteLabel = minutes.toString().padStart(1, "0");
  const secondLabel = seconds.toString().padStart(2, "0");
  return `${minuteLabel}:${secondLabel}`;
};
var MASCOT_VERBS = [
  "Vibing",
  "Slaying",
  "Cooking",
  "Grinding",
  "Manifesting",
  "Ghosting",
  "Flexing",
  "Streaming",
  "Hustling",
  "Glazing",
  "Mogging",
  "Coping",
  "Rizzing",
  "Finessing",
  "Fumbling",
  "Binging",
  "Canceling",
  "Yoinking",
  "Simping",
  "Dooming"
];
var _verbIndex = Math.floor(Math.random() * MASCOT_VERBS.length);
var nextVerb = () => {
  _verbIndex = (_verbIndex + 1) % MASCOT_VERBS.length;
  return MASCOT_VERBS[_verbIndex];
};
SidePanelUI.prototype.handleAssistantStream = function handleAssistantStream(event) {
  if (event.status === "start") {
    this.isStreaming = true;
    this.clearErrorBanner();
    this.startStreamingMessage();
    this.startThinkingTimer();
  } else if (event.status === "delta") {
    this.isStreaming = true;
    this.updateStreamingMessage(event.content || "");
  } else if (event.status === "stop") {
    this.isStreaming = false;
    this.completeStreamingMessage();
    this.stopThinkingTimer();
  }
  this.updateActivityState();
};
SidePanelUI.prototype.startThinkingTimer = function startThinkingTimer() {
  if (this.thinkingTimerId) {
    window.clearInterval(this.thinkingTimerId);
  }
  this.thinkingStartedAt = Date.now();
  this._currentVerb = nextVerb();
  let tickCount = 0;
  const updateTimer = () => {
    const elapsed = formatElapsed(Date.now() - (this.thinkingStartedAt || Date.now()));
    tickCount++;
    if (tickCount % 3 === 0) {
      this._currentVerb = nextVerb();
    }
    this.updateStatus(`${this._currentVerb} ${elapsed}`, "active");
    this.updateMascotBubbleContent(this._currentVerb, elapsed);
  };
  updateTimer();
  this.thinkingTimerId = window.setInterval(updateTimer, 1e3);
};
SidePanelUI.prototype.stopThinkingTimer = function stopThinkingTimer() {
  if (this.thinkingTimerId) {
    window.clearInterval(this.thinkingTimerId);
    this.thinkingTimerId = null;
  }
  this.thinkingStartedAt = null;
  this._currentVerb = null;
  const bubbleVerb = document.getElementById("bubbleVerb");
  if (bubbleVerb) bubbleVerb.textContent = "";
};
SidePanelUI.prototype.startStreamingMessage = function startStreamingMessage() {
  if (this.streamingState) return;
  const container = document.createElement("div");
  container.className = "message assistant streaming";
  container.innerHTML = `
      <div class="message-content streaming-content markdown-body">
        <div class="stream-events"></div>
      </div>
    `;
  if (this.lastChatTurn) {
    this.lastChatTurn.appendChild(container);
  } else {
    this.elements.chatMessages.appendChild(container);
  }
  const eventsEl = container.querySelector(".stream-events");
  this.streamingState = {
    container,
    eventsEl,
    lastEventType: void 0,
    textEventEl: null,
    reasoningEventEl: null,
    textBuffer: "",
    reasoningBuffer: "",
    planEl: null,
    planListEl: null,
    planMetaEl: null
  };
  const mascot = document.getElementById("mascotCorner");
  if (mascot) mascot.classList.add("thinking");
  this.updateThinkingPanel(null, true);
  this.scrollToBottom();
};
SidePanelUI.prototype.updateStreamingMessage = function updateStreamingMessage(content) {
  if (!this.streamingState) {
    this.startStreamingMessage();
  }
  if (!this.streamingState?.eventsEl) return;
  if (this.streamingState.lastEventType !== "text") {
    const textEvent = document.createElement("div");
    textEvent.className = "stream-event stream-event-text";
    this.streamingState.eventsEl.appendChild(textEvent);
    this.streamingState.textEventEl = textEvent;
    this.streamingState.textBuffer = "";
    this.streamingState.lastEventType = "text";
  }
  this.streamingState.textBuffer = `${this.streamingState.textBuffer || ""}${content || ""}`;
  if (this.streamingState.textEventEl) {
    const extracted = extractThinking(this.streamingState.textBuffer || "");
    if (extracted.thinking) {
      this.streamingReasoning = extracted.thinking;
      this.updateStreamReasoning(extracted.thinking, true);
    }
    const cleanedText = extracted.content || this.streamingState.textBuffer || "";
    this.streamingState.textEventEl.innerHTML = this.renderMarkdown(cleanedText);
  }
  this.scrollToBottom();
};
SidePanelUI.prototype.completeStreamingMessage = function completeStreamingMessage() {
  if (!this.streamingState?.container) return;
  const indicator = this.streamingState.container.querySelector(".typing-indicator");
  if (indicator) indicator.remove();
  this.streamingState.container.classList.remove("streaming");
  const mascot = document.getElementById("mascotCorner");
  if (mascot) mascot.classList.remove("thinking");
  if (this.streamingReasoning) {
    this.latestThinking = this.streamingReasoning;
  } else {
    this.latestThinking = null;
  }
};
SidePanelUI.prototype.updateStreamReasoning = function updateStreamReasoning(delta, replace = false) {
  if (!this.streamingState?.eventsEl) return;
  if (delta === null || delta === void 0) return;
  if (!delta.trim() && !this.streamingState.reasoningBuffer) return;
  const targetContainer = this.streamingState.eventsEl;
  let reasoningContentEl = targetContainer.querySelector(
    ":scope > .stream-event-reasoning .stream-reasoning-content"
  );
  if (!reasoningContentEl) {
    const reasoningEvent = document.createElement("div");
    reasoningEvent.className = "stream-event stream-event-reasoning";
    reasoningEvent.innerHTML = `
        <div class="stream-reasoning-header">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a10 10 0 1 0 10 10H12V2z"/>
            <path d="M12 2a10 10 0 0 1 10 10"/>
          </svg>
          <span>Thinking...</span>
        </div>
        <div class="stream-reasoning-content"></div>
      `;
    targetContainer.prepend(reasoningEvent);
    reasoningContentEl = reasoningEvent.querySelector(".stream-reasoning-content");
    this.streamingState.reasoningEventEl = reasoningContentEl;
    this.streamingState.reasoningBuffer = "";
    const mascot = document.getElementById("mascotCorner");
    if (mascot) mascot.classList.add("thinking");
  }
  const nextBuffer = replace ? delta : `${this.streamingState.reasoningBuffer || ""}${delta}`;
  this.streamingState.reasoningBuffer = nextBuffer;
  const cleaned = dedupeThinking(nextBuffer);
  if (reasoningContentEl) {
    reasoningContentEl.textContent = cleaned;
  }
  this.scrollToBottom();
};
SidePanelUI.prototype.applyPlanUpdate = function applyPlanUpdate(plan) {
  if (!plan) return;
  this.currentPlan = plan;
  this.renderPlanDrawer(plan);
};
SidePanelUI.prototype.applyManualPlanUpdate = function applyManualPlanUpdate(steps = []) {
  if (!steps || steps.length === 0) return;
  const now = Date.now();
  const normalizedSteps = steps.map((step, index) => {
    const status = step.status === "running" || step.status === "done" || step.status === "blocked" ? step.status : "pending";
    return {
      id: `step-${index + 1}`,
      title: step.title,
      status,
      notes: step.notes
    };
  }).filter((step) => step.title);
  if (!normalizedSteps.length) return;
  this.currentPlan = {
    steps: normalizedSteps,
    createdAt: this.currentPlan?.createdAt || now,
    updatedAt: now
  };
  if (this.currentPlan) {
    this.renderPlanDrawer(this.currentPlan);
  }
};
SidePanelUI.prototype.ensurePlanBlock = function ensurePlanBlock() {
  if (!this.streamingState?.eventsEl) return null;
  if (this.streamingState.planEl) return this.streamingState.planEl;
  const container = document.createElement("div");
  container.className = "plan-block";
  container.innerHTML = `
      <div class="plan-header">
        <span class="plan-title">Plan</span>
        <span class="plan-meta"></span>
      </div>
      <ol class="plan-steps"></ol>
    `;
  const firstChild = this.streamingState.eventsEl.firstChild;
  if (firstChild) {
    this.streamingState.eventsEl.insertBefore(container, firstChild);
  } else {
    this.streamingState.eventsEl.appendChild(container);
  }
  this.streamingState.planEl = container;
  this.streamingState.planListEl = container.querySelector(".plan-steps");
  this.streamingState.planMetaEl = container.querySelector(".plan-meta");
  return container;
};
SidePanelUI.prototype.finishStreamingMessage = function finishStreamingMessage() {
  if (!this.streamingState) return null;
  const streamingThinking = this.streamingReasoning;
  const container = this.streamingState.container;
  this.completeStreamingMessage();
  this.streamingState = null;
  this.isStreaming = false;
  this.updateActivityState();
  return { thinking: streamingThinking, container };
};

// packages/extension/sidepanel/ui/tabs/panel-tabs.ts
SidePanelUI.prototype.handleFileSelection = async function handleFileSelection(event) {
  const input = event.target;
  if (!input) return;
  const files = Array.from(input.files || []);
  if (!files.length) return;
  const maxPerFile = 4e3;
  for (const file of files) {
    try {
      const text = await file.text();
      const trimmed = text.length > maxPerFile ? text.slice(0, maxPerFile) + "\n\u2026 (truncated)" : text;
      const prefix = `

[File: ${file.name}]
`;
      this.elements.userInput.value += prefix + trimmed;
    } catch (e) {
      console.warn("Failed to read file", file.name, e);
    }
  }
  input.value = "";
  this.elements.userInput.focus();
};
SidePanelUI.prototype.toggleTabSelector = async function toggleTabSelector() {
  const isHidden = this.elements.tabSelector.classList.contains("hidden");
  if (isHidden) {
    await this.loadTabs();
    this.updateTabSelectorButton();
    this.elements.tabSelector.classList.remove("hidden");
  } else {
    this.closeTabSelector();
  }
};
SidePanelUI.prototype.closeTabSelector = function closeTabSelector() {
  this.elements.tabSelector.classList.add("hidden");
};
SidePanelUI.prototype.addActiveTabToSelection = async function addActiveTabToSelection() {
  const activeTab = await getActiveTab();
  if (!activeTab || typeof activeTab.id !== "number") return;
  this.selectedTabs.set(activeTab.id, this.buildSelectedTab(activeTab));
  this.updateSelectedTabsBar();
  this.updateTabSelectorButton();
  this.loadTabs();
};
SidePanelUI.prototype.clearSelectedTabs = function clearSelectedTabs() {
  if (this.selectedTabs.size === 0) return;
  this.selectedTabs.clear();
  this.updateSelectedTabsBar();
  this.updateTabSelectorButton();
  this.loadTabs();
};
SidePanelUI.prototype.loadTabs = async function loadTabs() {
  const tabGroupsApi = chrome.tabGroups;
  const [tabs, groups] = await Promise.all([
    chrome.tabs.query({}),
    tabGroupsApi?.query ? tabGroupsApi.query({}) : Promise.resolve([])
  ]);
  this.tabGroupInfo = new Map(groups.map((group) => [group.id, group]));
  this.elements.tabList.innerHTML = "";
  const groupedTabs = /* @__PURE__ */ new Map();
  const ungroupedTabs = [];
  tabs.filter((tab) => typeof tab.id === "number").forEach((tab) => {
    const groupId = typeof tab.groupId === "number" ? tab.groupId : -1;
    if (groupId >= 0) {
      if (!groupedTabs.has(groupId)) groupedTabs.set(groupId, []);
      const bucket = groupedTabs.get(groupId);
      if (bucket) bucket.push(tab);
    } else {
      ungroupedTabs.push(tab);
    }
  });
  const renderGroup = (label, color, groupTabs) => {
    if (!groupTabs.length) return;
    const section = document.createElement("div");
    section.className = "tab-group";
    const allSelected = groupTabs.every((tab) => typeof tab.id === "number" && this.selectedTabs.has(tab.id));
    section.innerHTML = `
        <div class="tab-group-header" style="--group-color: ${color}">
          <div class="tab-group-label">
            <span>${this.escapeHtml(label)}</span>
            <span class="tab-group-count">${groupTabs.length}</span>
          </div>
          <button class="tab-group-toggle" type="button">${allSelected ? "Clear" : "Add all"}</button>
        </div>
      `;
    const toggleBtn = section.querySelector(".tab-group-toggle");
    toggleBtn?.addEventListener("click", (event) => {
      event.stopPropagation();
      this.toggleGroupSelection(groupTabs, !allSelected);
    });
    groupTabs.forEach((tab) => {
      const tabId = tab.id;
      const isSelected = typeof tabId === "number" && this.selectedTabs.has(tabId);
      const item = document.createElement("div");
      item.className = `tab-item${isSelected ? " selected" : ""}`;
      const urlLabel = this.formatTabLabel(tab.url || "");
      item.innerHTML = `
          <div class="tab-item-checkbox"></div>
          <img class="tab-item-favicon" src="${tab.favIconUrl || "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27%23666%27%3E%3Crect width=%2724%27 height=%2724%27 rx=%274%27/%3E%3C/svg%3E"}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27%23666%27%3E%3Crect width=%2724%27 height=%2724%27 rx=%274%27/%3E%3C/svg%3E'">
          <div class="tab-item-text">
            <span class="tab-item-title">${this.escapeHtml(tab.title || "Untitled")}</span>
            ${urlLabel ? `<span class="tab-item-url">${this.escapeHtml(urlLabel)}</span>` : ""}
          </div>
        `;
      item.addEventListener("click", () => this.toggleTabSelection(tab, item));
      section.appendChild(item);
    });
    this.elements.tabList.appendChild(section);
  };
  groupedTabs.forEach((groupTabs, groupId) => {
    const group = this.tabGroupInfo.get(groupId);
    const label = group?.title || `Group ${groupId}`;
    const color = this.mapGroupColor(group?.color);
    renderGroup(label, color, groupTabs);
  });
  renderGroup("Ungrouped", "var(--text-tertiary)", ungroupedTabs);
};
SidePanelUI.prototype.toggleGroupSelection = function toggleGroupSelection(groupTabs, shouldSelect) {
  groupTabs.forEach((tab) => {
    if (typeof tab.id !== "number") return;
    if (shouldSelect) {
      this.selectedTabs.set(tab.id, this.buildSelectedTab(tab));
    } else {
      this.selectedTabs.delete(tab.id);
    }
  });
  this.updateSelectedTabsBar();
  this.updateTabSelectorButton();
  this.loadTabs();
};
SidePanelUI.prototype.toggleTabSelection = function toggleTabSelection(tab, itemElement) {
  if (typeof tab.id !== "number") return;
  if (this.selectedTabs.has(tab.id)) {
    this.selectedTabs.delete(tab.id);
    itemElement.classList.remove("selected");
  } else {
    this.selectedTabs.set(tab.id, this.buildSelectedTab(tab));
    itemElement.classList.add("selected");
  }
  this.updateSelectedTabsBar();
  this.updateTabSelectorButton();
  this.loadTabs();
};
SidePanelUI.prototype.buildSelectedTab = function buildSelectedTab(tab) {
  const groupId = typeof tab.groupId === "number" ? tab.groupId : -1;
  const group = groupId >= 0 ? this.tabGroupInfo.get(groupId) : void 0;
  const hasGroup = groupId >= 0;
  return {
    id: tab.id,
    title: tab.title,
    url: tab.url,
    windowId: tab.windowId,
    groupId: hasGroup ? groupId : -1,
    groupTitle: hasGroup ? group?.title || `Group ${groupId}` : "Ungrouped",
    groupColor: hasGroup ? this.mapGroupColor(group?.color) : "var(--text-tertiary)"
  };
};
SidePanelUI.prototype.updateSelectedTabsBar = function updateSelectedTabsBar() {
  if (this.selectedTabs.size === 0) {
    this.elements.selectedTabsBar.classList.add("hidden");
    return;
  }
  this.elements.selectedTabsBar.classList.remove("hidden");
  this.elements.selectedTabsBar.innerHTML = "";
  const grouped = /* @__PURE__ */ new Map();
  this.selectedTabs.forEach((tab) => {
    const hasGroup = typeof tab.groupId === "number" && tab.groupId >= 0;
    const key = hasGroup ? `group-${tab.groupId}` : "ungrouped";
    if (!grouped.has(key)) grouped.set(key, []);
    const bucket = grouped.get(key);
    if (bucket) bucket.push(tab);
  });
  grouped.forEach((tabs) => {
    const groupTitle = tabs[0]?.groupTitle || "Ungrouped";
    const groupLabel = this.truncateText(groupTitle, 18) || "Ungrouped";
    const groupColor = tabs[0]?.groupColor || "var(--text-tertiary)";
    const groupWrap = document.createElement("div");
    groupWrap.className = "selected-tabs-group";
    groupWrap.innerHTML = `
        <div class="selected-group-label" style="--group-color: ${groupColor}">
          <span>${this.escapeHtml(groupLabel)}</span>
          <span class="selected-group-count">${tabs.length}</span>
        </div>
        <div class="selected-tabs-chips"></div>
      `;
    const chipsRow = groupWrap.querySelector(".selected-tabs-chips");
    if (!chipsRow) {
      this.elements.selectedTabsBar.appendChild(groupWrap);
      return;
    }
    tabs.forEach((tab) => {
      const chip = document.createElement("div");
      chip.className = "selected-tab-chip";
      chip.innerHTML = `
          <span>${this.escapeHtml(tab.title?.substring(0, 25) || "Tab")}${tab.title?.length > 25 ? "..." : ""}</span>
          <button title="Remove">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        `;
      const removeBtn = chip.querySelector("button");
      removeBtn?.addEventListener("click", (event) => {
        event.stopPropagation();
        this.selectedTabs.delete(tab.id);
        this.updateSelectedTabsBar();
        this.updateTabSelectorButton();
        this.loadTabs();
      });
      chipsRow.appendChild(chip);
    });
    this.elements.selectedTabsBar.appendChild(groupWrap);
  });
};
SidePanelUI.prototype.updateTabSelectorButton = function updateTabSelectorButton() {
  const count = this.selectedTabs.size;
  if (count > 0) {
    this.elements.tabSelectorBtn.classList.add("has-selection");
    this.elements.tabSelectorBtn.dataset.count = String(count);
  } else {
    this.elements.tabSelectorBtn.classList.remove("has-selection");
    delete this.elements.tabSelectorBtn.dataset.count;
  }
  if (this.elements.tabSelectorSummary) {
    this.elements.tabSelectorSummary.textContent = count > 0 ? `${count} selected` : "No tabs selected";
  }
};
SidePanelUI.prototype.mapGroupColor = function mapGroupColor(colorName) {
  const palette = {
    grey: "#9aa0a6",
    blue: "#4c8bf5",
    red: "#ea4335",
    yellow: "#fbbc04",
    green: "#34a853",
    pink: "#f06292",
    purple: "#a142f4",
    cyan: "#24c1e0",
    orange: "#f29900"
  };
  return palette[colorName] || "var(--text-tertiary)";
};
SidePanelUI.prototype.formatTabLabel = function formatTabLabel(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
SidePanelUI.prototype.getSelectedTabsContext = function getSelectedTabsContext(tabs, source = "selected") {
  const tabList = tabs ?? Array.from(this.selectedTabs.values());
  if (!tabList.length) return "";
  const label = source === "active" ? "active tab" : "selected tabs";
  let context = `

[Context from ${label}:]
`;
  tabList.forEach((tab) => {
    const tabTitle = tab.title || "Untitled";
    const groupLabel = tab.groupTitle ? `${tab.groupTitle} \xB7 ` : "";
    const urlLabel = tab.url || "";
    context += `- ${groupLabel}"${tabTitle}": ${urlLabel}
`;
  });
  return context;
};

// packages/extension/sidepanel/ui/tabs/panel-session-tabs.ts
SidePanelUI.prototype.handleSessionTabsUpdate = function handleSessionTabsUpdate(message) {
  const tabs = Array.isArray(message.tabs) ? message.tabs : [];
  const activeTabId = typeof message.activeTabId === "number" ? message.activeTabId : null;
  const maxTabs = typeof message.maxTabs === "number" ? message.maxTabs : 5;
  const groupTitle = typeof message.groupTitle === "string" ? message.groupTitle : void 0;
  this.sessionTabsState = {
    ...this.sessionTabsState,
    tabs,
    activeTabId,
    maxTabs,
    groupTitle
  };
  this.renderSessionTabsHud();
};
SidePanelUI.prototype.setInteractingTab = function setInteractingTab(tabId) {
  const prev = this.sessionTabsState.interactingTabId;
  if (prev === tabId) return;
  this.sessionTabsState.interactingTabId = tabId;
  this.updateSessionTabInteractionState();
};
SidePanelUI.prototype.renderSessionTabsHud = function renderSessionTabsHud() {
  const hud = this.elements.sessionTabsHud;
  const list = this.elements.sessionTabsList;
  const countEl = this.elements.sessionTabsCount;
  if (!hud || !list || !countEl) return;
  const { tabs, activeTabId, maxTabs, interactingTabId } = this.sessionTabsState;
  if (tabs.length === 0) {
    hud.classList.add("hidden");
    return;
  }
  hud.classList.remove("hidden");
  countEl.textContent = `${tabs.length}/${maxTabs}`;
  if (tabs.length >= maxTabs) {
    countEl.classList.add("at-limit");
  } else {
    countEl.classList.remove("at-limit");
  }
  list.innerHTML = "";
  tabs.forEach((tab) => {
    const pill = document.createElement("div");
    pill.className = "session-tab-pill";
    pill.dataset.tabId = String(tab.id);
    if (tab.id === activeTabId) {
      pill.classList.add("active");
    }
    if (tab.id === interactingTabId) {
      pill.classList.add("interacting");
    }
    const domain = this.formatTabLabel?.(tab.url) || "";
    const title = tab.title || domain || "Tab";
    const truncatedTitle = title.length > 20 ? title.slice(0, 20) + "\u2026" : title;
    let faviconHtml = "";
    if (tab.url) {
      try {
        const origin = new URL(tab.url).origin;
        faviconHtml = `<img class="session-tab-favicon" src="${origin}/favicon.ico" onerror="this.style.display='none'" alt="">`;
      } catch {
      }
    }
    pill.innerHTML = `
      ${faviconHtml}
      <span class="session-tab-title">${this.escapeHtml(truncatedTitle)}</span>
      <span class="session-tab-activity"></span>
    `;
    pill.title = `${title}
${tab.url || ""}`;
    list.appendChild(pill);
  });
};
SidePanelUI.prototype.updateSessionTabInteractionState = function updateSessionTabInteractionState() {
  const list = this.elements.sessionTabsList;
  if (!list) return;
  const { interactingTabId } = this.sessionTabsState;
  const pills = list.querySelectorAll(".session-tab-pill");
  pills.forEach((pill) => {
    const tabId = Number(pill.dataset.tabId);
    if (tabId === interactingTabId) {
      pill.classList.add("interacting");
    } else {
      pill.classList.remove("interacting");
    }
  });
};

// packages/extension/sidepanel/ui/chat/panel-tools.ts
var toolIcons = {
  // Browser tools
  browser_navigate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 12l6-6m-6 6l6 6"/></svg>',
  browser_click: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8m-4-4h8"/></svg>',
  browser_type: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 12h8M8 16h4"/></svg>',
  browser_screenshot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
  browser_get_page_text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
  browser_scroll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
  browser_go_back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a4 4 0 0 1 4 4v1"/></svg>',
  browser_go_forward: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a4 4 0 0 0-4 4v1"/></svg>',
  browser_refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
  browser_find_element: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
  browser_press_key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8M12 8v8"/></svg>',
  browser_select_option: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  browser_get_element_text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>',
  browser_get_element_attribute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
  browser_execute_script: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  browser_wait: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  browser_set_viewport: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>',
  browser_clear_cookies: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5l7 7"/><path d="M15.5 8.5l-7 7"/></svg>',
  browser_get_cookies: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/></svg>',
  browser_set_cookie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>',
  browser_delete_cookie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8 12h8"/></svg>',
  // Default
  default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 6.34L2.1 2.1m20.9 9.9h-6m-6 0H2.1m16.12 4.24l4.24 4.24M6.34 17.66l-4.24 4.24"/></svg>'
};
SidePanelUI.prototype.displayToolExecution = function displayToolExecution(toolName, args, result, toolCallId = null) {
  const entryId = toolCallId || `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let entry = this.toolCallViews.get(entryId);
  const displayName = toolName;
  if (!entry) {
    entry = {
      id: entryId,
      toolName: displayName,
      fullToolName: toolName,
      args,
      startTime: Date.now(),
      element: null,
      statusEl: null,
      durationEl: null
    };
    this.toolCallViews.set(entryId, entry);
    if (this.streamingState?.eventsEl) {
      const toolEl = this.createToolElement(entry);
      entry.element = toolEl;
      this.streamingState.eventsEl.appendChild(toolEl);
      this.streamingState.lastEventType = "tool";
    }
    this.scrollToBottom();
  }
  if (result !== null && result !== void 0) {
    this.updateToolResult(entry, result);
    const isError = result && (result.error || result.success === false);
    if (isError) {
      const detail = result?.details ? ` (${this.truncateText?.(String(result.details), 140) || String(result.details)})` : "";
      this.showErrorBanner(`${displayName}: ${result.error || "Tool execution failed"}${detail}`);
    }
  }
  this.updateActivityToggle();
};
SidePanelUI.prototype.createToolElement = function createToolElement(entry) {
  const container = document.createElement("div");
  container.className = "tool-row running";
  container.dataset.toolId = entry.id;
  const icon = this.getToolIcon(entry.fullToolName);
  const argsTokens = this.getArgsTokens(entry.args);
  const argsLabel = argsTokens.join(" \xB7 ");
  if (argsLabel) {
    container.title = argsLabel;
  }
  container.innerHTML = `
    <span class="tool-icon">${icon}</span>
    <span class="tool-name">${this.escapeHtml(entry.toolName)}</span>
    ${argsLabel ? `<span class="tool-args">${this.escapeHtml(argsLabel)}</span>` : ""}
    <span class="tool-status">RUN</span>
    <span class="tool-duration">...</span>
  `;
  entry.statusEl = container.querySelector(".tool-status");
  entry.durationEl = container.querySelector(".tool-duration");
  this.animateToolDuration(entry);
  return container;
};
SidePanelUI.prototype.animateToolDuration = function animateToolDuration(entry) {
  if (!entry.durationEl || entry.endTime) return;
  const update = () => {
    if (!entry.durationEl || entry.endTime) return;
    const elapsed = Date.now() - entry.startTime;
    entry.durationEl.textContent = elapsed < 1e3 ? `${elapsed}ms` : `${(elapsed / 1e3).toFixed(1)}s`;
    requestAnimationFrame(() => setTimeout(update, 100));
  };
  update();
};
SidePanelUI.prototype.updateToolResult = function updateToolResult(entry, result) {
  if (!entry || !entry.element) return;
  entry.endTime = Date.now();
  const isError = result && (result.error || result.success === false);
  const duration = entry.endTime - entry.startTime;
  const isNoopScroll = entry.fullToolName === "scroll" && result && result.success === true && result.moved === false;
  entry.element.classList.remove("running");
  entry.element.classList.add(isError ? "error" : "done");
  entry.element.classList.toggle("noop", isNoopScroll);
  if (entry.durationEl) {
    entry.durationEl.textContent = duration < 1e3 ? `${duration}ms` : `${(duration / 1e3).toFixed(1)}s`;
  }
  if (entry.statusEl) {
    entry.statusEl.textContent = isError ? "ERR" : "OK";
  }
  if (isNoopScroll) {
    entry.element.title = "Scroll did not move. The page may use an inner scroll container; pass scroll.selector.";
    let noteEl = entry.element.querySelector(".tool-note");
    if (!noteEl) {
      noteEl = document.createElement("span");
      noteEl.className = "tool-note";
      noteEl.textContent = "no-op";
      const argsEl = entry.element.querySelector(".tool-args");
      if (argsEl && argsEl.parentElement) {
        argsEl.insertAdjacentElement("afterend", noteEl);
      } else {
        const statusEl = entry.element.querySelector(".tool-status");
        if (statusEl && statusEl.parentElement) {
          statusEl.insertAdjacentElement("beforebegin", noteEl);
        } else {
          entry.element.appendChild(noteEl);
        }
      }
    }
  }
  entry.result = result;
};
SidePanelUI.prototype.refreshTimelineHud = function refreshTimelineHud() {
};
SidePanelUI.prototype.getToolIcon = function getToolIcon(toolName) {
  if (toolIcons[toolName]) {
    return toolIcons[toolName];
  }
  for (const [key, icon] of Object.entries(toolIcons)) {
    if (key === "default") continue;
    const searchKey = key.replace(/^browser_/, "");
    if (toolName.toLowerCase().includes(searchKey.toLowerCase())) {
      return icon;
    }
  }
  return toolIcons.default;
};
SidePanelUI.prototype.getArgsTokens = function getArgsTokens(args) {
  if (!args || typeof args !== "object") return [];
  const tokens = [];
  if (args.tabId) tokens.push(`tab ${args.tabId}`);
  if (args.url)
    tokens.push(
      String(args.url).replace(/^https?:\/\//, "").substring(0, 36)
    );
  if (args.path) tokens.push(String(args.path).substring(0, 36));
  if (args.selector) tokens.push(String(args.selector).substring(0, 40));
  if (args.text) {
    const value = String(args.text);
    tokens.push(`"${value.substring(0, 24)}${value.length > 24 ? "\u2026" : ""}"`);
  }
  if (args.query) {
    const value = String(args.query);
    tokens.push(`"${value.substring(0, 24)}${value.length > 24 ? "\u2026" : ""}"`);
  }
  if (args.key) tokens.push(`key ${args.key}`);
  if (args.direction) tokens.push(`scroll ${args.direction}`);
  if (args.type) tokens.push(String(args.type));
  const keys = Object.keys(args).filter((k) => !k.startsWith("_") && !tokens.join(" ").includes(k));
  if (tokens.length === 0 && keys.length === 1) {
    tokens.push(String(args[keys[0]]).substring(0, 30));
  } else if (tokens.length === 0 && keys.length > 1) {
    tokens.push(`${keys.length} params`);
  }
  return tokens;
};
SidePanelUI.prototype.showErrorBanner = function showErrorBanner(message, opts) {
  document.querySelectorAll(".error-banner").forEach((el) => el.remove());
  const actionHtml = opts?.action ? `<span class="error-action">${this.escapeHtml(opts.action)}</span>` : "";
  const settingsBtnHtml = opts?.category === "auth" ? `<button class="error-settings-btn" title="Open Settings">Settings</button>` : "";
  const banner = document.createElement("div");
  banner.className = "error-banner";
  banner.innerHTML = `
    <svg class="error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
    <div class="error-body">
      <span class="error-text">${this.escapeHtml(message)}</span>
      ${actionHtml}
    </div>
    ${settingsBtnHtml}
    <button class="error-dismiss" title="Dismiss">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;
  const dismissButton = banner.querySelector(".error-dismiss");
  dismissButton?.addEventListener("click", () => banner.remove());
  const settingsBtn = banner.querySelector(".error-settings-btn");
  settingsBtn?.addEventListener("click", () => {
    banner.remove();
    this.openSettingsPanel?.();
  });
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 12e3);
};
SidePanelUI.prototype.clearRunIncompleteBanner = function clearRunIncompleteBanner() {
  document.querySelectorAll(".run-incomplete-banner").forEach((el) => el.remove());
};
SidePanelUI.prototype.clearErrorBanner = function clearErrorBanner() {
  document.querySelectorAll(".error-banner").forEach((el) => el.remove());
};
SidePanelUI.prototype.updateToolMessage = function updateToolMessage(entry, result) {
  if (!entry) return;
  if (entry.element) {
    this.updateToolResult(entry, result);
  }
};
SidePanelUI.prototype.updateToolLogEntry = function updateToolLogEntry(_entry, _result) {
};
SidePanelUI.prototype.updateActivityState = function updateActivityState() {
  const toolbarLabels = [];
  if (this.runStartedAt) {
    const elapsed = Math.max(0, Date.now() - this.runStartedAt);
    const totalSeconds = Math.floor(elapsed / 1e3);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const label = `${minutes.toString().padStart(1, "0")}:${seconds.toString().padStart(2, "0")}`;
    toolbarLabels.push(`Run ${label}`);
  }
  if (this.contextUsage && this.contextUsage.maxContextTokens) {
    const used = Math.max(0, this.contextUsage.approxTokens || 0);
    const max = Math.max(1, this.contextUsage.maxContextTokens || 0);
    const usedLabel = used >= 1e4 ? `${(used / 1e3).toFixed(1)}k` : `${used}`;
    const maxLabel = max >= 1e4 ? `${(max / 1e3).toFixed(0)}k` : `${max}`;
    toolbarLabels.push(`${usedLabel} / ${maxLabel}`);
  }
  const usageLabel = this.buildUsageLabel?.(this.lastUsage);
  if (usageLabel) {
    toolbarLabels.push(usageLabel);
  }
  if (this.elements.statusMeta) {
    this.elements.statusMeta.textContent = toolbarLabels.join(" \xB7 ");
  }
  const bubbleLabels = [];
  if (this.pendingToolCount > 0) {
    bubbleLabels.push(`${this.pendingToolCount} action${this.pendingToolCount > 1 ? "s" : ""} running`);
  }
  if (this.isStreaming) {
    bubbleLabels.push("Streaming");
  }
  const bubbleMeta = document.getElementById("bubbleMeta");
  if (bubbleMeta) {
    bubbleMeta.textContent = bubbleLabels.join(" \xB7 ");
  }
  this.updateMascotEyeState();
  this.updateActivityToggle();
};
SidePanelUI.prototype.updateActivityToggle = function updateActivityToggle() {
};
SidePanelUI.prototype.toggleActivityPanel = function toggleActivityPanel(_force) {
};
SidePanelUI.prototype.initMascotBubble = function initMascotBubble() {
  const mascot = document.getElementById("mascotCorner");
  if (!mascot) return;
  this._lastTypingAt = 0;
  this._typingCheckTimerId = null;
  this._mascotBubbleOpen = false;
  mascot.addEventListener("click", () => {
    this.toggleMascotBubble();
  });
  const userInput = this.elements.userInput;
  if (userInput) {
    userInput.addEventListener("input", () => {
      this._lastTypingAt = Date.now();
      this.updateMascotEyeState();
      if (!this._typingCheckTimerId) {
        this._typingCheckTimerId = window.setInterval(() => {
          const elapsed = Date.now() - this._lastTypingAt;
          if (elapsed >= 5e3) {
            window.clearInterval(this._typingCheckTimerId);
            this._typingCheckTimerId = null;
            this.updateMascotEyeState();
          }
        }, 1e3);
      }
    });
  }
};
SidePanelUI.prototype.toggleMascotBubble = function toggleMascotBubble() {
  const bubble = document.getElementById("mascotBubble");
  if (!bubble) return;
  this._mascotBubbleOpen = !this._mascotBubbleOpen;
  if (this._mascotBubbleOpen) {
    bubble.classList.remove("hidden");
    this.updateActivityState();
  } else {
    bubble.classList.add("hidden");
  }
};
SidePanelUI.prototype.updateMascotBubbleContent = function updateMascotBubbleContent(verb, elapsed) {
  const bubbleVerb = document.getElementById("bubbleVerb");
  if (bubbleVerb) {
    bubbleVerb.textContent = `${verb} ${elapsed}`;
  }
};
SidePanelUI.prototype.updateMascotEyeState = function updateMascotEyeState() {
  const mascot = document.getElementById("mascotCorner");
  if (!mascot) return;
  const isRunning = !!(this.runStartedAt || this.isStreaming || this.pendingToolCount > 0);
  const isTyping = this._lastTypingAt && Date.now() - this._lastTypingAt < 5e3;
  mascot.classList.remove("sleeping", "working", "looking-up", "thinking");
  if (isRunning) {
    mascot.classList.add("working");
  } else if (isTyping) {
    mascot.classList.add("looking-up");
  } else {
    mascot.classList.add("sleeping");
  }
};
SidePanelUI.prototype.updateThinkingPanel = function updateThinkingPanel(thinking, isStreaming = false) {
  if (thinking) {
    this.latestThinking = dedupeThinking(thinking.trim());
  } else if (!isStreaming) {
    this.latestThinking = null;
  }
  if (this.streamingState?.eventsEl && this.latestThinking) {
    let thinkingBlock = this.streamingState.eventsEl.querySelector(".inline-thinking-block");
    if (!thinkingBlock) {
      thinkingBlock = document.createElement("div");
      thinkingBlock.className = "inline-thinking-block";
      thinkingBlock.innerHTML = `
        <div class="thinking-block-inner">
          <div class="thinking-header-inline">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 16v-4"/>
              <path d="M12 8h.01"/>
            </svg>
            <span>Thinking</span>
          </div>
          <div class="thinking-content-inline"></div>
        </div>
      `;
      const firstChild = this.streamingState.eventsEl.firstChild;
      if (firstChild) {
        this.streamingState.eventsEl.insertBefore(thinkingBlock, firstChild);
      } else {
        this.streamingState.eventsEl.appendChild(thinkingBlock);
      }
    }
    const contentEl = thinkingBlock.querySelector(".thinking-content-inline");
    if (contentEl) {
      contentEl.textContent = this.latestThinking;
    }
  }
};
SidePanelUI.prototype.resetActivityPanel = function resetActivityPanel() {
  if (this.elements.chatMessages) {
    const trees = this.elements.chatMessages.querySelectorAll(".tool-card, .step-block");
    trees.forEach((tree) => tree.remove());
  }
  this.latestThinking = null;
  this.activeToolName = null;
  this.toolCallViews.clear();
  this.stepTimeline.steps.clear();
  this.stepTimeline.activeStepIndex = null;
  this.stepTimeline.activeStepBody = null;
};

// packages/extension/sidepanel/ui/chat/panel-workflows.ts
var CHARS_PER_TOKEN = 3.5;
var MAX_CONTEXT_TOKENS = 1e5;
var MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;
SidePanelUI.prototype.loadWorkflows = async function loadWorkflows() {
  try {
    const data = await chrome.storage.local.get("workflows");
    this.workflows = Array.isArray(data.workflows) ? data.workflows : [];
  } catch {
    this.workflows = [];
  }
};
SidePanelUI.prototype.saveWorkflow = async function saveWorkflow(name, prompt) {
  const workflow = {
    id: crypto.randomUUID(),
    name: name.trim(),
    prompt,
    createdAt: Date.now()
  };
  this.workflows.push(workflow);
  await chrome.storage.local.set({ workflows: this.workflows });
};
SidePanelUI.prototype.deleteWorkflow = async function deleteWorkflow(id) {
  this.workflows = this.workflows.filter((w) => w.id !== id);
  await chrome.storage.local.set({ workflows: this.workflows });
};
SidePanelUI.prototype.showWorkflowMenu = function showWorkflowMenu(filter) {
  let menu = document.getElementById("workflowMenu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "workflowMenu";
    menu.className = "workflow-menu";
    document.body.appendChild(menu);
  }
  const composerEl = this.elements.composer;
  if (composerEl) {
    const rect = composerEl.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.width = `${rect.width}px`;
  }
  const query = filter.toLowerCase();
  const filtered = query ? this.workflows.filter((w) => w.name.toLowerCase().includes(query)) : this.workflows;
  if (this.workflowMenuIndex >= filtered.length) this.workflowMenuIndex = filtered.length - 1;
  if (this.workflowMenuIndex < 0 && filtered.length > 0) this.workflowMenuIndex = 0;
  let listHtml = "";
  if (filtered.length === 0 && this.workflows.length === 0) {
    listHtml = '<div class="workflow-empty">No workflows yet. Type a prompt, then use <strong>/</strong> to save it.</div>';
  } else if (filtered.length === 0) {
    listHtml = '<div class="workflow-empty">No matching workflows</div>';
  } else {
    filtered.forEach((w, i) => {
      const active = i === this.workflowMenuIndex ? " active" : "";
      const preview = w.prompt.length > 50 ? w.prompt.slice(0, 50) + "\u2026" : w.prompt;
      listHtml += `<div class="workflow-item${active}" data-workflow-id="${w.id}">
        <div class="workflow-item-text">
          <span class="workflow-item-name">/${w.name}</span>
          <span class="workflow-item-preview">${escapeHtml2(preview)}</span>
        </div>
        <button class="workflow-item-delete" data-delete-id="${w.id}" title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>`;
    });
  }
  menu.innerHTML = `
    <div class="workflow-menu-list">${listHtml}</div>
    <div class="workflow-save-row" id="workflowSaveRow">
      <button class="workflow-save-btn" id="workflowSaveBtn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"></path>
        </svg>
        Save as workflow\u2026
      </button>
    </div>
  `;
  this.workflowMenuOpen = true;
  menu.querySelectorAll(".workflow-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      const deleteBtn = e.target.closest(".workflow-item-delete");
      if (deleteBtn) {
        e.stopPropagation();
        const deleteId = deleteBtn.dataset.deleteId;
        if (deleteId) {
          this.deleteWorkflow(deleteId).then(() => {
            const input = this.elements.userInput?.value || "";
            this.showWorkflowMenu(input.startsWith("/") ? input.slice(1) : "");
          });
        }
        return;
      }
      const id = item.dataset.workflowId;
      const wf = this.workflows.find((w) => w.id === id);
      if (wf) this.selectWorkflow(wf);
    });
  });
  menu.querySelector("#workflowSaveBtn")?.addEventListener("click", () => this.showWorkflowSaveInput());
  this._workflowOutsideHandler = this._workflowOutsideHandler || ((e) => {
    const menuEl = document.getElementById("workflowMenu");
    const inputEl = this.elements.userInput;
    if (menuEl && !menuEl.contains(e.target) && e.target !== inputEl) {
      this.hideWorkflowMenu();
    }
  });
  document.removeEventListener("mousedown", this._workflowOutsideHandler);
  document.addEventListener("mousedown", this._workflowOutsideHandler);
};
SidePanelUI.prototype.buildSessionContext = function buildSessionContext() {
  const sections = [];
  if (this.displayHistory?.length) {
    for (const entry of this.displayHistory) {
      const text = this.extractTextContent?.(entry.content) || String(entry.content || "");
      if (!text.trim()) continue;
      if (entry.role === "user") {
        sections.push(`[User]: ${text}`);
      } else if (entry.role === "assistant") {
        if (entry.thinking) sections.push(`[Assistant thinking]: ${entry.thinking}`);
        sections.push(`[Assistant]: ${text}`);
      } else if (entry.role === "system" && entry.meta?.kind === "summary") {
        sections.push(`[Context summary]: ${text}`);
      }
    }
  }
  if (this.historyTurnMap?.size) {
    sections.push("\n=== DETAILED TURN LOG ===");
    this.historyTurnMap.forEach((turn, turnId) => {
      sections.push(`
--- Turn ${turnId} ---`);
      if (turn.userMessage) sections.push(`[User]: ${turn.userMessage}`);
      if (turn.plan?.steps?.length) {
        const planLines = turn.plan.steps.map(
          (s) => `  ${s.status === "done" ? "[x]" : "[ ]"} ${s.title}`
        );
        sections.push(`[Plan]:
${planLines.join("\n")}`);
      }
      if (turn.toolEvents?.length) {
        for (const ev of turn.toolEvents) {
          if (ev.type === "tool_execution_start") {
            const argsStr = ev.args ? JSON.stringify(ev.args) : "";
            sections.push(`[Tool call] ${ev.tool}(${argsStr})`);
          } else if (ev.type === "tool_execution_result") {
            const resultStr = ev.result != null ? JSON.stringify(ev.result) : "";
            const truncated = resultStr.length > 2e3 ? resultStr.slice(0, 2e3) + "...(truncated)" : resultStr;
            sections.push(`[Tool result] ${ev.tool}: ${truncated}`);
          }
        }
      }
      if (turn.assistantFinal) {
        if (turn.assistantFinal.thinking) {
          sections.push(`[Assistant thinking]: ${turn.assistantFinal.thinking}`);
        }
        if (turn.assistantFinal.content) {
          sections.push(`[Assistant]: ${turn.assistantFinal.content}`);
        }
      }
    });
  }
  if (this.currentPlan?.steps?.length) {
    const planLines = this.currentPlan.steps.map(
      (s) => `  ${s.status === "done" ? "[x]" : "[ ]"} ${s.title}`
    );
    sections.push(`
=== CURRENT PLAN ===
${planLines.join("\n")}`);
  }
  if (this.contextHistory?.length) {
    sections.push("\n=== RAW CONTEXT MESSAGES ===");
    for (const msg of this.contextHistory) {
      const text = this.extractTextContent?.(msg.content) || String(msg.content || "");
      if (!text.trim()) continue;
      sections.push(`[${msg.role}]: ${text}`);
      if (msg.thinking) sections.push(`[thinking]: ${msg.thinking}`);
      if (Array.isArray(msg.toolCalls) && msg.toolCalls.length) {
        for (const tc of msg.toolCalls) {
          sections.push(`[tool_call] ${tc.name}(${JSON.stringify(tc.args || {})})`);
        }
      }
    }
  }
  let full = sections.join("\n\n");
  if (full.length > MAX_CONTEXT_CHARS) {
    const headBudget = Math.floor(MAX_CONTEXT_CHARS * 0.35);
    const tailBudget = Math.floor(MAX_CONTEXT_CHARS * 0.6);
    const head = full.slice(0, headBudget);
    const tail = full.slice(full.length - tailBudget);
    full = head + "\n\n[...middle of session omitted for brevity...]\n\n" + tail;
  }
  return full;
};
SidePanelUI.prototype.generateWorkflowFromSession = async function generateWorkflowFromSession() {
  const context = this.buildSessionContext();
  if (!context.trim()) return null;
  const response = await chrome.runtime.sendMessage({
    type: "generate_workflow",
    sessionContext: context,
    maxOutputTokens: 4096
  });
  if (!response?.success || !response.result?.prompt) {
    const err = response?.result?.error || response?.error || "Generation failed";
    throw new Error(err);
  }
  const firstUser = (this.displayHistory || []).find((m) => m.role === "user");
  const firstText = firstUser ? (this.extractTextContent?.(firstUser.content) || "").toLowerCase().replace(/[^a-z0-9\s]/g, "") : "";
  const words = firstText.split(/\s+/).filter(Boolean).slice(0, 3);
  const suggestedName = words.join("-") || "workflow";
  return { name: suggestedName, prompt: response.result.prompt };
};
SidePanelUI.prototype.showWorkflowSaveInput = function showWorkflowSaveInput() {
  const saveRow = document.getElementById("workflowSaveRow");
  if (!saveRow) return;
  const hasSession = this.displayHistory?.length > 0 || this.historyTurnMap?.size > 0;
  saveRow.innerHTML = `
    <div class="workflow-save-form">
      <input type="text" class="workflow-save-input" id="workflowNameInput"
        placeholder="Name (e.g. summarize)" autocomplete="off" spellcheck="false" />
      <textarea class="workflow-save-prompt" id="workflowPromptInput" rows="3"
        placeholder="Prompt text to insert\u2026"></textarea>
      <div class="workflow-save-actions">
        ${hasSession ? `<button class="workflow-generate-btn" id="workflowGenerateBtn" title="Use AI to generate a workflow from this session">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
          </svg>
          Generate from session
        </button>` : ""}
        <div class="workflow-save-actions-right">
          <button class="workflow-save-cancel" id="workflowSaveCancel">Cancel</button>
          <button class="workflow-save-confirm" id="workflowSaveConfirm">Save</button>
        </div>
      </div>
    </div>
  `;
  const nameInput = document.getElementById("workflowNameInput");
  const promptInput = document.getElementById("workflowPromptInput");
  const resizePromptInput = () => {
    if (!promptInput) return;
    const maxHeight = 500;
    promptInput.style.height = "auto";
    const nextHeight = Math.min(promptInput.scrollHeight, maxHeight);
    promptInput.style.height = `${nextHeight}px`;
    promptInput.style.overflowY = promptInput.scrollHeight > maxHeight ? "auto" : "hidden";
  };
  const composerValue = this.elements.userInput?.value || "";
  if (composerValue && !composerValue.startsWith("/")) {
    promptInput.value = composerValue;
  }
  resizePromptInput();
  promptInput?.addEventListener("input", resizePromptInput);
  nameInput?.focus();
  const repositionMenu = () => {
    requestAnimationFrame(() => {
      const composerEl = this.elements.composer;
      const menu = document.getElementById("workflowMenu");
      if (composerEl && menu) {
        const rect = composerEl.getBoundingClientRect();
        menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
      }
    });
  };
  const doSave = () => {
    const name = nameInput?.value?.trim();
    const prompt = promptInput?.value?.trim();
    if (!name) {
      nameInput?.focus();
      return;
    }
    if (!prompt) {
      promptInput?.focus();
      return;
    }
    this.saveWorkflow(name, prompt).then(() => {
      this.hideWorkflowMenu();
      const userInput = this.elements.userInput;
      if (userInput && userInput.value.startsWith("/")) {
        userInput.value = "";
        userInput.style.height = "auto";
      }
      this.updateStatus(`Workflow "/${name}" saved`, "success");
    });
  };
  const generateBtn = document.getElementById("workflowGenerateBtn");
  generateBtn?.addEventListener("click", async () => {
    generateBtn.classList.add("loading");
    generateBtn.setAttribute("disabled", "true");
    const origText = generateBtn.innerHTML;
    generateBtn.innerHTML = `<svg class="workflow-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>Generating\u2026`;
    this.updateStatus("Generating workflow from session\u2026", "active");
    try {
      const generated = await this.generateWorkflowFromSession();
      if (generated) {
        if (!nameInput.value.trim()) nameInput.value = generated.name;
        promptInput.value = generated.prompt;
        promptInput.style.height = "auto";
        promptInput.style.height = `${Math.min(promptInput.scrollHeight, 300)}px`;
        this.updateStatus("Workflow generated", "success");
      } else {
        this.updateStatus("No session data to generate from", "warning");
      }
    } catch (err) {
      this.updateStatus(`Generation failed: ${err?.message || err}`, "error");
    } finally {
      generateBtn.innerHTML = origText;
      generateBtn.classList.remove("loading");
      generateBtn.removeAttribute("disabled");
      repositionMenu();
    }
  });
  const handleKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      this.hideWorkflowMenu();
    }
  };
  nameInput?.addEventListener("keydown", (e) => {
    handleKey(e);
    if (e.key === "Enter") {
      e.preventDefault();
      promptInput?.focus();
    }
  });
  promptInput?.addEventListener("keydown", (e) => {
    handleKey(e);
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      doSave();
    }
  });
  document.getElementById("workflowSaveCancel")?.addEventListener("click", () => this.hideWorkflowMenu());
  document.getElementById("workflowSaveConfirm")?.addEventListener("click", doSave);
  repositionMenu();
};
SidePanelUI.prototype.hideWorkflowMenu = function hideWorkflowMenu() {
  const menu = document.getElementById("workflowMenu");
  menu?.remove();
  this.workflowMenuOpen = false;
  this.workflowMenuIndex = -1;
  if (this._workflowOutsideHandler) {
    document.removeEventListener("mousedown", this._workflowOutsideHandler);
  }
};
SidePanelUI.prototype.handleWorkflowInput = function handleWorkflowInput() {
  const userInput = this.elements.userInput;
  if (!userInput) return;
  const value = userInput.value;
  if (value.startsWith("/")) {
    this.showWorkflowMenu(value.slice(1));
  } else if (this.workflowMenuOpen) {
    this.hideWorkflowMenu();
  }
};
SidePanelUI.prototype.selectWorkflow = function selectWorkflow(workflow) {
  const userInput = this.elements.userInput;
  if (!userInput) return;
  const computedMaxHeight = Number.parseFloat(getComputedStyle(userInput).maxHeight);
  const maxHeight = Number.isFinite(computedMaxHeight) && computedMaxHeight > 0 ? computedMaxHeight : 280;
  userInput.value = workflow.prompt;
  userInput.style.height = "auto";
  const nextHeight = Math.min(userInput.scrollHeight, maxHeight);
  userInput.style.height = `${nextHeight}px`;
  userInput.style.overflowY = userInput.scrollHeight > maxHeight ? "auto" : "hidden";
  userInput.focus();
  this.hideWorkflowMenu();
};
SidePanelUI.prototype.handleWorkflowKeydown = function handleWorkflowKeydown(event) {
  if (!this.workflowMenuOpen) return false;
  const active = document.activeElement;
  if (active && (active.id === "workflowNameInput" || active.id === "workflowPromptInput")) {
    return false;
  }
  const menu = document.getElementById("workflowMenu");
  if (!menu) return false;
  const items = menu.querySelectorAll(".workflow-item");
  const count = items.length;
  if (event.key === "ArrowDown") {
    event.preventDefault();
    this.workflowMenuIndex = count > 0 ? (this.workflowMenuIndex + 1) % count : -1;
    this.updateWorkflowMenuHighlight(items);
    return true;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    this.workflowMenuIndex = count > 0 ? (this.workflowMenuIndex - 1 + count) % count : -1;
    this.updateWorkflowMenuHighlight(items);
    return true;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    if (this.workflowMenuIndex >= 0 && this.workflowMenuIndex < count) {
      const id = items[this.workflowMenuIndex].dataset.workflowId;
      const wf = this.workflows.find((w) => w.id === id);
      if (wf) this.selectWorkflow(wf);
    }
    return true;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    this.hideWorkflowMenu();
    return true;
  }
  if (event.key === "Tab") {
    event.preventDefault();
    if (this.workflowMenuIndex >= 0 && this.workflowMenuIndex < count) {
      const id = items[this.workflowMenuIndex].dataset.workflowId;
      const wf = this.workflows.find((w) => w.id === id);
      if (wf) this.selectWorkflow(wf);
    }
    return true;
  }
  return false;
};
SidePanelUI.prototype.updateWorkflowMenuHighlight = function updateWorkflowMenuHighlight(items) {
  items.forEach((item, i) => {
    if (i === this.workflowMenuIndex) {
      item.classList.add("active");
      item.scrollIntoView({ block: "nearest" });
    } else {
      item.classList.remove("active");
    }
  });
};
function escapeHtml2(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// packages/extension/sidepanel/ui/status/panel-usage.ts
SidePanelUI.prototype.formatCurrency = function formatCurrency(amount, currency = "usd") {
  if (amount === null || amount === void 0) return "";
  const value = Number(amount) / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase()
    }).format(value);
  } catch (error) {
    return `${value.toFixed(2)} ${currency.toUpperCase()}`;
  }
};
SidePanelUI.prototype.formatShortDate = function formatShortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
};
SidePanelUI.prototype.formatTokenCount = function formatTokenCount(value) {
  if (!value || value <= 0) return "0";
  if (value >= 1e3) {
    const precision = value >= 1e4 ? 0 : 1;
    return `${(value / 1e3).toFixed(precision)}k`;
  }
  return `${Math.round(value)}`;
};
SidePanelUI.prototype.normalizeUsage = function normalizeUsage2(usage) {
  if (!usage) return null;
  const inputTokens = Math.max(0, usage.inputTokens || 0);
  const outputTokens = Math.max(0, usage.outputTokens || 0);
  const totalTokens = Math.max(0, usage.totalTokens || inputTokens + outputTokens);
  if (!inputTokens && !outputTokens && !totalTokens) return null;
  return { inputTokens, outputTokens, totalTokens };
};
SidePanelUI.prototype.buildUsageLabel = function buildUsageLabel(usage) {
  if (!usage) return "";
  const parts = [];
  if (usage.inputTokens) {
    parts.push(`${this.formatTokenCount(usage.inputTokens)} in`);
  }
  if (usage.outputTokens) {
    parts.push(`${this.formatTokenCount(usage.outputTokens)} out`);
  }
  if (!parts.length && usage.totalTokens) {
    parts.push(`${this.formatTokenCount(usage.totalTokens)} total`);
  }
  return parts.length ? `Tokens ${parts.join(" / ")}` : "";
};
SidePanelUI.prototype.buildMessageMeta = function buildMessageMeta(usage, modelLabel) {
  const segments = [];
  const model = modelLabel?.trim();
  if (model) {
    segments.push(model);
  }
  const usageLabel = this.buildUsageLabel(usage);
  if (usageLabel) {
    segments.push(usageLabel);
  }
  return segments.join(" \xB7 ");
};
SidePanelUI.prototype.estimateUsageFromContent = function estimateUsageFromContent(content) {
  if (!content) return null;
  const tokens = Math.ceil(content.length / 4);
  if (!tokens) return null;
  return {
    inputTokens: 0,
    outputTokens: tokens,
    totalTokens: tokens
  };
};
SidePanelUI.prototype.getActiveModelLabel = function getActiveModelLabel() {
  const config = this.configs[this.currentConfig] || {};
  return config.model || "";
};
SidePanelUI.prototype.updateUsageStats = function updateUsageStats(usage) {
  if (!usage) return;
  this.lastUsage = usage;
  this.sessionTokenTotals = {
    inputTokens: this.sessionTokenTotals.inputTokens + usage.inputTokens,
    outputTokens: this.sessionTokenTotals.outputTokens + usage.outputTokens,
    totalTokens: this.sessionTokenTotals.totalTokens + usage.totalTokens
  };
  this.updateActivityState();
};

// packages/extension/sidepanel/ui/core/panel-view.ts
SidePanelUI.prototype.switchView = function switchView(view) {
  this.currentView = view;
  if (!this.elements.chatInterface) return;
  this.elements.chatInterface.classList.remove("hidden");
};
SidePanelUI.prototype.openSidebar = function openSidebar() {
  setSidebarOpen(this.elements, true);
};
SidePanelUI.prototype.closeSidebar = function closeSidebar() {
  setSidebarOpen(this.elements, false);
};
SidePanelUI.prototype.showRightPanel = function showRightPanel2(panelName) {
  showRightPanel(this.elements, panelName);
};
SidePanelUI.prototype.openChatView = function openChatView() {
  this.closeSidebar();
  this.switchView("chat");
};
SidePanelUI.prototype.openHistoryDrawer = function openHistoryDrawer() {
  this.elements.historyDrawer?.classList.remove("hidden");
  this.elements.historyDrawerScrim?.classList.remove("hidden");
  this.loadHistoryList();
  setTimeout(() => this.elements.historySearchInput?.focus(), 100);
};
SidePanelUI.prototype.closeHistoryDrawer = function closeHistoryDrawer() {
  this.elements.historyDrawer?.classList.add("hidden");
  this.elements.historyDrawerScrim?.classList.add("hidden");
  if (this.elements.historySearchInput) {
    this.elements.historySearchInput.value = "";
  }
};
SidePanelUI.prototype.openSettingsPanel = function openSettingsPanel() {
  this.openSidebar();
  this.showRightPanel("settings");
  this.switchSettingsTab(this.currentSettingsTab || "setup");
  void this.refreshAccountPanel?.({ silent: true });
};
SidePanelUI.prototype.startNewSession = function startNewSession() {
  this.displayHistory = [];
  this.contextHistory = [];
  const suffix = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : String(Date.now());
  this.sessionId = `session-${suffix}`;
  this.sessionStartedAt = Date.now();
  this.firstUserMessage = "";
  this.sessionTokensUsed = 0;
  this.lastUsage = null;
  this.sessionTokenTotals = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0
  };
  this.currentPlan = null;
  this.hidePlanDrawer();
  this.stopThinkingTimer?.();
  this.stopRunTimer?.();
  this.stopWatchdog?.();
  this.elements.composer?.classList.remove("running");
  this.pendingToolCount = 0;
  this.isStreaming = false;
  this.activeToolName = null;
  this._lastTypingAt = 0;
  this._mascotBubbleOpen = false;
  const mascotBubble = document.getElementById("mascotBubble");
  if (mascotBubble) mascotBubble.classList.add("hidden");
  this.updateMascotEyeState?.();
  this.subagents.clear();
  this.activeAgent = "main";
  this.historyTurnMap.clear();
  this.pendingTurnDraft = null;
  this.elements.chatMessages.innerHTML = "";
  this.toolCallViews.clear();
  this.updateChatEmptyState?.();
  this.resetActivityPanel();
  this.hideAgentNav();
  this.sessionTabsState = {
    tabs: [],
    activeTabId: null,
    maxTabs: 5,
    groupTitle: void 0,
    interactingTabId: null
  };
  this.renderSessionTabsHud?.();
  this.updateStatus("Ready for a new session", "success");
  this.switchView("chat");
  this.updateContextUsage();
  this.scrollToBottom({ force: true });
};

// node_modules/convex/dist/esm/index.js
var version = "1.31.7";

// node_modules/convex/dist/esm/values/base64.js
var lookup = [];
var revLookup = [];
var Arr = Uint8Array;
var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
for (i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i];
  revLookup[code.charCodeAt(i)] = i;
}
var i;
var len;
revLookup["-".charCodeAt(0)] = 62;
revLookup["_".charCodeAt(0)] = 63;
function getLens(b64) {
  var len = b64.length;
  if (len % 4 > 0) {
    throw new Error("Invalid string. Length must be a multiple of 4");
  }
  var validLen = b64.indexOf("=");
  if (validLen === -1) validLen = len;
  var placeHoldersLen = validLen === len ? 0 : 4 - validLen % 4;
  return [validLen, placeHoldersLen];
}
function _byteLength(_b64, validLen, placeHoldersLen) {
  return (validLen + placeHoldersLen) * 3 / 4 - placeHoldersLen;
}
function toByteArray(b64) {
  var tmp;
  var lens = getLens(b64);
  var validLen = lens[0];
  var placeHoldersLen = lens[1];
  var arr2 = new Arr(_byteLength(b64, validLen, placeHoldersLen));
  var curByte = 0;
  var len = placeHoldersLen > 0 ? validLen - 4 : validLen;
  var i;
  for (i = 0; i < len; i += 4) {
    tmp = revLookup[b64.charCodeAt(i)] << 18 | revLookup[b64.charCodeAt(i + 1)] << 12 | revLookup[b64.charCodeAt(i + 2)] << 6 | revLookup[b64.charCodeAt(i + 3)];
    arr2[curByte++] = tmp >> 16 & 255;
    arr2[curByte++] = tmp >> 8 & 255;
    arr2[curByte++] = tmp & 255;
  }
  if (placeHoldersLen === 2) {
    tmp = revLookup[b64.charCodeAt(i)] << 2 | revLookup[b64.charCodeAt(i + 1)] >> 4;
    arr2[curByte++] = tmp & 255;
  }
  if (placeHoldersLen === 1) {
    tmp = revLookup[b64.charCodeAt(i)] << 10 | revLookup[b64.charCodeAt(i + 1)] << 4 | revLookup[b64.charCodeAt(i + 2)] >> 2;
    arr2[curByte++] = tmp >> 8 & 255;
    arr2[curByte++] = tmp & 255;
  }
  return arr2;
}
function tripletToBase64(num) {
  return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
}
function encodeChunk(uint8, start, end) {
  var tmp;
  var output = [];
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16 & 16711680) + (uint8[i + 1] << 8 & 65280) + (uint8[i + 2] & 255);
    output.push(tripletToBase64(tmp));
  }
  return output.join("");
}
function fromByteArray(uint8) {
  var tmp;
  var len = uint8.length;
  var extraBytes = len % 3;
  var parts = [];
  var maxChunkLength = 16383;
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(
      encodeChunk(
        uint8,
        i,
        i + maxChunkLength > len2 ? len2 : i + maxChunkLength
      )
    );
  }
  if (extraBytes === 1) {
    tmp = uint8[len - 1];
    parts.push(lookup[tmp >> 2] + lookup[tmp << 4 & 63] + "==");
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1];
    parts.push(
      lookup[tmp >> 10] + lookup[tmp >> 4 & 63] + lookup[tmp << 2 & 63] + "="
    );
  }
  return parts.join("");
}

// node_modules/convex/dist/esm/common/index.js
function parseArgs(args) {
  if (args === void 0) {
    return {};
  }
  if (!isSimpleObject(args)) {
    throw new Error(
      `The arguments to a Convex function must be an object. Received: ${args}`
    );
  }
  return args;
}
function validateDeploymentUrl(deploymentUrl) {
  if (typeof deploymentUrl === "undefined") {
    throw new Error(
      `Client created with undefined deployment address. If you used an environment variable, check that it's set.`
    );
  }
  if (typeof deploymentUrl !== "string") {
    throw new Error(
      `Invalid deployment address: found ${deploymentUrl}".`
    );
  }
  if (!(deploymentUrl.startsWith("http:") || deploymentUrl.startsWith("https:"))) {
    throw new Error(
      `Invalid deployment address: Must start with "https://" or "http://". Found "${deploymentUrl}".`
    );
  }
  try {
    new URL(deploymentUrl);
  } catch {
    throw new Error(
      `Invalid deployment address: "${deploymentUrl}" is not a valid URL. If you believe this URL is correct, use the \`skipConvexDeploymentUrlCheck\` option to bypass this.`
    );
  }
  if (deploymentUrl.endsWith(".convex.site")) {
    throw new Error(
      `Invalid deployment address: "${deploymentUrl}" ends with .convex.site, which is used for HTTP Actions. Convex deployment URLs typically end with .convex.cloud? If you believe this URL is correct, use the \`skipConvexDeploymentUrlCheck\` option to bypass this.`
    );
  }
}
function isSimpleObject(value) {
  const isObject = typeof value === "object";
  const prototype = Object.getPrototypeOf(value);
  const isSimple = prototype === null || prototype === Object.prototype || // Objects generated from other contexts (e.g. across Node.js `vm` modules) will not satisfy the previous
  // conditions but are still simple objects.
  prototype?.constructor?.name === "Object";
  return isObject && isSimple;
}

// node_modules/convex/dist/esm/values/value.js
var LITTLE_ENDIAN = true;
var MIN_INT64 = BigInt("-9223372036854775808");
var MAX_INT64 = BigInt("9223372036854775807");
var ZERO = BigInt("0");
var EIGHT = BigInt("8");
var TWOFIFTYSIX = BigInt("256");
function isSpecial(n) {
  return Number.isNaN(n) || !Number.isFinite(n) || Object.is(n, -0);
}
function slowBigIntToBase64(value) {
  if (value < ZERO) {
    value -= MIN_INT64 + MIN_INT64;
  }
  let hex = value.toString(16);
  if (hex.length % 2 === 1) hex = "0" + hex;
  const bytes = new Uint8Array(new ArrayBuffer(8));
  let i = 0;
  for (const hexByte of hex.match(/.{2}/g).reverse()) {
    bytes.set([parseInt(hexByte, 16)], i++);
    value >>= EIGHT;
  }
  return fromByteArray(bytes);
}
function slowBase64ToBigInt(encoded) {
  const integerBytes = toByteArray(encoded);
  if (integerBytes.byteLength !== 8) {
    throw new Error(
      `Received ${integerBytes.byteLength} bytes, expected 8 for $integer`
    );
  }
  let value = ZERO;
  let power = ZERO;
  for (const byte of integerBytes) {
    value += BigInt(byte) * TWOFIFTYSIX ** power;
    power++;
  }
  if (value > MAX_INT64) {
    value += MIN_INT64 + MIN_INT64;
  }
  return value;
}
function modernBigIntToBase64(value) {
  if (value < MIN_INT64 || MAX_INT64 < value) {
    throw new Error(
      `BigInt ${value} does not fit into a 64-bit signed integer.`
    );
  }
  const buffer = new ArrayBuffer(8);
  new DataView(buffer).setBigInt64(0, value, true);
  return fromByteArray(new Uint8Array(buffer));
}
function modernBase64ToBigInt(encoded) {
  const integerBytes = toByteArray(encoded);
  if (integerBytes.byteLength !== 8) {
    throw new Error(
      `Received ${integerBytes.byteLength} bytes, expected 8 for $integer`
    );
  }
  const intBytesView = new DataView(integerBytes.buffer);
  return intBytesView.getBigInt64(0, true);
}
var bigIntToBase64 = DataView.prototype.setBigInt64 ? modernBigIntToBase64 : slowBigIntToBase64;
var base64ToBigInt = DataView.prototype.getBigInt64 ? modernBase64ToBigInt : slowBase64ToBigInt;
var MAX_IDENTIFIER_LEN = 1024;
function validateObjectField(k) {
  if (k.length > MAX_IDENTIFIER_LEN) {
    throw new Error(
      `Field name ${k} exceeds maximum field name length ${MAX_IDENTIFIER_LEN}.`
    );
  }
  if (k.startsWith("$")) {
    throw new Error(`Field name ${k} starts with a '$', which is reserved.`);
  }
  for (let i = 0; i < k.length; i += 1) {
    const charCode = k.charCodeAt(i);
    if (charCode < 32 || charCode >= 127) {
      throw new Error(
        `Field name ${k} has invalid character '${k[i]}': Field names can only contain non-control ASCII characters`
      );
    }
  }
}
function jsonToConvex(value) {
  if (value === null) {
    return value;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((value2) => jsonToConvex(value2));
  }
  if (typeof value !== "object") {
    throw new Error(`Unexpected type of ${value}`);
  }
  const entries = Object.entries(value);
  if (entries.length === 1) {
    const key = entries[0][0];
    if (key === "$bytes") {
      if (typeof value.$bytes !== "string") {
        throw new Error(`Malformed $bytes field on ${value}`);
      }
      return toByteArray(value.$bytes).buffer;
    }
    if (key === "$integer") {
      if (typeof value.$integer !== "string") {
        throw new Error(`Malformed $integer field on ${value}`);
      }
      return base64ToBigInt(value.$integer);
    }
    if (key === "$float") {
      if (typeof value.$float !== "string") {
        throw new Error(`Malformed $float field on ${value}`);
      }
      const floatBytes = toByteArray(value.$float);
      if (floatBytes.byteLength !== 8) {
        throw new Error(
          `Received ${floatBytes.byteLength} bytes, expected 8 for $float`
        );
      }
      const floatBytesView = new DataView(floatBytes.buffer);
      const float = floatBytesView.getFloat64(0, LITTLE_ENDIAN);
      if (!isSpecial(float)) {
        throw new Error(`Float ${float} should be encoded as a number`);
      }
      return float;
    }
    if (key === "$set") {
      throw new Error(
        `Received a Set which is no longer supported as a Convex type.`
      );
    }
    if (key === "$map") {
      throw new Error(
        `Received a Map which is no longer supported as a Convex type.`
      );
    }
  }
  const out = {};
  for (const [k, v2] of Object.entries(value)) {
    validateObjectField(k);
    out[k] = jsonToConvex(v2);
  }
  return out;
}
var MAX_VALUE_FOR_ERROR_LEN = 16384;
function stringifyValueForError(value) {
  const str = JSON.stringify(value, (_key, value2) => {
    if (value2 === void 0) {
      return "undefined";
    }
    if (typeof value2 === "bigint") {
      return `${value2.toString()}n`;
    }
    return value2;
  });
  if (str.length > MAX_VALUE_FOR_ERROR_LEN) {
    const rest = "[...truncated]";
    let truncateAt = MAX_VALUE_FOR_ERROR_LEN - rest.length;
    const codePoint = str.codePointAt(truncateAt - 1);
    if (codePoint !== void 0 && codePoint > 65535) {
      truncateAt -= 1;
    }
    return str.substring(0, truncateAt) + rest;
  }
  return str;
}
function convexToJsonInternal(value, originalValue, context, includeTopLevelUndefined) {
  if (value === void 0) {
    const contextText = context && ` (present at path ${context} in original object ${stringifyValueForError(
      originalValue
    )})`;
    throw new Error(
      `undefined is not a valid Convex value${contextText}. To learn about Convex's supported types, see https://docs.convex.dev/using/types.`
    );
  }
  if (value === null) {
    return value;
  }
  if (typeof value === "bigint") {
    if (value < MIN_INT64 || MAX_INT64 < value) {
      throw new Error(
        `BigInt ${value} does not fit into a 64-bit signed integer.`
      );
    }
    return { $integer: bigIntToBase64(value) };
  }
  if (typeof value === "number") {
    if (isSpecial(value)) {
      const buffer = new ArrayBuffer(8);
      new DataView(buffer).setFloat64(0, value, LITTLE_ENDIAN);
      return { $float: fromByteArray(new Uint8Array(buffer)) };
    } else {
      return value;
    }
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return { $bytes: fromByteArray(new Uint8Array(value)) };
  }
  if (Array.isArray(value)) {
    return value.map(
      (value2, i) => convexToJsonInternal(value2, originalValue, context + `[${i}]`, false)
    );
  }
  if (value instanceof Set) {
    throw new Error(
      errorMessageForUnsupportedType(context, "Set", [...value], originalValue)
    );
  }
  if (value instanceof Map) {
    throw new Error(
      errorMessageForUnsupportedType(context, "Map", [...value], originalValue)
    );
  }
  if (!isSimpleObject(value)) {
    const theType = value?.constructor?.name;
    const typeName = theType ? `${theType} ` : "";
    throw new Error(
      errorMessageForUnsupportedType(context, typeName, value, originalValue)
    );
  }
  const out = {};
  const entries = Object.entries(value);
  entries.sort(([k1, _v1], [k2, _v2]) => k1 === k2 ? 0 : k1 < k2 ? -1 : 1);
  for (const [k, v2] of entries) {
    if (v2 !== void 0) {
      validateObjectField(k);
      out[k] = convexToJsonInternal(v2, originalValue, context + `.${k}`, false);
    } else if (includeTopLevelUndefined) {
      validateObjectField(k);
      out[k] = convexOrUndefinedToJsonInternal(
        v2,
        originalValue,
        context + `.${k}`
      );
    }
  }
  return out;
}
function errorMessageForUnsupportedType(context, typeName, value, originalValue) {
  if (context) {
    return `${typeName}${stringifyValueForError(
      value
    )} is not a supported Convex type (present at path ${context} in original object ${stringifyValueForError(
      originalValue
    )}). To learn about Convex's supported types, see https://docs.convex.dev/using/types.`;
  } else {
    return `${typeName}${stringifyValueForError(
      value
    )} is not a supported Convex type.`;
  }
}
function convexOrUndefinedToJsonInternal(value, originalValue, context) {
  if (value === void 0) {
    return { $undefined: null };
  } else {
    if (originalValue === void 0) {
      throw new Error(
        `Programming error. Current value is ${stringifyValueForError(
          value
        )} but original value is undefined`
      );
    }
    return convexToJsonInternal(value, originalValue, context, false);
  }
}
function convexToJson(value) {
  return convexToJsonInternal(value, value, "", false);
}

// node_modules/convex/dist/esm/values/validators.js
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var UNDEFINED_VALIDATOR_ERROR_URL = "https://docs.convex.dev/error#undefined-validator";
function throwUndefinedValidatorError(context, fieldName) {
  const fieldInfo = fieldName !== void 0 ? ` for field "${fieldName}"` : "";
  throw new Error(
    `A validator is undefined${fieldInfo} in ${context}. This is often caused by circular imports. See ${UNDEFINED_VALIDATOR_ERROR_URL} for details.`
  );
}
var BaseValidator = class {
  constructor({ isOptional }) {
    __publicField(this, "type");
    __publicField(this, "fieldPaths");
    __publicField(this, "isOptional");
    __publicField(this, "isConvexValidator");
    this.isOptional = isOptional;
    this.isConvexValidator = true;
  }
};
var VId = class _VId extends BaseValidator {
  /**
   * Usually you'd use `v.id(tableName)` instead.
   */
  constructor({
    isOptional,
    tableName
  }) {
    super({ isOptional });
    __publicField(this, "tableName");
    __publicField(this, "kind", "id");
    if (typeof tableName !== "string") {
      throw new Error("v.id(tableName) requires a string");
    }
    this.tableName = tableName;
  }
  /** @internal */
  get json() {
    return { type: "id", tableName: this.tableName };
  }
  /** @internal */
  asOptional() {
    return new _VId({
      isOptional: "optional",
      tableName: this.tableName
    });
  }
};
var VFloat64 = class _VFloat64 extends BaseValidator {
  constructor() {
    super(...arguments);
    __publicField(this, "kind", "float64");
  }
  /** @internal */
  get json() {
    return { type: "number" };
  }
  /** @internal */
  asOptional() {
    return new _VFloat64({
      isOptional: "optional"
    });
  }
};
var VInt64 = class _VInt64 extends BaseValidator {
  constructor() {
    super(...arguments);
    __publicField(this, "kind", "int64");
  }
  /** @internal */
  get json() {
    return { type: "bigint" };
  }
  /** @internal */
  asOptional() {
    return new _VInt64({ isOptional: "optional" });
  }
};
var VBoolean = class _VBoolean extends BaseValidator {
  constructor() {
    super(...arguments);
    __publicField(this, "kind", "boolean");
  }
  /** @internal */
  get json() {
    return { type: this.kind };
  }
  /** @internal */
  asOptional() {
    return new _VBoolean({
      isOptional: "optional"
    });
  }
};
var VBytes = class _VBytes extends BaseValidator {
  constructor() {
    super(...arguments);
    __publicField(this, "kind", "bytes");
  }
  /** @internal */
  get json() {
    return { type: this.kind };
  }
  /** @internal */
  asOptional() {
    return new _VBytes({ isOptional: "optional" });
  }
};
var VString = class _VString extends BaseValidator {
  constructor() {
    super(...arguments);
    __publicField(this, "kind", "string");
  }
  /** @internal */
  get json() {
    return { type: this.kind };
  }
  /** @internal */
  asOptional() {
    return new _VString({
      isOptional: "optional"
    });
  }
};
var VNull = class _VNull extends BaseValidator {
  constructor() {
    super(...arguments);
    __publicField(this, "kind", "null");
  }
  /** @internal */
  get json() {
    return { type: this.kind };
  }
  /** @internal */
  asOptional() {
    return new _VNull({ isOptional: "optional" });
  }
};
var VAny = class _VAny extends BaseValidator {
  constructor() {
    super(...arguments);
    __publicField(this, "kind", "any");
  }
  /** @internal */
  get json() {
    return {
      type: this.kind
    };
  }
  /** @internal */
  asOptional() {
    return new _VAny({
      isOptional: "optional"
    });
  }
};
var VObject = class _VObject extends BaseValidator {
  /**
   * Usually you'd use `v.object({ ... })` instead.
   */
  constructor({
    isOptional,
    fields
  }) {
    super({ isOptional });
    __publicField(this, "fields");
    __publicField(this, "kind", "object");
    globalThis.Object.entries(fields).forEach(([fieldName, validator]) => {
      if (validator === void 0) {
        throwUndefinedValidatorError("v.object()", fieldName);
      }
      if (!validator.isConvexValidator) {
        throw new Error("v.object() entries must be validators");
      }
    });
    this.fields = fields;
  }
  /** @internal */
  get json() {
    return {
      type: this.kind,
      value: globalThis.Object.fromEntries(
        globalThis.Object.entries(this.fields).map(([k, v2]) => [
          k,
          {
            fieldType: v2.json,
            optional: v2.isOptional === "optional" ? true : false
          }
        ])
      )
    };
  }
  /** @internal */
  asOptional() {
    return new _VObject({
      isOptional: "optional",
      fields: this.fields
    });
  }
  /**
   * Create a new VObject with the specified fields omitted.
   * @param fields The field names to omit from this VObject.
   */
  omit(...fields) {
    const newFields = { ...this.fields };
    for (const field of fields) {
      delete newFields[field];
    }
    return new _VObject({
      isOptional: this.isOptional,
      fields: newFields
    });
  }
  /**
   * Create a new VObject with only the specified fields.
   * @param fields The field names to pick from this VObject.
   */
  pick(...fields) {
    const newFields = {};
    for (const field of fields) {
      newFields[field] = this.fields[field];
    }
    return new _VObject({
      isOptional: this.isOptional,
      fields: newFields
    });
  }
  /**
   * Create a new VObject with all fields marked as optional.
   */
  partial() {
    const newFields = {};
    for (const [key, validator] of globalThis.Object.entries(this.fields)) {
      newFields[key] = validator.asOptional();
    }
    return new _VObject({
      isOptional: this.isOptional,
      fields: newFields
    });
  }
  /**
   * Create a new VObject with additional fields merged in.
   * @param fields An object with additional validators to merge into this VObject.
   */
  extend(fields) {
    return new _VObject({
      isOptional: this.isOptional,
      fields: { ...this.fields, ...fields }
    });
  }
};
var VLiteral = class _VLiteral extends BaseValidator {
  /**
   * Usually you'd use `v.literal(value)` instead.
   */
  constructor({ isOptional, value }) {
    super({ isOptional });
    __publicField(this, "value");
    __publicField(this, "kind", "literal");
    if (typeof value !== "string" && typeof value !== "boolean" && typeof value !== "number" && typeof value !== "bigint") {
      throw new Error("v.literal(value) must be a string, number, or boolean");
    }
    this.value = value;
  }
  /** @internal */
  get json() {
    return {
      type: this.kind,
      value: convexToJson(this.value)
    };
  }
  /** @internal */
  asOptional() {
    return new _VLiteral({
      isOptional: "optional",
      value: this.value
    });
  }
};
var VArray = class _VArray extends BaseValidator {
  /**
   * Usually you'd use `v.array(element)` instead.
   */
  constructor({
    isOptional,
    element
  }) {
    super({ isOptional });
    __publicField(this, "element");
    __publicField(this, "kind", "array");
    if (element === void 0) {
      throwUndefinedValidatorError("v.array()");
    }
    this.element = element;
  }
  /** @internal */
  get json() {
    return {
      type: this.kind,
      value: this.element.json
    };
  }
  /** @internal */
  asOptional() {
    return new _VArray({
      isOptional: "optional",
      element: this.element
    });
  }
};
var VRecord = class _VRecord extends BaseValidator {
  /**
   * Usually you'd use `v.record(key, value)` instead.
   */
  constructor({
    isOptional,
    key,
    value
  }) {
    super({ isOptional });
    __publicField(this, "key");
    __publicField(this, "value");
    __publicField(this, "kind", "record");
    if (key === void 0) {
      throwUndefinedValidatorError("v.record()", "key");
    }
    if (value === void 0) {
      throwUndefinedValidatorError("v.record()", "value");
    }
    if (key.isOptional === "optional") {
      throw new Error("Record validator cannot have optional keys");
    }
    if (value.isOptional === "optional") {
      throw new Error("Record validator cannot have optional values");
    }
    if (!key.isConvexValidator || !value.isConvexValidator) {
      throw new Error("Key and value of v.record() but be validators");
    }
    this.key = key;
    this.value = value;
  }
  /** @internal */
  get json() {
    return {
      type: this.kind,
      // This cast is needed because TypeScript thinks the key type is too wide
      keys: this.key.json,
      values: {
        fieldType: this.value.json,
        optional: false
      }
    };
  }
  /** @internal */
  asOptional() {
    return new _VRecord({
      isOptional: "optional",
      key: this.key,
      value: this.value
    });
  }
};
var VUnion = class _VUnion extends BaseValidator {
  /**
   * Usually you'd use `v.union(...members)` instead.
   */
  constructor({ isOptional, members }) {
    super({ isOptional });
    __publicField(this, "members");
    __publicField(this, "kind", "union");
    members.forEach((member, index) => {
      if (member === void 0) {
        throwUndefinedValidatorError("v.union()", `member at index ${index}`);
      }
      if (!member.isConvexValidator) {
        throw new Error("All members of v.union() must be validators");
      }
    });
    this.members = members;
  }
  /** @internal */
  get json() {
    return {
      type: this.kind,
      value: this.members.map((v2) => v2.json)
    };
  }
  /** @internal */
  asOptional() {
    return new _VUnion({
      isOptional: "optional",
      members: this.members
    });
  }
};

// node_modules/convex/dist/esm/values/validator.js
function isValidator(v2) {
  return !!v2.isConvexValidator;
}
var v = {
  /**
   * Validates that the value corresponds to an ID of a document in given table.
   * @param tableName The name of the table.
   */
  id: (tableName) => {
    return new VId({
      isOptional: "required",
      tableName
    });
  },
  /**
   * Validates that the value is of type Null.
   */
  null: () => {
    return new VNull({ isOptional: "required" });
  },
  /**
   * Validates that the value is of Convex type Float64 (Number in JS).
   *
   * Alias for `v.float64()`
   */
  number: () => {
    return new VFloat64({ isOptional: "required" });
  },
  /**
   * Validates that the value is of Convex type Float64 (Number in JS).
   */
  float64: () => {
    return new VFloat64({ isOptional: "required" });
  },
  /**
   * @deprecated Use `v.int64()` instead
   */
  bigint: () => {
    return new VInt64({ isOptional: "required" });
  },
  /**
   * Validates that the value is of Convex type Int64 (BigInt in JS).
   */
  int64: () => {
    return new VInt64({ isOptional: "required" });
  },
  /**
   * Validates that the value is of type Boolean.
   */
  boolean: () => {
    return new VBoolean({ isOptional: "required" });
  },
  /**
   * Validates that the value is of type String.
   */
  string: () => {
    return new VString({ isOptional: "required" });
  },
  /**
   * Validates that the value is of Convex type Bytes (constructed in JS via `ArrayBuffer`).
   */
  bytes: () => {
    return new VBytes({ isOptional: "required" });
  },
  /**
   * Validates that the value is equal to the given literal value.
   * @param literal The literal value to compare against.
   */
  literal: (literal) => {
    return new VLiteral({ isOptional: "required", value: literal });
  },
  /**
   * Validates that the value is an Array of the given element type.
   * @param element The validator for the elements of the array.
   */
  array: (element) => {
    return new VArray({ isOptional: "required", element });
  },
  /**
   * Validates that the value is an Object with the given properties.
   * @param fields An object specifying the validator for each property.
   */
  object: (fields) => {
    return new VObject({ isOptional: "required", fields });
  },
  /**
   * Validates that the value is a Record with keys and values that match the given types.
   * @param keys The validator for the keys of the record. This cannot contain string literals.
   * @param values The validator for the values of the record.
   */
  record: (keys, values) => {
    return new VRecord({
      isOptional: "required",
      key: keys,
      value: values
    });
  },
  /**
   * Validates that the value matches one of the given validators.
   * @param members The validators to match against.
   */
  union: (...members) => {
    return new VUnion({
      isOptional: "required",
      members
    });
  },
  /**
   * Does not validate the value.
   */
  any: () => {
    return new VAny({ isOptional: "required" });
  },
  /**
   * Allows not specifying a value for a property in an Object.
   * @param value The property value validator to make optional.
   *
   * ```typescript
   * const objectWithOptionalFields = v.object({
   *   requiredField: v.string(),
   *   optionalField: v.optional(v.string()),
   * });
   * ```
   */
  optional: (value) => {
    return value.asOptional();
  },
  /**
   * Allows specifying a value or null.
   */
  nullable: (value) => {
    return v.union(value, v.null());
  }
};

// node_modules/convex/dist/esm/values/errors.js
var __defProp2 = Object.defineProperty;
var __defNormalProp2 = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField2 = (obj, key, value) => __defNormalProp2(obj, typeof key !== "symbol" ? key + "" : key, value);
var _a;
var _b;
var IDENTIFYING_FIELD = /* @__PURE__ */ Symbol.for("ConvexError");
var ConvexError = class extends (_b = Error, _a = IDENTIFYING_FIELD, _b) {
  constructor(data) {
    super(typeof data === "string" ? data : stringifyValueForError(data));
    __publicField2(this, "name", "ConvexError");
    __publicField2(this, "data");
    __publicField2(this, _a, true);
    this.data = data;
  }
};

// node_modules/convex/dist/esm/values/compare_utf8.js
var arr = () => Array.from({ length: 4 }, () => 0);
var aBytes = arr();
var bBytes = arr();

// node_modules/convex/dist/esm/browser/logging.js
var __defProp3 = Object.defineProperty;
var __defNormalProp3 = (obj, key, value) => key in obj ? __defProp3(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField3 = (obj, key, value) => __defNormalProp3(obj, typeof key !== "symbol" ? key + "" : key, value);
var INFO_COLOR = "color:rgb(0, 145, 255)";
function prefix_for_source(source) {
  switch (source) {
    case "query":
      return "Q";
    case "mutation":
      return "M";
    case "action":
      return "A";
    case "any":
      return "?";
  }
}
var DefaultLogger = class {
  constructor(options) {
    __publicField3(this, "_onLogLineFuncs");
    __publicField3(this, "_verbose");
    this._onLogLineFuncs = {};
    this._verbose = options.verbose;
  }
  addLogLineListener(func) {
    let id = Math.random().toString(36).substring(2, 15);
    for (let i = 0; i < 10; i++) {
      if (this._onLogLineFuncs[id] === void 0) {
        break;
      }
      id = Math.random().toString(36).substring(2, 15);
    }
    this._onLogLineFuncs[id] = func;
    return () => {
      delete this._onLogLineFuncs[id];
    };
  }
  logVerbose(...args) {
    if (this._verbose) {
      for (const func of Object.values(this._onLogLineFuncs)) {
        func("debug", `${(/* @__PURE__ */ new Date()).toISOString()}`, ...args);
      }
    }
  }
  log(...args) {
    for (const func of Object.values(this._onLogLineFuncs)) {
      func("info", ...args);
    }
  }
  warn(...args) {
    for (const func of Object.values(this._onLogLineFuncs)) {
      func("warn", ...args);
    }
  }
  error(...args) {
    for (const func of Object.values(this._onLogLineFuncs)) {
      func("error", ...args);
    }
  }
};
function instantiateDefaultLogger(options) {
  const logger = new DefaultLogger(options);
  logger.addLogLineListener((level, ...args) => {
    switch (level) {
      case "debug":
        console.debug(...args);
        break;
      case "info":
        console.log(...args);
        break;
      case "warn":
        console.warn(...args);
        break;
      case "error":
        console.error(...args);
        break;
      default: {
        level;
        console.log(...args);
      }
    }
  });
  return logger;
}
function instantiateNoopLogger(options) {
  return new DefaultLogger(options);
}
function logForFunction(logger, type, source, udfPath, message) {
  const prefix = prefix_for_source(source);
  if (typeof message === "object") {
    message = `ConvexError ${JSON.stringify(message.errorData, null, 2)}`;
  }
  if (type === "info") {
    const match = message.match(/^\[.*?\] /);
    if (match === null) {
      logger.error(
        `[CONVEX ${prefix}(${udfPath})] Could not parse console.log`
      );
      return;
    }
    const level = message.slice(1, match[0].length - 2);
    const args = message.slice(match[0].length);
    logger.log(`%c[CONVEX ${prefix}(${udfPath})] [${level}]`, INFO_COLOR, args);
  } else {
    logger.error(`[CONVEX ${prefix}(${udfPath})] ${message}`);
  }
}

// node_modules/convex/dist/esm/server/functionName.js
var functionName = /* @__PURE__ */ Symbol.for("functionName");

// node_modules/convex/dist/esm/server/components/paths.js
var toReferencePath = /* @__PURE__ */ Symbol.for("toReferencePath");
function extractReferencePath(reference) {
  return reference[toReferencePath] ?? null;
}
function isFunctionHandle(s) {
  return s.startsWith("function://");
}
function getFunctionAddress(functionReference) {
  let functionAddress;
  if (typeof functionReference === "string") {
    if (isFunctionHandle(functionReference)) {
      functionAddress = { functionHandle: functionReference };
    } else {
      functionAddress = { name: functionReference };
    }
  } else if (functionReference[functionName]) {
    functionAddress = { name: functionReference[functionName] };
  } else {
    const referencePath = extractReferencePath(functionReference);
    if (!referencePath) {
      throw new Error(`${functionReference} is not a functionReference`);
    }
    functionAddress = { reference: referencePath };
  }
  return functionAddress;
}

// node_modules/convex/dist/esm/server/api.js
function getFunctionName(functionReference) {
  const address = getFunctionAddress(functionReference);
  if (address.name === void 0) {
    if (address.functionHandle !== void 0) {
      throw new Error(
        `Expected function reference like "api.file.func" or "internal.file.func", but received function handle ${address.functionHandle}`
      );
    } else if (address.reference !== void 0) {
      throw new Error(
        `Expected function reference in the current component like "api.file.func" or "internal.file.func", but received reference ${address.reference}`
      );
    }
    throw new Error(
      `Expected function reference like "api.file.func" or "internal.file.func", but received ${JSON.stringify(address)}`
    );
  }
  if (typeof functionReference === "string") return functionReference;
  const name = functionReference[functionName];
  if (!name) {
    throw new Error(`${functionReference} is not a functionReference`);
  }
  return name;
}
function createApi(pathParts = []) {
  const handler = {
    get(_, prop) {
      if (typeof prop === "string") {
        const newParts = [...pathParts, prop];
        return createApi(newParts);
      } else if (prop === functionName) {
        if (pathParts.length < 2) {
          const found = ["api", ...pathParts].join(".");
          throw new Error(
            `API path is expected to be of the form \`api.moduleName.functionName\`. Found: \`${found}\``
          );
        }
        const path = pathParts.slice(0, -1).join("/");
        const exportName = pathParts[pathParts.length - 1];
        if (exportName === "default") {
          return path;
        } else {
          return path + ":" + exportName;
        }
      } else if (prop === Symbol.toStringTag) {
        return "FunctionReference";
      } else {
        return void 0;
      }
    }
  };
  return new Proxy({}, handler);
}
var anyApi = createApi();

// node_modules/convex/dist/esm/vendor/long.js
var __defProp4 = Object.defineProperty;
var __defNormalProp4 = (obj, key, value) => key in obj ? __defProp4(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField4 = (obj, key, value) => __defNormalProp4(obj, typeof key !== "symbol" ? key + "" : key, value);
var Long = class _Long {
  constructor(low, high) {
    __publicField4(this, "low");
    __publicField4(this, "high");
    __publicField4(this, "__isUnsignedLong__");
    this.low = low | 0;
    this.high = high | 0;
    this.__isUnsignedLong__ = true;
  }
  static isLong(obj) {
    return (obj && obj.__isUnsignedLong__) === true;
  }
  // prettier-ignore
  static fromBytesLE(bytes) {
    return new _Long(
      bytes[0] | bytes[1] << 8 | bytes[2] << 16 | bytes[3] << 24,
      bytes[4] | bytes[5] << 8 | bytes[6] << 16 | bytes[7] << 24
    );
  }
  // prettier-ignore
  toBytesLE() {
    const hi = this.high;
    const lo = this.low;
    return [
      lo & 255,
      lo >>> 8 & 255,
      lo >>> 16 & 255,
      lo >>> 24,
      hi & 255,
      hi >>> 8 & 255,
      hi >>> 16 & 255,
      hi >>> 24
    ];
  }
  static fromNumber(value) {
    if (isNaN(value)) return UZERO;
    if (value < 0) return UZERO;
    if (value >= TWO_PWR_64_DBL) return MAX_UNSIGNED_VALUE;
    return new _Long(value % TWO_PWR_32_DBL | 0, value / TWO_PWR_32_DBL | 0);
  }
  toString() {
    return (BigInt(this.high) * BigInt(TWO_PWR_32_DBL) + BigInt(this.low)).toString();
  }
  equals(other) {
    if (!_Long.isLong(other)) other = _Long.fromValue(other);
    if (this.high >>> 31 === 1 && other.high >>> 31 === 1) return false;
    return this.high === other.high && this.low === other.low;
  }
  notEquals(other) {
    return !this.equals(other);
  }
  comp(other) {
    if (!_Long.isLong(other)) other = _Long.fromValue(other);
    if (this.equals(other)) return 0;
    return other.high >>> 0 > this.high >>> 0 || other.high === this.high && other.low >>> 0 > this.low >>> 0 ? -1 : 1;
  }
  lessThanOrEqual(other) {
    return this.comp(
      /* validates */
      other
    ) <= 0;
  }
  static fromValue(val) {
    if (typeof val === "number") return _Long.fromNumber(val);
    return new _Long(val.low, val.high);
  }
};
var UZERO = new Long(0, 0);
var TWO_PWR_16_DBL = 1 << 16;
var TWO_PWR_32_DBL = TWO_PWR_16_DBL * TWO_PWR_16_DBL;
var TWO_PWR_64_DBL = TWO_PWR_32_DBL * TWO_PWR_32_DBL;
var MAX_UNSIGNED_VALUE = new Long(4294967295 | 0, 4294967295 | 0);

// node_modules/convex/dist/esm/vendor/jwt-decode/index.js
var InvalidTokenError = class extends Error {
};
InvalidTokenError.prototype.name = "InvalidTokenError";

// node_modules/convex/dist/esm/browser/sync/authentication_manager.js
var MAXIMUM_REFRESH_DELAY = 20 * 24 * 60 * 60 * 1e3;

// node_modules/convex/dist/esm/browser/http_client.js
var __defProp5 = Object.defineProperty;
var __defNormalProp5 = (obj, key, value) => key in obj ? __defProp5(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField5 = (obj, key, value) => __defNormalProp5(obj, typeof key !== "symbol" ? key + "" : key, value);
var STATUS_CODE_UDF_FAILED = 560;
var specifiedFetch = void 0;
var ConvexHttpClient = class {
  /**
   * Create a new {@link ConvexHttpClient}.
   *
   * @param address - The url of your Convex deployment, often provided
   * by an environment variable. E.g. `https://small-mouse-123.convex.cloud`.
   * @param options - An object of options.
   * - `skipConvexDeploymentUrlCheck` - Skip validating that the Convex deployment URL looks like
   * `https://happy-animal-123.convex.cloud` or localhost. This can be useful if running a self-hosted
   * Convex backend that uses a different URL.
   * - `logger` - A logger or a boolean. If not provided, logs to the console.
   * You can construct your own logger to customize logging to log elsewhere
   * or not log at all, or use `false` as a shorthand for a no-op logger.
   * A logger is an object with 4 methods: log(), warn(), error(), and logVerbose().
   * These methods can receive multiple arguments of any types, like console.log().
   * - `auth` - A JWT containing identity claims accessible in Convex functions.
   * This identity may expire so it may be necessary to call `setAuth()` later,
   * but for short-lived clients it's convenient to specify this value here.
   * - `fetch` - A custom fetch implementation to use for all HTTP requests made by this client.
   */
  constructor(address, options) {
    __publicField5(this, "address");
    __publicField5(this, "auth");
    __publicField5(this, "adminAuth");
    __publicField5(this, "encodedTsPromise");
    __publicField5(this, "debug");
    __publicField5(this, "fetchOptions");
    __publicField5(this, "fetch");
    __publicField5(this, "logger");
    __publicField5(this, "mutationQueue", []);
    __publicField5(this, "isProcessingQueue", false);
    if (typeof options === "boolean") {
      throw new Error(
        "skipConvexDeploymentUrlCheck as the second argument is no longer supported. Please pass an options object, `{ skipConvexDeploymentUrlCheck: true }`."
      );
    }
    const opts = options ?? {};
    if (opts.skipConvexDeploymentUrlCheck !== true) {
      validateDeploymentUrl(address);
    }
    this.logger = options?.logger === false ? instantiateNoopLogger({ verbose: false }) : options?.logger !== true && options?.logger ? options.logger : instantiateDefaultLogger({ verbose: false });
    this.address = address;
    this.debug = true;
    this.auth = void 0;
    this.adminAuth = void 0;
    this.fetch = options?.fetch;
    if (options?.auth) {
      this.setAuth(options.auth);
    }
  }
  /**
   * Obtain the {@link ConvexHttpClient}'s URL to its backend.
   * @deprecated Use url, which returns the url without /api at the end.
   *
   * @returns The URL to the Convex backend, including the client's API version.
   */
  backendUrl() {
    return `${this.address}/api`;
  }
  /**
   * Return the address for this client, useful for creating a new client.
   *
   * Not guaranteed to match the address with which this client was constructed:
   * it may be canonicalized.
   */
  get url() {
    return this.address;
  }
  /**
   * Set the authentication token to be used for subsequent queries and mutations.
   *
   * Should be called whenever the token changes (i.e. due to expiration and refresh).
   *
   * @param value - JWT-encoded OpenID Connect identity token.
   */
  setAuth(value) {
    this.clearAuth();
    this.auth = value;
  }
  /**
   * Set admin auth token to allow calling internal queries, mutations, and actions
   * and acting as an identity.
   *
   * @internal
   */
  setAdminAuth(token, actingAsIdentity) {
    this.clearAuth();
    if (actingAsIdentity !== void 0) {
      const bytes = new TextEncoder().encode(JSON.stringify(actingAsIdentity));
      const actingAsIdentityEncoded = btoa(String.fromCodePoint(...bytes));
      this.adminAuth = `${token}:${actingAsIdentityEncoded}`;
    } else {
      this.adminAuth = token;
    }
  }
  /**
   * Clear the current authentication token if set.
   */
  clearAuth() {
    this.auth = void 0;
    this.adminAuth = void 0;
  }
  /**
   * Sets whether the result log lines should be printed on the console or not.
   *
   * @internal
   */
  setDebug(debug) {
    this.debug = debug;
  }
  /**
   * Used to customize the fetch behavior in some runtimes.
   *
   * @internal
   */
  setFetchOptions(fetchOptions) {
    this.fetchOptions = fetchOptions;
  }
  /**
   * This API is experimental: it may change or disappear.
   *
   * Execute a Convex query function at the same timestamp as every other
   * consistent query execution run by this HTTP client.
   *
   * This doesn't make sense for long-lived ConvexHttpClients as Convex
   * backends can read a limited amount into the past: beyond 30 seconds
   * in the past may not be available.
   *
   * Create a new client to use a consistent time.
   *
   * @param name - The name of the query.
   * @param args - The arguments object for the query. If this is omitted,
   * the arguments will be `{}`.
   * @returns A promise of the query's result.
   *
   * @deprecated This API is experimental: it may change or disappear.
   */
  async consistentQuery(query, ...args) {
    const queryArgs = parseArgs(args[0]);
    const timestampPromise = this.getTimestamp();
    return await this.queryInner(query, queryArgs, { timestampPromise });
  }
  async getTimestamp() {
    if (this.encodedTsPromise) {
      return this.encodedTsPromise;
    }
    return this.encodedTsPromise = this.getTimestampInner();
  }
  async getTimestampInner() {
    const localFetch = this.fetch || specifiedFetch || fetch;
    const headers = {
      "Content-Type": "application/json",
      "Convex-Client": `npm-${version}`
    };
    const response = await localFetch(`${this.address}/api/query_ts`, {
      ...this.fetchOptions,
      method: "POST",
      headers
    });
    if (!response.ok) {
      throw new Error(await response.text());
    }
    const { ts } = await response.json();
    return ts;
  }
  /**
   * Execute a Convex query function.
   *
   * @param name - The name of the query.
   * @param args - The arguments object for the query. If this is omitted,
   * the arguments will be `{}`.
   * @returns A promise of the query's result.
   */
  async query(query, ...args) {
    const queryArgs = parseArgs(args[0]);
    return await this.queryInner(query, queryArgs, {});
  }
  async queryInner(query, queryArgs, options) {
    const name = getFunctionName(query);
    const args = [convexToJson(queryArgs)];
    const headers = {
      "Content-Type": "application/json",
      "Convex-Client": `npm-${version}`
    };
    if (this.adminAuth) {
      headers["Authorization"] = `Convex ${this.adminAuth}`;
    } else if (this.auth) {
      headers["Authorization"] = `Bearer ${this.auth}`;
    }
    const localFetch = this.fetch || specifiedFetch || fetch;
    const timestamp = options.timestampPromise ? await options.timestampPromise : void 0;
    const body = JSON.stringify({
      path: name,
      format: "convex_encoded_json",
      args,
      ...timestamp ? { ts: timestamp } : {}
    });
    const endpoint = timestamp ? `${this.address}/api/query_at_ts` : `${this.address}/api/query`;
    const response = await localFetch(endpoint, {
      ...this.fetchOptions,
      body,
      method: "POST",
      headers
    });
    if (!response.ok && response.status !== STATUS_CODE_UDF_FAILED) {
      throw new Error(await response.text());
    }
    const respJSON = await response.json();
    if (this.debug) {
      for (const line of respJSON.logLines ?? []) {
        logForFunction(this.logger, "info", "query", name, line);
      }
    }
    switch (respJSON.status) {
      case "success":
        return jsonToConvex(respJSON.value);
      case "error":
        if (respJSON.errorData !== void 0) {
          throw forwardErrorData(
            respJSON.errorData,
            new ConvexError(respJSON.errorMessage)
          );
        }
        throw new Error(respJSON.errorMessage);
      default:
        throw new Error(`Invalid response: ${JSON.stringify(respJSON)}`);
    }
  }
  async mutationInner(mutation, mutationArgs) {
    const name = getFunctionName(mutation);
    const body = JSON.stringify({
      path: name,
      format: "convex_encoded_json",
      args: [convexToJson(mutationArgs)]
    });
    const headers = {
      "Content-Type": "application/json",
      "Convex-Client": `npm-${version}`
    };
    if (this.adminAuth) {
      headers["Authorization"] = `Convex ${this.adminAuth}`;
    } else if (this.auth) {
      headers["Authorization"] = `Bearer ${this.auth}`;
    }
    const localFetch = this.fetch || specifiedFetch || fetch;
    const response = await localFetch(`${this.address}/api/mutation`, {
      ...this.fetchOptions,
      body,
      method: "POST",
      headers
    });
    if (!response.ok && response.status !== STATUS_CODE_UDF_FAILED) {
      throw new Error(await response.text());
    }
    const respJSON = await response.json();
    if (this.debug) {
      for (const line of respJSON.logLines ?? []) {
        logForFunction(this.logger, "info", "mutation", name, line);
      }
    }
    switch (respJSON.status) {
      case "success":
        return jsonToConvex(respJSON.value);
      case "error":
        if (respJSON.errorData !== void 0) {
          throw forwardErrorData(
            respJSON.errorData,
            new ConvexError(respJSON.errorMessage)
          );
        }
        throw new Error(respJSON.errorMessage);
      default:
        throw new Error(`Invalid response: ${JSON.stringify(respJSON)}`);
    }
  }
  async processMutationQueue() {
    if (this.isProcessingQueue) {
      return;
    }
    this.isProcessingQueue = true;
    while (this.mutationQueue.length > 0) {
      const { mutation, args, resolve, reject } = this.mutationQueue.shift();
      try {
        const result = await this.mutationInner(mutation, args);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
    this.isProcessingQueue = false;
  }
  enqueueMutation(mutation, args) {
    return new Promise((resolve, reject) => {
      this.mutationQueue.push({ mutation, args, resolve, reject });
      void this.processMutationQueue();
    });
  }
  /**
   * Execute a Convex mutation function. Mutations are queued by default.
   *
   * @param name - The name of the mutation.
   * @param args - The arguments object for the mutation. If this is omitted,
   * the arguments will be `{}`.
   * @param options - An optional object containing
   * @returns A promise of the mutation's result.
   */
  async mutation(mutation, ...args) {
    const [fnArgs, options] = args;
    const mutationArgs = parseArgs(fnArgs);
    const queued = !options?.skipQueue;
    if (queued) {
      return await this.enqueueMutation(mutation, mutationArgs);
    } else {
      return await this.mutationInner(mutation, mutationArgs);
    }
  }
  /**
   * Execute a Convex action function. Actions are not queued.
   *
   * @param name - The name of the action.
   * @param args - The arguments object for the action. If this is omitted,
   * the arguments will be `{}`.
   * @returns A promise of the action's result.
   */
  async action(action, ...args) {
    const actionArgs = parseArgs(args[0]);
    const name = getFunctionName(action);
    const body = JSON.stringify({
      path: name,
      format: "convex_encoded_json",
      args: [convexToJson(actionArgs)]
    });
    const headers = {
      "Content-Type": "application/json",
      "Convex-Client": `npm-${version}`
    };
    if (this.adminAuth) {
      headers["Authorization"] = `Convex ${this.adminAuth}`;
    } else if (this.auth) {
      headers["Authorization"] = `Bearer ${this.auth}`;
    }
    const localFetch = this.fetch || specifiedFetch || fetch;
    const response = await localFetch(`${this.address}/api/action`, {
      ...this.fetchOptions,
      body,
      method: "POST",
      headers
    });
    if (!response.ok && response.status !== STATUS_CODE_UDF_FAILED) {
      throw new Error(await response.text());
    }
    const respJSON = await response.json();
    if (this.debug) {
      for (const line of respJSON.logLines ?? []) {
        logForFunction(this.logger, "info", "action", name, line);
      }
    }
    switch (respJSON.status) {
      case "success":
        return jsonToConvex(respJSON.value);
      case "error":
        if (respJSON.errorData !== void 0) {
          throw forwardErrorData(
            respJSON.errorData,
            new ConvexError(respJSON.errorMessage)
          );
        }
        throw new Error(respJSON.errorMessage);
      default:
        throw new Error(`Invalid response: ${JSON.stringify(respJSON)}`);
    }
  }
  /**
   * Execute a Convex function of an unknown type. These function calls are not queued.
   *
   * @param name - The name of the function.
   * @param args - The arguments object for the function. If this is omitted,
   * the arguments will be `{}`.
   * @returns A promise of the function's result.
   *
   * @internal
   */
  async function(anyFunction, componentPath, ...args) {
    const functionArgs = parseArgs(args[0]);
    const name = typeof anyFunction === "string" ? anyFunction : getFunctionName(anyFunction);
    const body = JSON.stringify({
      componentPath,
      path: name,
      format: "convex_encoded_json",
      args: convexToJson(functionArgs)
    });
    const headers = {
      "Content-Type": "application/json",
      "Convex-Client": `npm-${version}`
    };
    if (this.adminAuth) {
      headers["Authorization"] = `Convex ${this.adminAuth}`;
    } else if (this.auth) {
      headers["Authorization"] = `Bearer ${this.auth}`;
    }
    const localFetch = this.fetch || specifiedFetch || fetch;
    const response = await localFetch(`${this.address}/api/function`, {
      ...this.fetchOptions,
      body,
      method: "POST",
      headers
    });
    if (!response.ok && response.status !== STATUS_CODE_UDF_FAILED) {
      throw new Error(await response.text());
    }
    const respJSON = await response.json();
    if (this.debug) {
      for (const line of respJSON.logLines ?? []) {
        logForFunction(this.logger, "info", "any", name, line);
      }
    }
    switch (respJSON.status) {
      case "success":
        return jsonToConvex(respJSON.value);
      case "error":
        if (respJSON.errorData !== void 0) {
          throw forwardErrorData(
            respJSON.errorData,
            new ConvexError(respJSON.errorMessage)
          );
        }
        throw new Error(respJSON.errorMessage);
      default:
        throw new Error(`Invalid response: ${JSON.stringify(respJSON)}`);
    }
  }
};
function forwardErrorData(errorData, error) {
  error.data = jsonToConvex(errorData);
  return error;
}

// node_modules/convex/dist/esm/server/pagination.js
var paginationOptsValidator = v.object({
  numItems: v.number(),
  cursor: v.union(v.string(), v.null()),
  endCursor: v.optional(v.union(v.string(), v.null())),
  id: v.optional(v.number()),
  maximumRowsRead: v.optional(v.number()),
  maximumBytesRead: v.optional(v.number())
});

// node_modules/convex/dist/esm/server/schema.js
var __defProp6 = Object.defineProperty;
var __defNormalProp6 = (obj, key, value) => key in obj ? __defProp6(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField6 = (obj, key, value) => __defNormalProp6(obj, typeof key !== "symbol" ? key + "" : key, value);
var TableDefinition = class {
  /**
   * @internal
   */
  constructor(documentType) {
    __publicField6(this, "indexes");
    __publicField6(this, "stagedDbIndexes");
    __publicField6(this, "searchIndexes");
    __publicField6(this, "stagedSearchIndexes");
    __publicField6(this, "vectorIndexes");
    __publicField6(this, "stagedVectorIndexes");
    __publicField6(this, "validator");
    this.indexes = [];
    this.stagedDbIndexes = [];
    this.searchIndexes = [];
    this.stagedSearchIndexes = [];
    this.vectorIndexes = [];
    this.stagedVectorIndexes = [];
    this.validator = documentType;
  }
  /**
   * This API is experimental: it may change or disappear.
   *
   * Returns indexes defined on this table.
   * Intended for the advanced use cases of dynamically deciding which index to use for a query.
   * If you think you need this, please chime in on ths issue in the Convex JS GitHub repo.
   * https://github.com/get-convex/convex-js/issues/49
   */
  " indexes"() {
    return this.indexes;
  }
  index(name, indexConfig) {
    if (Array.isArray(indexConfig)) {
      this.indexes.push({
        indexDescriptor: name,
        fields: indexConfig
      });
    } else if (indexConfig.staged) {
      this.stagedDbIndexes.push({
        indexDescriptor: name,
        fields: indexConfig.fields
      });
    } else {
      this.indexes.push({
        indexDescriptor: name,
        fields: indexConfig.fields
      });
    }
    return this;
  }
  searchIndex(name, indexConfig) {
    if (indexConfig.staged) {
      this.stagedSearchIndexes.push({
        indexDescriptor: name,
        searchField: indexConfig.searchField,
        filterFields: indexConfig.filterFields || []
      });
    } else {
      this.searchIndexes.push({
        indexDescriptor: name,
        searchField: indexConfig.searchField,
        filterFields: indexConfig.filterFields || []
      });
    }
    return this;
  }
  vectorIndex(name, indexConfig) {
    if (indexConfig.staged) {
      this.stagedVectorIndexes.push({
        indexDescriptor: name,
        vectorField: indexConfig.vectorField,
        dimensions: indexConfig.dimensions,
        filterFields: indexConfig.filterFields || []
      });
    } else {
      this.vectorIndexes.push({
        indexDescriptor: name,
        vectorField: indexConfig.vectorField,
        dimensions: indexConfig.dimensions,
        filterFields: indexConfig.filterFields || []
      });
    }
    return this;
  }
  /**
   * Work around for https://github.com/microsoft/TypeScript/issues/57035
   */
  self() {
    return this;
  }
  /**
   * Export the contents of this definition.
   *
   * This is called internally by the Convex framework.
   * @internal
   */
  export() {
    const documentType = this.validator.json;
    if (typeof documentType !== "object") {
      throw new Error(
        "Invalid validator: please make sure that the parameter of `defineTable` is valid (see https://docs.convex.dev/database/schemas)"
      );
    }
    return {
      indexes: this.indexes,
      stagedDbIndexes: this.stagedDbIndexes,
      searchIndexes: this.searchIndexes,
      stagedSearchIndexes: this.stagedSearchIndexes,
      vectorIndexes: this.vectorIndexes,
      stagedVectorIndexes: this.stagedVectorIndexes,
      documentType
    };
  }
};
function defineTable(documentSchema) {
  if (isValidator(documentSchema)) {
    return new TableDefinition(documentSchema);
  } else {
    return new TableDefinition(v.object(documentSchema));
  }
}
var SchemaDefinition = class {
  /**
   * @internal
   */
  constructor(tables, options) {
    __publicField6(this, "tables");
    __publicField6(this, "strictTableNameTypes");
    __publicField6(this, "schemaValidation");
    this.tables = tables;
    this.schemaValidation = options?.schemaValidation === void 0 ? true : options.schemaValidation;
  }
  /**
   * Export the contents of this definition.
   *
   * This is called internally by the Convex framework.
   * @internal
   */
  export() {
    return JSON.stringify({
      tables: Object.entries(this.tables).map(([tableName, definition]) => {
        const {
          indexes,
          stagedDbIndexes,
          searchIndexes,
          stagedSearchIndexes,
          vectorIndexes,
          stagedVectorIndexes,
          documentType
        } = definition.export();
        return {
          tableName,
          indexes,
          stagedDbIndexes,
          searchIndexes,
          stagedSearchIndexes,
          vectorIndexes,
          stagedVectorIndexes,
          documentType
        };
      }),
      schemaValidation: this.schemaValidation
    });
  }
};
function defineSchema(schema, options) {
  return new SchemaDefinition(schema, options);
}
var _systemSchema = defineSchema({
  _scheduled_functions: defineTable({
    name: v.string(),
    args: v.array(v.any()),
    scheduledTime: v.float64(),
    completedTime: v.optional(v.float64()),
    state: v.union(
      v.object({ kind: v.literal("pending") }),
      v.object({ kind: v.literal("inProgress") }),
      v.object({ kind: v.literal("success") }),
      v.object({ kind: v.literal("failed"), error: v.string() }),
      v.object({ kind: v.literal("canceled") })
    )
  }),
  _storage: defineTable({
    sha256: v.string(),
    size: v.float64(),
    contentType: v.optional(v.string())
  })
});

// packages/extension/convex/client.ts
var STORAGE_KEYS = {
  accessToken: "convexAccessToken",
  refreshToken: "convexRefreshToken",
  expiresAt: "convexTokenExpiresAt",
  userId: "convexUserId",
  userEmail: "convexUserEmail",
  subscriptionPlan: "convexSubscriptionPlan",
  subscriptionStatus: "convexSubscriptionStatus",
  subscriptionCurrentPeriodEnd: "convexSubscriptionCurrentPeriodEnd",
  subscriptionCheckedAt: "convexSubscriptionCheckedAt",
  convexUrl: "convexUrl"
};
var CONVEX_DEPLOYMENT_URL = String(true ? "https://energetic-firefly-297.convex.cloud" : "").trim();
var runtimeConvexUrl = CONVEX_DEPLOYMENT_URL;
var convexClient = runtimeConvexUrl ? new ConvexHttpClient(runtimeConvexUrl) : null;
var resolveStoredConvexUrl = async () => {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.convexUrl]);
  return String(stored?.[STORAGE_KEYS.convexUrl] || "").trim();
};
var ensureClient = async () => {
  if (convexClient) return convexClient;
  if (!runtimeConvexUrl) {
    runtimeConvexUrl = await resolveStoredConvexUrl();
  }
  if (!runtimeConvexUrl) {
    throw new Error("Convex backend is not configured. Set CONVEX_URL in .env.local or storage.");
  }
  convexClient = new ConvexHttpClient(runtimeConvexUrl);
  return convexClient;
};
var decodeJwtExpiryMs = (token) => {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return Date.now() + 45 * 60 * 1e3;
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));
    const expSeconds = Number(payload?.exp || 0);
    if (!Number.isFinite(expSeconds) || expSeconds <= 0) return Date.now() + 45 * 60 * 1e3;
    return expSeconds * 1e3;
  } catch {
    return Date.now() + 45 * 60 * 1e3;
  }
};
var applyAuthTokenToClient = (token) => {
  if (!convexClient) return;
  if (token) {
    convexClient.setAuth(token);
  } else {
    convexClient.clearAuth();
  }
};
var setStorageDefaults = async () => {
  const url = runtimeConvexUrl || (convexClient ? convexClient.url : "");
  if (!url) return;
  await chrome.storage.local.set({
    [STORAGE_KEYS.convexUrl]: url
  });
};
var readStoredAuth = async () => {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.accessToken,
    STORAGE_KEYS.refreshToken,
    STORAGE_KEYS.expiresAt
  ]);
  return stored;
};
var saveAuthTokens = async (tokens) => {
  const expiresAt = decodeJwtExpiryMs(tokens.token);
  await chrome.storage.local.set({
    [STORAGE_KEYS.accessToken]: tokens.token,
    [STORAGE_KEYS.refreshToken]: tokens.refreshToken,
    [STORAGE_KEYS.expiresAt]: expiresAt
  });
  applyAuthTokenToClient(tokens.token);
};
var clearAuthStorage = async () => {
  await chrome.storage.local.remove([
    STORAGE_KEYS.accessToken,
    STORAGE_KEYS.refreshToken,
    STORAGE_KEYS.expiresAt,
    STORAGE_KEYS.userId,
    STORAGE_KEYS.userEmail,
    STORAGE_KEYS.subscriptionPlan,
    STORAGE_KEYS.subscriptionStatus,
    STORAGE_KEYS.subscriptionCurrentPeriodEnd,
    STORAGE_KEYS.subscriptionCheckedAt
  ]);
  applyAuthTokenToClient(void 0);
};
var maybePersistAuthResult = async (result) => {
  if (result?.tokens?.token && result?.tokens?.refreshToken) {
    await saveAuthTokens(result.tokens);
  }
};
var refreshAccessTokenIfNeeded = async () => {
  if (!convexClient) return;
  const stored = await readStoredAuth();
  const accessToken = stored.convexAccessToken;
  if (!accessToken) {
    applyAuthTokenToClient(void 0);
    return;
  }
  const expiresAt = Number(stored.convexTokenExpiresAt || 0);
  if (Number.isFinite(expiresAt) && expiresAt > Date.now() + 6e4) {
    applyAuthTokenToClient(accessToken);
    return;
  }
  const refreshToken = stored.convexRefreshToken;
  if (!refreshToken) {
    applyAuthTokenToClient(accessToken);
    return;
  }
  try {
    const refreshed = await convexClient.action(anyApi.auth.signIn, {
      refreshToken
    });
    await maybePersistAuthResult(refreshed);
  } catch {
    applyAuthTokenToClient(accessToken);
  }
};
var syncAccountSnapshotToStorage = async (user, subscription) => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.userId]: user?._id || "",
    [STORAGE_KEYS.userEmail]: user?.email || "",
    [STORAGE_KEYS.subscriptionPlan]: subscription?.plan || "free",
    [STORAGE_KEYS.subscriptionStatus]: subscription?.status || "inactive",
    [STORAGE_KEYS.subscriptionCurrentPeriodEnd]: subscription?.currentPeriodEnd || null,
    [STORAGE_KEYS.subscriptionCheckedAt]: Date.now()
  });
};
var ensureAuthReady = async () => {
  await ensureClient();
  await setStorageDefaults();
  await refreshAccessTokenIfNeeded();
};
async function signInWithPassword(email, password) {
  await ensureAuthReady();
  const client = await ensureClient();
  const result = await client.action(anyApi.auth.signIn, {
    provider: "password",
    params: { flow: "signIn", email, password }
  });
  await maybePersistAuthResult(result);
  return result;
}
async function signUpWithPassword(email, password) {
  await ensureAuthReady();
  const client = await ensureClient();
  const result = await client.action(anyApi.auth.signIn, {
    provider: "password",
    params: { flow: "signUp", email, password }
  });
  await maybePersistAuthResult(result);
  return result;
}
async function signInWithOAuth(provider) {
  await ensureAuthReady();
  const client = await ensureClient();
  const redirectBase = typeof location !== "undefined" && location.origin ? location.origin : "https://example.com";
  const result = await client.action(anyApi.auth.signIn, {
    provider,
    params: {
      redirectTo: `${redirectBase}/billing`
    }
  });
  await maybePersistAuthResult(result);
  return result;
}
async function signOutAccount() {
  await ensureAuthReady();
  const client = await ensureClient();
  await client.action(anyApi.auth.signOut, {});
  await clearAuthStorage();
}
async function getAuthState() {
  await ensureAuthReady();
  const client = await ensureClient();
  const authenticated = await client.query(anyApi.auth.isAuthenticated, {});
  if (!authenticated) {
    await clearAuthStorage();
    return { authenticated: false, user: null, subscription: null };
  }
  const [user, subscription] = await Promise.all([
    client.query(anyApi.users.me, {}),
    client.query(anyApi.subscriptions.getCurrent, {})
  ]);
  await syncAccountSnapshotToStorage(user, subscription);
  return { authenticated: true, user, subscription };
}
async function createCheckoutSession() {
  await ensureAuthReady();
  const client = await ensureClient();
  return client.action(anyApi.payments.createCheckoutSession, {});
}
async function manageSubscription() {
  await ensureAuthReady();
  const client = await ensureClient();
  return client.action(anyApi.payments.manageSubscription, {});
}
var hasActiveSubscription = (subscription) => Boolean(subscription && subscription.plan === "pro" && subscription.status === "active");

// packages/extension/sidepanel/ui/account/panel-account.ts
var ACCOUNT_MODE_KEY = "accountModeChoice";
var ACCOUNT_MODE_BYOK = "byok";
var ACCOUNT_MODE_PAID = "paid";
var setHidden = (element, hidden) => {
  if (!element) return;
  element.classList.toggle("hidden", hidden);
};
var toUsageLabel = (usage) => {
  const requestCount = Number(usage?.requestCount || 0);
  const tokensUsed = Number(usage?.tokensUsed || 0);
  return `${requestCount} req \xB7 ${tokensUsed} tokens`;
};
var updateStatusCopy = (ui, text) => {
  if (ui.elements.accountStatusText) {
    ui.elements.accountStatusText.textContent = text;
  }
  const signedInStatus = document.getElementById("accountStatusTextSignedIn");
  if (signedInStatus) {
    signedInStatus.textContent = text;
  }
};
SidePanelUI.prototype.setAccountUiBusy = function setAccountUiBusy(busy) {
  const buttonIds = [
    "accountSignInBtn",
    "accountSignUpBtn",
    "accountGoogleBtn",
    "accountGithubBtn",
    "accountUpgradeBtn",
    "accountManageBtn",
    "accountRefreshBtn",
    "accountSignOutBtn",
    "accountChooseByokBtn",
    "accountChoosePaidBtn"
  ];
  buttonIds.forEach((id) => {
    const button = this.elements[id];
    if (button) {
      button.disabled = busy;
    }
  });
};
SidePanelUI.prototype.bindAccountEventListeners = function bindAccountEventListeners() {
  if (this._accountListenersBound) return;
  this._accountListenersBound = true;
  this.elements.accountChooseByokBtn?.addEventListener("click", () => {
    void this.chooseAccountMode(ACCOUNT_MODE_BYOK);
  });
  this.elements.accountChoosePaidBtn?.addEventListener("click", () => {
    void this.chooseAccountMode(ACCOUNT_MODE_PAID);
  });
  this.elements.accountSignInBtn?.addEventListener("click", () => {
    void this.handleAccountPasswordAuth("signIn");
  });
  this.elements.accountSignUpBtn?.addEventListener("click", () => {
    void this.handleAccountPasswordAuth("signUp");
  });
  this.elements.accountGoogleBtn?.addEventListener("click", () => {
    void this.handleAccountOAuth("google");
  });
  this.elements.accountGithubBtn?.addEventListener("click", () => {
    void this.handleAccountOAuth("github");
  });
  this.elements.accountUpgradeBtn?.addEventListener("click", () => {
    void this.startAccountCheckout();
  });
  this.elements.accountManageBtn?.addEventListener("click", () => {
    void this.openAccountBillingPortal();
  });
  this.elements.accountRefreshBtn?.addEventListener("click", () => {
    void this.refreshAccountPanel();
  });
  this.elements.accountSignOutBtn?.addEventListener("click", () => {
    void this.signOutFromAccount();
  });
};
SidePanelUI.prototype.initAccountPanel = async function initAccountPanel() {
  this.bindAccountEventListeners();
  await this.refreshAccountPanel({ silent: true });
  await this.showAccountOnboardingIfNeeded();
};
SidePanelUI.prototype.showAccountOnboardingIfNeeded = async function showAccountOnboardingIfNeeded() {
  const stored = await chrome.storage.local.get([ACCOUNT_MODE_KEY]);
  const hasChoice = stored[ACCOUNT_MODE_KEY] === ACCOUNT_MODE_BYOK || stored[ACCOUNT_MODE_KEY] === ACCOUNT_MODE_PAID;
  setHidden(this.elements.accountOnboardingModal, hasChoice);
  if (!hasChoice) {
    updateStatusCopy(this, "Choose BYOK or paid mode to continue setup.");
  }
};
SidePanelUI.prototype.chooseAccountMode = async function chooseAccountMode(mode) {
  await chrome.storage.local.set({ [ACCOUNT_MODE_KEY]: mode });
  setHidden(this.elements.accountOnboardingModal, true);
  if (mode === ACCOUNT_MODE_BYOK) {
    this.updateStatus("BYOK selected. Add your API key in Setup.", "success");
    updateStatusCopy(this, "BYOK mode active.");
    return;
  }
  this.openSettingsPanel?.();
  this.switchSettingsTab?.("oauth");
  this.updateStatus("Subscription mode selected. Sign in to continue.", "active");
  updateStatusCopy(this, "Sign in to activate paid proxy mode.");
};
SidePanelUI.prototype.handleAccountPasswordAuth = async function handleAccountPasswordAuth(mode) {
  const email = String(this.elements.accountEmailInput?.value || "").trim();
  const password = String(this.elements.accountPasswordInput?.value || "").trim();
  if (!email || !password) {
    updateStatusCopy(this, "Email and password are required.");
    return;
  }
  this.setAccountUiBusy(true);
  try {
    if (mode === "signIn") {
      await signInWithPassword(email, password);
    } else {
      await signUpWithPassword(email, password);
    }
    await chrome.storage.local.set({ [ACCOUNT_MODE_KEY]: ACCOUNT_MODE_PAID });
    await this.refreshAccountPanel();
    this.updateStatus(mode === "signIn" ? "Signed in" : "Account created", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "Unknown auth error");
    updateStatusCopy(this, message);
    this.updateStatus("Authentication failed", "error");
  } finally {
    this.setAccountUiBusy(false);
  }
};
SidePanelUI.prototype.handleAccountOAuth = async function handleAccountOAuth(provider) {
  this.setAccountUiBusy(true);
  try {
    const result = await signInWithOAuth(provider);
    const redirect = result?.redirect || "";
    if (redirect) {
      await chrome.tabs.create({ url: redirect });
      updateStatusCopy(this, `Opened ${provider} sign-in. Complete login in the new tab, then refresh.`);
    } else {
      updateStatusCopy(this, `Started ${provider} sign-in flow.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "OAuth failed");
    updateStatusCopy(this, message);
    this.updateStatus("OAuth failed", "error");
  } finally {
    this.setAccountUiBusy(false);
  }
};
SidePanelUI.prototype.startAccountCheckout = async function startAccountCheckout() {
  this.setAccountUiBusy(true);
  try {
    const result = await createCheckoutSession();
    if (result?.url) {
      await chrome.tabs.create({ url: String(result.url) });
      updateStatusCopy(this, "Stripe checkout opened in a new tab.");
    } else {
      throw new Error("Checkout URL was not returned.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "Checkout failed");
    updateStatusCopy(this, message);
    this.updateStatus("Unable to open checkout", "error");
  } finally {
    this.setAccountUiBusy(false);
  }
};
SidePanelUI.prototype.openAccountBillingPortal = async function openAccountBillingPortal() {
  this.setAccountUiBusy(true);
  try {
    const result = await manageSubscription();
    if (result?.url) {
      await chrome.tabs.create({ url: String(result.url) });
      updateStatusCopy(this, "Billing portal opened in a new tab.");
    } else {
      throw new Error("Billing portal URL was not returned.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "Billing portal failed");
    updateStatusCopy(this, message);
    this.updateStatus("Unable to open billing portal", "error");
  } finally {
    this.setAccountUiBusy(false);
  }
};
SidePanelUI.prototype.signOutFromAccount = async function signOutFromAccount() {
  this.setAccountUiBusy(true);
  try {
    await signOutAccount();
    await this.refreshAccountPanel({ silent: true });
    updateStatusCopy(this, "Signed out.");
    this.updateStatus("Signed out", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "Sign-out failed");
    updateStatusCopy(this, message);
    this.updateStatus("Sign out failed", "error");
  } finally {
    this.setAccountUiBusy(false);
  }
};
SidePanelUI.prototype.refreshAccountPanel = async function refreshAccountPanel({ silent = false } = {}) {
  if (!CONVEX_DEPLOYMENT_URL) {
    setHidden(this.elements.accountAuthUnavailable, false);
    setHidden(this.elements.accountAuthSignedOut, true);
    setHidden(this.elements.accountAuthSignedIn, true);
    updateStatusCopy(this, "Set CONVEX_URL and rebuild to enable account features.");
    return;
  }
  setHidden(this.elements.accountAuthUnavailable, true);
  this.setAccountUiBusy(true);
  try {
    const state = await getAuthState();
    if (!state.authenticated) {
      setHidden(this.elements.accountAuthSignedOut, false);
      setHidden(this.elements.accountAuthSignedIn, true);
      updateStatusCopy(this, "Not signed in.");
      if (!silent) this.updateStatus("Account: signed out", "warning");
      return;
    }
    setHidden(this.elements.accountAuthSignedOut, true);
    setHidden(this.elements.accountAuthSignedIn, false);
    const userEmail = String(state.user?.email || "Unknown user");
    const sub = state.subscription || null;
    const paidActive = hasActiveSubscription(sub);
    const planLabel = paidActive ? "Pro (active)" : `Free (${sub?.status || "inactive"})`;
    if (this.elements.accountUserValue) this.elements.accountUserValue.textContent = userEmail;
    if (this.elements.accountPlanValue) this.elements.accountPlanValue.textContent = planLabel;
    if (this.elements.accountUsageValue) this.elements.accountUsageValue.textContent = toUsageLabel(sub?.usage);
    setHidden(this.elements.accountUpgradeBtn, paidActive);
    setHidden(this.elements.accountManageBtn, !paidActive);
    updateStatusCopy(this, paidActive ? "Paid plan active. Proxy mode available." : "Free plan active.");
    if (!silent) this.updateStatus("Account refreshed", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "Failed to refresh account");
    updateStatusCopy(this, message);
    if (!silent) this.updateStatus("Unable to load account state", "error");
  } finally {
    this.setAccountUiBusy(false);
  }
};

// packages/extension/sidepanel/ui/core/layout-loader.ts
var loadTemplate = async (path) => {
  const url = chrome.runtime.getURL(`sidepanel/templates/${path}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load template: ${path}`);
  }
  return response.text();
};
var injectInnerHtml = (root, selector, html) => {
  const target = root.querySelector(selector);
  if (!target) return;
  target.innerHTML = html.trim();
};
var loadPanelLayout = async () => {
  const appRoot = document.getElementById("appRoot");
  if (!appRoot) return;
  const [sidebarShell, mainContent, settingsPanel, settingsGeneral, settingsProfiles, tabSelector] = await Promise.all([
    loadTemplate("sidebar-shell.html"),
    loadTemplate("main.html"),
    loadTemplate("panels/settings.html"),
    loadTemplate("panels/settings-general.html"),
    loadTemplate("panels/settings-profiles.html"),
    loadTemplate("tab-selector.html")
  ]);
  appRoot.className = "app-container";
  appRoot.innerHTML = "";
  const appContainer = appRoot;
  appContainer.insertAdjacentHTML("beforeend", sidebarShell.trim());
  appContainer.insertAdjacentHTML("beforeend", mainContent.trim());
  const rightPanels = appContainer.querySelector("#rightPanelPanels");
  rightPanels?.insertAdjacentHTML("beforeend", settingsPanel.trim());
  const tmp = document.createElement("div");
  tmp.innerHTML = settingsGeneral.trim();
  const panes = tmp.querySelectorAll(".settings-tab-pane[data-pane]");
  for (const pane of Array.from(panes)) {
    const paneName = pane.dataset.pane;
    if (!paneName) continue;
    const containerId = `#settingsTab${paneName.charAt(0).toUpperCase() + paneName.slice(1)}`;
    const container = appContainer.querySelector(containerId);
    if (container) {
      container.innerHTML = pane.outerHTML;
    }
  }
  injectInnerHtml(appContainer, "#settingsTabProfiles", settingsProfiles);
  const modalRoot = document.getElementById("modalRoot");
  if (modalRoot) {
    modalRoot.innerHTML = tabSelector;
  }
};

// packages/extension/sidepanel/panel.ts
var init2 = async () => {
  await loadPanelLayout();
  const ui = new SidePanelUI();
  window.sidePanelUI = ui;
};
void init2();
//# sourceMappingURL=panel.js.map
