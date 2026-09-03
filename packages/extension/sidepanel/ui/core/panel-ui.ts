import type { RecordedContext, RunPlan } from '@parchi/shared';
import type { Message } from '../../../ai/messages/schema.js';
import type { SubagentEntry, UsageStats } from '../types/panel-types.js';
import { getSidePanelElements } from './panel-elements.js';
export class SidePanelUI {
  // Allow prototype augmentation across panel-*.ts modules.
  [key: string]: any;
  elements: Record<string, any>;
  displayHistory: Message[];
  contextHistory: Message[];
  sessionId: string;
  sessionStartedAt: number;
  firstUserMessage: string;
  currentConfig: string;
  configs: Record<string, any>;
  providers: Record<string, any>;
  toolCallViews: Map<string, any>;
  lastChatTurn: HTMLElement | null;
  selectedTabs: Map<number, any>;
  tabGroupInfo: Map<number, chrome.tabGroups.TabGroup>;
  scrollPositions: Map<string, number>;
  pendingToolCount: number;
  isStreaming: boolean;
  thinkingStartedAt: number | null;
  thinkingTimerId: number | null;
  runStartedAt: number | null;
  runTimerId: number | null;
  streamingState: {
    container: HTMLElement;
    eventsEl: HTMLElement | null;
    lastEventType?: 'text' | 'reasoning' | 'tool' | 'plan';
    textEventEl?: HTMLElement | null;
    reasoningEventEl?: HTMLElement | null;
    textBuffer?: string;
    reasoningBuffer?: string;
    planEl?: HTMLElement | null;
    planListEl?: HTMLOListElement | null;
    planMetaEl?: HTMLElement | null;
  } | null;
  userScrolledUp: boolean;
  isNearBottom: boolean;
  chatResizeObserver: ResizeObserver | null;
  contextUsage: {
    approxTokens: number;
    maxContextTokens: number;
    percent: number;
  };
  contextCompactionState: {
    inProgress: boolean;
    lastResult: 'success' | 'skipped' | 'error' | null;
    lastMessage: string | null;
    lastTrimmedCount?: number;
    lastPreservedCount?: number;
    lastCompactedAt: number;
    lastCompletedAt: number;
    lastTrigger?: string;
    lastSource?: string;
    lastBeforePercent?: number | null;
    lastAfterPercent?: number | null;
    lastMetrics?: Record<string, unknown> | null;
    lastEvent?: {
      stage?: string;
      note?: string;
      source?: string;
      details?: Record<string, unknown>;
      timestamp?: number;
    } | null;
  };
  sessionTokensUsed: number;
  lastUsage: UsageStats | null;
  sessionTokenTotals: UsageStats;
  uiZoom: number;
  fontPreset: string;
  fontStylePreset: string;
  toolPermissions: {
    read: boolean;
    interact: boolean;
    navigate: boolean;
    tabs: boolean;
    screenshots: boolean;
  };
  auxAgentProfiles: string[];
  currentView: 'chat' | 'history';
  currentSettingsTab: 'providers' | 'model' | 'generation' | 'display' | 'advanced';
  profileEditorTarget: string;
  subagents: Map<string, SubagentEntry>;
  activeAgent: string;
  tabToAgentId: Map<number, string>;
  missionControlOpen: boolean;
  mcSelectedAgentId: string | null;

  activityPanelOpen: boolean;
  latestThinking: string | null;
  activeToolName: string | null;
  streamingReasoning: string;
  streamingUsageEstimatedTokens: number;
  streamingUsageEstimatedTokensApplied: number;
  currentPlan: RunPlan | null;
  stepTimeline: {
    steps: Map<number, { el: HTMLElement; toolsEl: HTMLElement; bodyEl: HTMLElement }>;
    activeStepIndex: number | null;
    activeStepBody: HTMLElement | null;
  };
  historyTurnMap: Map<
    string,
    {
      id: string;
      startedAt: number;
      userMessage: string;
      plan: RunPlan | null;
      toolEvents: Array<Record<string, unknown>>;
      assistantFinal?: {
        content: string;
        thinking?: string | null;
        model?: string | null;
        usage?: Record<string, unknown> | null;
      };
    }
  >;
  pendingTurnDraft: { userMessage: string; startedAt: number } | null;
  queuedMessage: string | null;
  isReplayingHistory: boolean;
  _lastRuntimeMessageAt: number;
  _watchdogTimerId: ReturnType<typeof setInterval> | null;
  _deleteConfirmTarget: string | null;
  _deleteConfirmAt: number | null;
  timelineCollapsed: boolean;
  currentColorMode: 'light' | 'dark' | 'system';
  _colorModeMediaQuery: MediaQueryList | null;
  _colorModeMediaQueryHandler: (() => void) | null;
  currentTheme: string;
  workflows: Array<{ id: string; name: string; prompt: string; createdAt: number }>;
  workflowMenuOpen: boolean;
  workflowMenuIndex: number;
  _lastTypingAt: number;
  _typingCheckTimerId: number | null;
  _mascotBubbleOpen: boolean;
  _currentVerb: string | null;
  recordingState: { status: 'idle' | 'recording' | 'selecting'; elapsedMs: number; timerId: number | null };
  pendingRecordedContext: RecordedContext | null;
  reviewState: {
    events: import('@parchi/shared').RecordingEvent[];
    screenshots: import('@parchi/shared').RecordingScreenshot[];
    excludedEventIndices: Set<number>;
    selectedScreenshotIds: Set<string>;
    activeTab: 'actions' | 'screenshots';
  } | null;
  reportImages: Map<
    string,
    {
      id: string;
      dataUrl: string;
      capturedAt: number;
      toolCallId?: string;
      tabId?: number;
      url?: string;
      title?: string;
      visionDescription?: string;
      selected: boolean;
      _blobUrl?: string;
    }
  >;
  reportImageOrder: string[];
  selectedReportImageIds: Set<string>;
  lifecyclePort: chrome.runtime.Port | null;
  modelCatalogEntries: Array<{ provider: string; model: string }>;
  modelCatalogUpdatedAt: number;
  modelCatalogRefreshPromise: Promise<void> | null;
  _autoSaveDirHandle: any;
  declare init: () => Promise<void>; // Methods attached via prototype in panel-modules

  constructor() {
    this.elements = getSidePanelElements();
    this.displayHistory = [];
    this.contextHistory = [];
    const suffix = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : String(Date.now());
    this.sessionId = `session-${suffix}`;
    this.sessionStartedAt = Date.now();
    this.firstUserMessage = '';
    this.currentConfig = 'default';
    this.configs = { default: {} };
    this.providers = {};
    this.toolCallViews = new Map();
    this.lastChatTurn = null;
    this.selectedTabs = new Map();
    this.tabGroupInfo = new Map();
    this.scrollPositions = new Map();
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
      maxContextTokens: 196000,
      percent: 0,
    };
    this.contextCompactionState = {
      inProgress: false,
      lastResult: null,
      lastMessage: null,
      lastCompactedAt: 0,
      lastCompletedAt: 0,
      lastMetrics: null,
      lastEvent: null,
    };
    this.sessionTokensUsed = 0;
    this.lastUsage = null;
    this.sessionTokenTotals = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
    this.uiZoom = 1;
    this.fontPreset = 'default';
    this.fontStylePreset = 'normal';
    this.toolPermissions = {
      read: true,
      interact: true,
      navigate: true,
      tabs: true,
      screenshots: true,
    };
    this.auxAgentProfiles = [];
    this.currentView = 'chat';
    this.currentSettingsTab = 'providers';
    this.profileEditorTarget = 'default';
    this.subagents = new Map();
    this.activeAgent = 'main';
    this.tabToAgentId = new Map();
    this.missionControlOpen = false;
    this.mcSelectedAgentId = null;

    this.activityPanelOpen = false;
    this.latestThinking = null;
    this.activeToolName = null;
    this.streamingReasoning = '';
    this.streamingUsageEstimatedTokens = 0;
    this.streamingUsageEstimatedTokensApplied = 0;
    this.currentPlan = null;
    this.stepTimeline = {
      steps: new Map(),
      activeStepIndex: null,
      activeStepBody: null,
    };
    this.historyTurnMap = new Map();
    this.pendingTurnDraft = null;
    this.queuedMessage = null;
    this.isReplayingHistory = false;
    this._lastRuntimeMessageAt = 0;
    this._watchdogTimerId = null;
    this._deleteConfirmTarget = null;
    this._deleteConfirmAt = null;
    this.timelineCollapsed = true;
    this._colorModeMediaQuery = null;
    this._colorModeMediaQueryHandler = null;
    this.currentColorMode = 'dark';
    this.currentTheme = 'void';
    this.workflows = [];
    this.workflowMenuOpen = false;
    this.workflowMenuIndex = -1;
    this._lastTypingAt = 0;
    this._typingCheckTimerId = null;
    this._mascotBubbleOpen = false;
    this._currentVerb = null;
    this.recordingState = { status: 'idle', elapsedMs: 0, timerId: null };
    this.pendingRecordedContext = null;
    this.reviewState = null;
    this.reportImages = new Map();
    this.reportImageOrder = [];
    this.selectedReportImageIds = new Set();
    this.lifecyclePort = null;
    this.modelCatalogEntries = [];
    this.modelCatalogUpdatedAt = 0;
    this.modelCatalogRefreshPromise = null;
    this._autoSaveDirHandle = null;
    void this.init();
  }
}
