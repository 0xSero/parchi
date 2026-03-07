import { APICallError } from '@ai-sdk/provider';
import { generateText, stepCountIs, streamText } from 'ai';
import {
  buildOrchestratorPlan,
  getDispatchableOrchestratorTaskIds,
  getOrchestratorPlanValidationIssues,
  getReadyOrchestratorTaskIds,
  normalizeOrchestratorTaskStatus,
} from '../../shared/src/orchestrator.js';
import type { OrchestratorPlan, OrchestratorTaskStatus, WhiteboardEntry } from '../../shared/src/orchestrator.js';
import { buildRunPlan } from '../../shared/src/plan.js';
import type { RunPlan } from '../../shared/src/plan.js';
import type { ComposedSkill } from '../../shared/src/recording.js';
import { RUNTIME_MESSAGE_SCHEMA_VERSION } from '../../shared/src/runtime-messages.js';
import { PARCHI_STORAGE_KEYS } from '../../shared/src/settings.js';
import type { ToolDefinition } from '../../shared/src/tools.js';
import {
  DEFAULT_COMPACTION_SETTINGS,
  SUMMARIZATION_PROMPT,
  SUMMARIZATION_SYSTEM_PROMPT,
  UPDATE_SUMMARIZATION_PROMPT,
  applyCompaction,
  buildCompactionSummaryMessage,
  estimateContextTokens,
  findCutPoint,
  serializeConversation,
  shouldCompact,
} from '../ai/compaction.js';
import { classifyApiError } from '../ai/error-classifier.js';
import { normalizeConversationHistory } from '../ai/message-schema.js';
import type { Message, ToolCall } from '../ai/message-schema.js';
import { extractTextFromResponseMessages, extractThinking } from '../ai/message-utils.js';
import { toModelMessages } from '../ai/model-convert.js';
import { isValidFinalResponse } from '../ai/retry-engine.js';
import {
  buildToolSet,
  describeImageWithModel,
  normalizeOpenRouterModelId,
  resolveLanguageModel,
} from '../ai/sdk-client.js';
import { refreshRuntimeAuthSession } from '../convex/client.js';
import { RecordingCoordinator } from '../recording/recording-coordinator.js';
import { RelayBridge } from '../relay/relay-bridge.js';
import { BrowserTools } from '../tools/browser-tools.js';
import { getActiveTab } from '../utils/active-tab.js';
import {
  getRuntimeFeatureFlags,
  setupActionClickOpensPanel,
  setupKimiUserAgentHeaderSupport,
} from './browser-compat.js';

type RunMeta = {
  runId: string;
  turnId: string;
  sessionId: string;
};

type ReportImage = {
  id: string;
  dataUrl: string;
  capturedAt: number;
  toolCallId?: string;
  tabId?: number;
  url?: string;
  title?: string;
  visionDescription?: string;
};

type SubagentRunStatus = 'running' | 'completed' | 'failed' | 'cancelled';

type SubagentRunState = {
  id: string;
  name: string;
  status: SubagentRunStatus;
  tasks: string[];
  taskId?: string;
  profile?: string;
  tabId?: number;
  startedAt: number;
  finishedAt?: number;
  summary?: string;
  error?: string;
};

type SessionState = {
  sessionId: string;
  currentPlan: RunPlan | null;
  orchestratorPlan: OrchestratorPlan | null;
  subAgentCount: number;
  subAgentProfileCursor: number;
  subAgentRuns: Map<string, SubagentRunState>;
  tabLeases: Map<number, string>;
  whiteboard: Map<string, WhiteboardEntry>;
  lastBrowserAction: string | null;
  awaitingVerification: boolean;
  currentStepVerified: boolean;
  kimiWarningSent: boolean;
  failureTracker: Map<string, { count: number; lastError: string }>;
  reportImages: ReportImage[];
  selectedReportImageIds: Set<string>;
};

export class BackgroundService {
  browserTools: BrowserTools;
  currentSettings: Record<string, any> | null;
  currentSessionId: string | null;
  currentPlan: RunPlan | null;
  subAgentCount: number;
  subAgentProfileCursor: number;
  relay: RelayBridge;
  relayActiveRunIds: Set<string>;
  private applyRelayConfig: () => Promise<void>;
  private relayKeepalivePorts: Set<chrome.runtime.Port>;
  private sidepanelLifecyclePorts: Set<chrome.runtime.Port>;
  // State tracking for enforcement
  lastBrowserAction: string | null;
  awaitingVerification: boolean;
  currentStepVerified: boolean;
  kimiHeaderRuleOk: boolean;
  kimiHeaderMode: 'dnr' | 'webRequest' | 'none';
  kimiWarningSent: boolean;
  recordingCoordinator: RecordingCoordinator;

  // Run coordination: background messages are global, so we keep explicit run
  // state to support stopping/cancelling in-flight runs and preventing output
  // from "spilling" into new sessions.
  private activeRuns: Map<
    string,
    {
      runMeta: RunMeta;
      origin: 'sidepanel' | 'relay';
      controller: AbortController;
    }
  >;
  private activeRunIdBySessionId: Map<string, string>;
  private cancelledRunIds: Set<string>;
  private sessionStateById: Map<string, SessionState>;
  private browserToolsBySessionId: Map<string, BrowserTools>;
  private subagentPromisesById: Map<string, Promise<Record<string, any>>>;

  constructor() {
    this.browserTools = new BrowserTools();
    this.currentSettings = null;
    this.currentSessionId = null;
    this.currentPlan = null;
    this.subAgentCount = 0;
    this.subAgentProfileCursor = 0;
    this.relayActiveRunIds = new Set();
    this.relayKeepalivePorts = new Set();
    this.sidepanelLifecyclePorts = new Set();
    this.activeRuns = new Map();
    this.activeRunIdBySessionId = new Map();
    this.cancelledRunIds = new Set();
    this.sessionStateById = new Map();
    this.browserToolsBySessionId = new Map();
    this.subagentPromisesById = new Map();
    this.recordingCoordinator = new RecordingCoordinator();
    // State tracking for enforcement
    this.lastBrowserAction = null;
    this.awaitingVerification = false;
    this.currentStepVerified = false;
    this.kimiHeaderRuleOk = false;
    this.kimiHeaderMode = 'none';
    this.kimiWarningSent = false;

    this.relay = new RelayBridge({
      getHelloPayload: async () => {
        const manifest = chrome.runtime.getManifest();
        const stored = await chrome.storage.local.get(['relayAgentId']);
        let agentId = typeof stored.relayAgentId === 'string' ? stored.relayAgentId : '';
        if (!agentId) {
          agentId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          await chrome.storage.local.set({ relayAgentId: agentId });
        }
        return {
          agentId,
          name: 'parchi-extension',
          version: String(manifest.version || ''),
          browser: getRuntimeFeatureFlags().browser,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          capabilities: { tools: true, agentRun: true },
        };
      },
      onRequest: async (req) => this.handleRelayRpc(req.method, req.params),
      onStatus: (status) => {
        const payload: Record<string, any> = { relayConnected: !!status.connected };
        if (status.connected) payload.relayLastConnectedAt = Date.now();
        if (status.lastError !== undefined) payload.relayLastError = status.lastError;
        chrome.storage.local.set(payload).catch(() => {});
      },
    });

    this.applyRelayConfig = async () => {
      const stored = await chrome.storage.local.get(['relayEnabled', 'relayUrl', 'relayToken']);
      const enabled = stored.relayEnabled === true || stored.relayEnabled === 'true';
      const url = typeof stored.relayUrl === 'string' ? stored.relayUrl.trim() : '';
      const token = typeof stored.relayToken === 'string' ? stored.relayToken.trim() : '';
      if (enabled && (!url || !token)) {
        await chrome.storage.local
          .set({ relayConnected: false, relayLastError: 'Missing relay URL or token' })
          .catch(() => {});
      }
      if (enabled && url && token) {
        await this.ensureRelayKeepalive();
      } else {
        await this.closeRelayKeepalive();
      }
      this.relay.configure({ enabled, url, token });
    };

    this.init();
  }

  private async ensureRelayKeepalive() {
    const offscreen = (chrome as any).offscreen;
    if (!offscreen?.createDocument) return;
    try {
      const hasDoc = typeof offscreen.hasDocument === 'function' ? await offscreen.hasDocument() : false;
      if (hasDoc) return;
      await offscreen.createDocument({
        url: 'offscreen/offscreen.html',
        reasons: [offscreen.Reason?.DOM_PARSER || 'DOM_PARSER'],
        justification: 'Keep relay WebSocket alive for the extension relay agent in MV3.',
      });
    } catch (err) {
      console.warn('[relay] offscreen keepalive failed:', err);
    }
  }

  private async closeRelayKeepalive() {
    const offscreen = (chrome as any).offscreen;
    if (!offscreen?.closeDocument) return;
    try {
      const hasDoc = typeof offscreen.hasDocument === 'function' ? await offscreen.hasDocument() : false;
      if (!hasDoc) return;
      await offscreen.closeDocument();
    } catch (err) {
      // Ignore - offscreen may not exist or may already be closed.
    }
  }

  init() {
    // Register message listeners first so optional browser-specific setup
    // failures cannot break the core request/response path.
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      void this.handleMessage(message, sender, sendResponse);
      return true;
    });

    setupActionClickOpensPanel();

    // Kimi API requires a coding-agent User-Agent header.
    // Use a browser-capability based strategy:
    // - Chrome/Chromium: declarativeNetRequest dynamic rule
    // - Firefox: webRequest onBeforeSendHeaders listener
    void setupKimiUserAgentHeaderSupport()
      .then((result) => {
        this.kimiHeaderRuleOk = result.ok;
        this.kimiHeaderMode = result.mode;
        if (!result.ok) {
          console.warn('Failed to configure Kimi User-Agent header support:', result.reason || 'Unknown reason');
        }
      })
      .catch((error) => {
        this.kimiHeaderRuleOk = false;
        this.kimiHeaderMode = 'none';
        console.warn('Failed to configure Kimi User-Agent header support:', error);
      });

    // Ensure relay can come up after a browser restart without needing the UI opened first.
    chrome.runtime.onStartup?.addListener(() => {
      void this.applyRelayConfig();
    });
    chrome.runtime.onInstalled?.addListener(() => {
      void this.applyRelayConfig();
    });

    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === 'relay-keepalive') {
        this.relayKeepalivePorts.add(port);
        port.onDisconnect.addListener(() => {
          this.relayKeepalivePorts.delete(port);
        });
        // Optional: accept pings; no response required.
        port.onMessage.addListener(() => {});
        return;
      }

      if (port.name === 'sidepanel-lifecycle') {
        this.sidepanelLifecyclePorts.add(port);
        port.onMessage.addListener((message) => {
          if (!message || typeof message !== 'object') return;
          if (message.type !== 'stop_run') return;
          const sessionId = typeof (message as any).sessionId === 'string' ? (message as any).sessionId : '';
          const note =
            typeof (message as any).note === 'string' && (message as any).note.trim()
              ? String((message as any).note)
              : 'Stopped';
          const stopped = sessionId ? this.stopRunBySession(sessionId, note) : false;
          if (!stopped) {
            this.stopAllSidepanelRuns(note);
          }
        });
        port.onDisconnect.addListener(() => {
          this.sidepanelLifecyclePorts.delete(port);
          if (this.sidepanelLifecyclePorts.size === 0) {
            this.stopAllSidepanelRuns('Stopped (panel closed)');
          }
        });
      }
    });

    void this.initRelay();
  }

  async initRelay() {
    try {
      await this.applyRelayConfig();
    } catch (err) {
      console.warn('[relay] init failed:', err);
    }

    chrome.storage.onChanged.addListener((_changes, areaName) => {
      if (areaName !== 'local') return;
      void this.applyRelayConfig();
    });
  }

  async handleRelayRpc(method: string, params: unknown) {
    switch (method) {
      case 'tools.list':
        const settings = await chrome.storage.local.get([
          'activeConfig',
          'provider',
          'apiKey',
          'model',
          'customEndpoint',
          'extraHeaders',
          'systemPrompt',
          'configs',
          'useOrchestrator',
          'orchestratorProfile',
          'visionBridge',
          'visionProfile',
          'enableScreenshots',
          'sendScreenshotsAsImages',
          'screenshotQuality',
          'showThinking',
          'streamResponses',
          'temperature',
          'maxTokens',
          'timeout',
          'contextLimit',
          'toolPermissions',
          'allowedDomains',
        ]);
        const activeProfileName = (settings as any).activeConfig || 'default';
        const activeProfile = this.resolveProfile(settings as any, activeProfileName);
        const orchestratorEnabled = (settings as any).useOrchestrator === true;
        const teamProfiles = this.resolveTeamProfiles(settings as any);
        const visionToolsEnabled = this.isVisionModelProfile(activeProfile);
        return this.getToolsForSession(settings as any, orchestratorEnabled, teamProfiles, visionToolsEnabled);

      case 'tool.call': {
        const tool = typeof (params as any)?.tool === 'string' ? (params as any).tool : '';
        const sessionId =
          typeof (params as any)?.sessionId === 'string'
            ? String((params as any).sessionId)
            : this.currentSessionId || 'relay';
        const args = (params as any)?.args;
        if (!tool) throw new Error('tool.call: missing tool');
        const safeArgs = args && typeof args === 'object' && !Array.isArray(args) ? (args as Record<string, any>) : {};
        const settings = await chrome.storage.local.get(['toolPermissions', 'allowedDomains']);
        const perm = await this.checkToolPermission(tool, safeArgs, settings, sessionId);
        if (!perm.allowed) {
          throw new Error(perm.reason || 'Tool blocked by policy');
        }
        return await this.getBrowserTools(sessionId).executeTool(tool, safeArgs);
      }

      case 'session.setTabs': {
        const sessionId =
          typeof (params as any)?.sessionId === 'string'
            ? String((params as any).sessionId)
            : this.currentSessionId || 'relay';
        const ids = Array.isArray((params as any)?.tabIds) ? (params as any).tabIds : [];
        const tabIds = ids.map((n: any) => Number(n)).filter((n: any) => Number.isFinite(n) && n > 0);
        const tabs: chrome.tabs.Tab[] = [];
        for (const tabId of tabIds) {
          try {
            const tab = await chrome.tabs.get(tabId);
            if (tab) tabs.push(tab);
          } catch {}
        }
        await this.getBrowserTools(sessionId).configureSessionTabs(tabs, { title: 'Parchi', color: 'blue' });
        return { ok: true, tabIds: tabs.map((t) => t.id).filter((id): id is number => typeof id === 'number') };
      }

      case 'settings.get': {
        const keys = (params as any)?.keys;
        if (!Array.isArray(keys)) throw new Error('settings.get: keys must be an array');
        return await chrome.storage.local.get(keys);
      }

      case 'settings.set': {
        const data = (params as any)?.data;
        if (!data || typeof data !== 'object' || Array.isArray(data))
          throw new Error('settings.set: data must be an object');
        await chrome.storage.local.set(data);
        return { ok: true };
      }

      case 'agent.run': {
        const prompt = typeof (params as any)?.prompt === 'string' ? String((params as any).prompt) : '';
        if (!prompt.trim()) throw new Error('agent.run: missing prompt');
        const selectedTabIds = Array.isArray((params as any)?.selectedTabIds) ? (params as any).selectedTabIds : null;
        const sessionId =
          typeof (params as any)?.sessionId === 'string' ? (params as any).sessionId : `session-${Date.now()}`;
        const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        const selectedTabs: chrome.tabs.Tab[] = [];
        if (Array.isArray(selectedTabIds) && selectedTabIds.length) {
          for (const rawId of selectedTabIds) {
            const tabId = Number(rawId);
            if (!Number.isFinite(tabId) || tabId <= 0) continue;
            try {
              const tab = await chrome.tabs.get(tabId);
              if (tab) selectedTabs.push(tab);
            } catch {}
          }
        }
        if (selectedTabs.length === 0) {
          const activeTab = await getActiveTab();
          if (activeTab) selectedTabs.push(activeTab);
        }

        // Fire-and-forget; relay will receive runtime events and run.done.
        void this.processUserMessage(prompt, [], selectedTabs, sessionId, { runId, turnId, origin: 'relay' });

        return { runId, sessionId };
      }

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  async handleMessage(message, _sender, sendResponse) {
    try {
      switch (message.type) {
        case 'relay_reconfigure': {
          await this.applyRelayConfig();
          sendResponse({ success: true });
          break;
        }

        case 'user_message': {
          const sessionId = message.sessionId || `session-${Date.now()}`;
          const userMessage = typeof message.message === 'string' ? message.message : '';
          sendResponse({ success: true, accepted: true, sessionId });
          void this.processUserMessage(
            userMessage,
            message.conversationHistory,
            message.selectedTabs || [],
            sessionId,
            undefined,
            message.recordedContext,
          );
          break;
        }

        case 'stop_run': {
          const sessionId = typeof message.sessionId === 'string' ? message.sessionId : '';
          const note = typeof message.note === 'string' && message.note.trim() ? message.note.trim() : 'Stopped';
          const stopped = sessionId ? this.stopRunBySession(sessionId, note) : false;
          if (!stopped) {
            this.stopAllSidepanelRuns(note);
          }
          sendResponse({ success: true });
          break;
        }

        case 'execute_tool': {
          const sessionId =
            typeof message.sessionId === 'string' ? message.sessionId : this.currentSessionId || 'default';
          const result = await this.getBrowserTools(sessionId).executeTool(message.tool, message.args);
          sendResponse({ success: true, result });
          break;
        }

        case 'configure_session_tabs_test': {
          // Test-only handler to set up session tabs for e2e tests
          const tabs = message.tabs;
          if (!Array.isArray(tabs) || tabs.length === 0) {
            sendResponse({ success: false, error: 'No tabs provided' });
            return;
          }
          // Use void + then to ensure we respond
          const sessionId = typeof message.sessionId === 'string' ? message.sessionId : this.currentSessionId || 'test';
          this.getBrowserTools(sessionId)
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
          const result = await this.runApiSmokeTest(settings, prompt);
          sendResponse({ success: true, result });
          break;
        }

        case 'generate_workflow': {
          const result = await this.generateWorkflowPrompt(message.sessionContext || '', message.maxOutputTokens);
          sendResponse({ success: true, result });
          break;
        }

        case 'ping_test': {
          // Simple test to verify messaging works
          sendResponse({ success: true, pong: true, time: Date.now() });
          break;
        }

        case 'recording_start': {
          try {
            await this.recordingCoordinator.startRecording(message.tabId);
            sendResponse({ success: true });
          } catch (err: any) {
            this.sendToSidePanel({ type: 'recording_error', message: err.message || 'Recording failed' });
            sendResponse({ success: false, error: err.message || 'Recording failed' });
          }
          break;
        }

        case 'recording_stop': {
          await this.recordingCoordinator.stopRecording();
          sendResponse({ success: true });
          break;
        }

        case 'recording_select_images': {
          await this.recordingCoordinator.selectImages(message.selectedIds);
          sendResponse({ success: true });
          break;
        }

        case 'recording_discard': {
          this.recordingCoordinator.discard();
          sendResponse({ success: true });
          break;
        }

        case 'recording_event': {
          this.recordingCoordinator.handleContentEvent(message.event);
          sendResponse({ success: true });
          break;
        }

        default:
          console.warn('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendToSidePanel({
        type: 'error',
        message: error.message,
      });
      sendResponse({ success: false, error: error.message });
    }
  }

  async processUserMessage(
    userMessage: string,
    conversationHistory: Message[],
    selectedTabs: chrome.tabs.Tab[],
    sessionId: string,
    meta?: Partial<RunMeta> & { origin?: 'sidepanel' | 'relay' },
    recordedContext?: any,
  ) {
    const runMeta: RunMeta = {
      runId:
        typeof meta?.runId === 'string' && meta.runId
          ? meta.runId
          : `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      turnId:
        typeof meta?.turnId === 'string' && meta.turnId
          ? meta.turnId
          : `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId,
    };
    const origin = meta?.origin || 'sidepanel';
    if (origin === 'relay') this.relayActiveRunIds.add(runMeta.runId);
    const controller = this.registerActiveRun(runMeta, origin);
    const abortSignal = controller.signal;
    const sessionState = this.getSessionState(sessionId);
    const browserTools = this.getBrowserTools(sessionId);
    let latestErrorContext: {
      route?: string;
      provider?: string;
      proxyProvider?: string;
      model?: string;
      useProxy?: boolean;
    } = {};

    // Reset enforcement state at the start of every turn so stale verification
    // requirements from the previous turn don't pollute the system prompt.
    sessionState.lastBrowserAction = null;
    sessionState.awaitingVerification = false;
    sessionState.currentStepVerified = false;

    try {
      const settings = await chrome.storage.local.get(PARCHI_STORAGE_KEYS as unknown as string[]);

      if (settings.enableScreenshots === undefined) settings.enableScreenshots = true;
      if (settings.sendScreenshotsAsImages === undefined) settings.sendScreenshotsAsImages = false;
      if (settings.visionBridge === undefined) settings.visionBridge = true;
      if (!settings.toolPermissions) {
        settings.toolPermissions = {
          read: true,
          interact: true,
          navigate: true,
          tabs: true,
          screenshots: true,
        };
      }
      if (settings.allowedDomains === undefined) settings.allowedDomains = '';
      if (!Array.isArray(settings.auxAgentProfiles)) settings.auxAgentProfiles = [];

      this.currentSettings = settings;
      // Track the most recently active session for legacy callers that don't
      // supply a sessionId (e.g., some relay RPC usage).
      this.currentSessionId = sessionId;

      try {
        await browserTools.configureSessionTabs(selectedTabs || [], {
          title: 'Parchi',
          color: 'blue',
        });
        // Broadcast initial session tab state to sidepanel
        const tabState = browserTools.getSessionState();
        this.sendRuntime(runMeta, {
          type: 'session_tabs_update',
          tabs: tabState.tabs,
          activeTabId: tabState.activeTabId,
          maxTabs: tabState.maxTabs,
          groupTitle: tabState.groupTitle,
        });
      } catch (error) {
        console.warn('Failed to configure session tabs:', error);
      }

      const activeProfileName = settings.activeConfig || 'default';
      const orchestratorProfileName = settings.orchestratorProfile || activeProfileName;
      const visionProfileName = settings.visionProfile || null;
      const orchestratorEnabled = settings.useOrchestrator === true;
      const teamProfiles = this.resolveTeamProfiles(settings);

      const activeProfile = this.resolveProfile(settings, activeProfileName);
      let orchestratorProfile = orchestratorEnabled
        ? this.resolveProfile(settings, orchestratorProfileName)
        : activeProfile;
      let visionProfile =
        settings.visionBridge !== false ? this.resolveProfile(settings, visionProfileName || activeProfileName) : null;

      // Paid-mode runs may happen long after the account tab refreshed auth.
      // Rehydrate/refresh proxy auth in-place so chat runs don't rely on stale tokens.
      if (!this.hasOwnApiKey(orchestratorProfile)) {
        await this.refreshConvexProxyAuthSession(settings);
      }

      const runtimeProfileResolution = this.resolveRuntimeModelProfile(orchestratorProfile, settings);
      if (!runtimeProfileResolution.allowed) {
        this.sendRuntime(runMeta, {
          type: 'run_error',
          message: runtimeProfileResolution.errorMessage || 'Please configure your API key in settings',
        });
        return;
      }
      orchestratorProfile = runtimeProfileResolution.profile;
      latestErrorContext = {
        route: runtimeProfileResolution.route,
        provider: String(orchestratorProfile?.provider || ''),
        proxyProvider: String((orchestratorProfile as any)?.proxyProvider || ''),
        model: String(orchestratorProfile?.model || settings.model || ''),
        useProxy: Boolean((orchestratorProfile as any)?.useProxy),
      };
      if (visionProfile && !this.hasOwnApiKey(visionProfile) && runtimeProfileResolution.route === 'proxy') {
        visionProfile = this.applyConvexProxyProfile(visionProfile, settings);
      }

      const kimiInUse =
        activeProfile?.provider === 'kimi' ||
        orchestratorProfile?.provider === 'kimi' ||
        visionProfile?.provider === 'kimi';
      if (kimiInUse && !this.kimiHeaderRuleOk && !sessionState.kimiWarningSent) {
        sessionState.kimiWarningSent = true;
        this.sendRuntime(runMeta, {
          type: 'run_warning',
          message:
            'Kimi requires User-Agent "coding-agent". This browser runtime could not configure a compatible header rewrite path (DNR/webRequest), so requests may fail. Use a build with header rewrite support or route through a proxy that sets this header.',
        });
      }

      const visionToolsEnabled = this.isVisionModelProfile(orchestratorProfile);
      const tools = this.getToolsForSession(settings, orchestratorEnabled, teamProfiles, visionToolsEnabled);
      const streamEnabled = settings.streamResponses !== false && settings.streamResponses !== 'false';
      const showThinking = settings.showThinking !== false && settings.showThinking !== 'false';
      const enableAnthropicThinking =
        showThinking &&
        (orchestratorProfile.provider === 'anthropic' ||
          orchestratorProfile.provider === 'kimi' ||
          ((orchestratorProfile.provider === 'openrouter' || orchestratorProfile.provider === 'parchi') &&
            /claude/i.test(orchestratorProfile.model || '')));

      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const sessionTabs = browserTools.getSessionTabSummaries();
      const sessionTabContext = sessionTabs
        .filter((tab) => typeof tab.id === 'number')
        .map((tab) => ({
          id: tab.id as number,
          title: tab.title,
          url: tab.url,
        }));
      const workingTabId: number | null = browserTools.getCurrentSessionTabId() ?? activeTab?.id ?? null;
      const workingTab = sessionTabs.find((tab) => tab.id === workingTabId);
      const context = {
        currentUrl: workingTab?.url || activeTab?.url || 'unknown',
        currentTitle: workingTab?.title || activeTab?.title || 'unknown',
        tabId: workingTabId,
        availableTabs: sessionTabContext,
        orchestratorEnabled,
        teamProfiles,
        provider: orchestratorProfile.provider || '',
        model: orchestratorProfile.model || settings.model || '',
        toolCatalog: tools.map((tool) => ({ name: tool.name, description: tool.description || '' })),
        showThinking,
      };

      const matchedSkills = await this.getMatchedSkills(context.currentUrl);

      const historyInput = Array.isArray(conversationHistory) ? conversationHistory : [];
      const trimmedUserMessage = typeof userMessage === 'string' ? userMessage.trim() : '';

      // Enrich with recorded context if present
      let enrichedUserMessage = userMessage;
      let recordedImages: Array<{ dataUrl: string }> = [];
      if (recordedContext && typeof recordedContext === 'object' && recordedContext.summary) {
        enrichedUserMessage = `${userMessage}\n\n${recordedContext.summary}`;
        if (Array.isArray(recordedContext.selectedImages)) {
          recordedImages = recordedContext.selectedImages;
        }
      }

      const lastMessage = historyInput[historyInput.length - 1];
      const lastContentText = typeof lastMessage?.content === 'string' ? lastMessage.content : '';
      const shouldReplaceLastUserMessage =
        !!trimmedUserMessage &&
        !!lastMessage &&
        lastMessage.role === 'user' &&
        lastContentText === userMessage &&
        lastContentText !== enrichedUserMessage;
      const shouldAppendUserMessage =
        !!trimmedUserMessage &&
        (!lastMessage ||
          lastMessage.role !== 'user' ||
          (lastContentText !== enrichedUserMessage && !shouldReplaceLastUserMessage));
      const historyWithUserMessage = shouldReplaceLastUserMessage
        ? [...historyInput.slice(0, -1), { role: 'user' as const, content: enrichedUserMessage }]
        : shouldAppendUserMessage
          ? [...historyInput, { role: 'user' as const, content: enrichedUserMessage }]
          : historyInput;
      const normalizedHistory = normalizeConversationHistory(historyWithUserMessage);
      let activeModelId = String(orchestratorProfile.model || settings.model || '').trim();
      let model = resolveLanguageModel(orchestratorProfile);
      const modelRetryOrder = [activeModelId];
      const openRouterLikeProvider =
        String(orchestratorProfile.provider || '').toLowerCase() === 'openrouter' ||
        String(orchestratorProfile.provider || '').toLowerCase() === 'parchi';
      if (openRouterLikeProvider) {
        if (!modelRetryOrder.includes('openrouter/auto')) modelRetryOrder.push('openrouter/auto');
        if (!modelRetryOrder.includes('openai/gpt-4o-mini')) modelRetryOrder.push('openai/gpt-4o-mini');
      }

      const switchActiveModel = (nextModelId: string) => {
        const trimmed = String(nextModelId || '').trim();
        if (!trimmed) return false;
        if (trimmed === activeModelId) return true;
        orchestratorProfile = {
          ...orchestratorProfile,
          model: trimmed,
        };
        activeModelId = trimmed;
        model = resolveLanguageModel(orchestratorProfile);
        return true;
      };

      const getErrorClassificationContext = () => ({
        route: runtimeProfileResolution.route,
        provider: String(orchestratorProfile?.provider || ''),
        proxyProvider: String((orchestratorProfile as any)?.proxyProvider || ''),
        model: activeModelId,
        useProxy: Boolean((orchestratorProfile as any)?.useProxy),
      });
      const captureErrorClassificationContext = () => {
        latestErrorContext = getErrorClassificationContext();
        return latestErrorContext;
      };

      const persistRecoveredModelSelection = async (nextModelId: string) => {
        if (!openRouterLikeProvider) return;
        const trimmed = String(nextModelId || '').trim();
        if (!trimmed) return;
        try {
          const stored = await chrome.storage.local.get(['activeConfig', 'configs', 'model']);
          const activeConfig = String(stored.activeConfig || settings.activeConfig || 'default');
          const configs =
            stored.configs && typeof stored.configs === 'object' && !Array.isArray(stored.configs)
              ? { ...stored.configs }
              : {};
          const activeProfile =
            configs[activeConfig] && typeof configs[activeConfig] === 'object' && !Array.isArray(configs[activeConfig])
              ? { ...configs[activeConfig] }
              : {};
          activeProfile.model = trimmed;
          configs[activeConfig] = activeProfile;
          await chrome.storage.local.set({
            model: trimmed,
            configs,
          });
        } catch {
          // Ignore persistence failures; fallback still applies for this run.
        }
      };

      const toolSet = buildToolSet(tools, async (toolName, args, options) =>
        this.executeToolByName(
          toolName,
          args,
          {
            runMeta,
            settings,
            visionProfile,
            actor: 'assistant',
          },
          options.toolCallId,
        ),
      );

      const extractThinkingFromResponseMessages = (messages: unknown): string | null => {
        if (!Array.isArray(messages)) return null;
        const thinkRegex = /<\s*(think|analysis|thinking)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi;
        const collected: string[] = [];

        const collectFromText = (text: string) => {
          let match;
          while ((match = thinkRegex.exec(text)) !== null) {
            if (match[2]) collected.push(match[2].trim());
          }
          thinkRegex.lastIndex = 0;
        };

        const collectFromContent = (content: unknown) => {
          if (!content) return;
          if (typeof content === 'string') {
            collectFromText(content);
            return;
          }
          if (Array.isArray(content)) {
            content.forEach((part) => collectFromContent(part));
            return;
          }
          if (content && typeof content === 'object') {
            const type = typeof (content as any).type === 'string' ? String((content as any).type) : '';
            if (type && (type.includes('thinking') || type.includes('reasoning') || type.includes('analysis'))) {
              const raw = (content as any).text ?? (content as any).content ?? (content as any).value;
              if (typeof raw === 'string' && raw.trim()) collected.push(raw.trim());
              return;
            }
            if (typeof (content as any).text === 'string') {
              collectFromText((content as any).text);
              return;
            }
            if (typeof (content as any).content === 'string') {
              collectFromText((content as any).content);
            }
          }
        };

        messages.forEach((msg) => collectFromContent((msg as any)?.content));
        const merged = collected.filter(Boolean).join('\n\n').trim();
        return merged || null;
      };

      const maxRecoveryAttempts = 2;
      let recoveryAttempt = 0;
      let currentHistory = normalizedHistory;
      let finalText = '';
      let reasoningText: string | null = null;
      let totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      let toolResults: Array<Record<string, any>> = [];
      let responseMessages: Message[] = [];

      const runModelPass = async (messages: Message[]) => {
        const modelMessages = toModelMessages(messages);

        // Inject recorded context images into the last user message if the model supports vision
        if (recordedImages.length > 0 && this.isVisionModelProfile(orchestratorProfile)) {
          for (let i = modelMessages.length - 1; i >= 0; i--) {
            const msg = modelMessages[i];
            if (msg.role === 'user') {
              const existingContent = typeof msg.content === 'string' ? msg.content : '';
              const parts: any[] = [];
              if (existingContent) {
                parts.push({ type: 'text', text: existingContent });
              }
              for (const img of recordedImages) {
                if (img.dataUrl && typeof img.dataUrl === 'string') {
                  parts.push({ type: 'image', image: img.dataUrl });
                }
              }
              if (parts.length > 0) {
                (msg as any).content = parts;
              }
              break;
            }
          }
        }

        let streamStopSent = false;
        let textDeltaCount = 0;
        let reasoningDeltaCount = 0;
        let textStreamError: string | null = null;

        const isNoOutputError = (error: unknown) => {
          const message = (error as any)?.message || String(error ?? '');
          return typeof message === 'string' && message.includes('No output generated');
        };

        const safeAwait = async <T>(promise: PromiseLike<T>, fallback: T): Promise<T> => {
          try {
            return await Promise.resolve(promise);
          } catch (error) {
            // Always return fallback to prevent crashes - log other errors but don't throw
            if (!isNoOutputError(error)) {
              console.warn('[safeAwait] Error (using fallback):', error);
            }
            return fallback;
          }
        };

        const sendStreamStop = () => {
          if (!streamEnabled || streamStopSent) return;
          this.sendRuntime(runMeta, { type: 'assistant_stream_stop' });
          streamStopSent = true;
        };

        const sendTextDelta = (textPart: string) => {
          if (!textPart) return;
          textDeltaCount += 1;
          this.sendRuntime(runMeta, {
            type: 'assistant_stream_delta',
            content: textPart,
            channel: 'text',
          });
        };

        const sendReasoningDelta = (delta: string) => {
          if (!delta) return;
          reasoningDeltaCount += 1;
          this.sendRuntime(runMeta, {
            type: 'assistant_stream_delta',
            content: delta,
            channel: 'reasoning',
          });
        };

        const emitSyntheticStream = async (fullText: string) => {
          const text = String(fullText || '');
          if (!text) return;
          const maxChunks = 120;
          const chunkSize = Math.max(24, Math.ceil(text.length / maxChunks));
          for (let i = 0; i < text.length; i += chunkSize) {
            if (abortSignal.aborted) return;
            sendTextDelta(text.slice(i, i + chunkSize));
            await new Promise((resolve) => setTimeout(resolve, 8));
          }
        };

        if (streamEnabled) {
          this.sendRuntime(runMeta, { type: 'assistant_stream_start' });
        }

        const result = streamText({
          model,
          system: this.enhanceSystemPrompt(
            orchestratorProfile.systemPrompt || '',
            context,
            sessionState,
            matchedSkills,
          ),
          messages: modelMessages,
          tools: toolSet,
          abortSignal,
          temperature: orchestratorProfile.temperature ?? 0.7,
          maxOutputTokens: orchestratorProfile.maxTokens ?? 4096,
          stopWhen: stepCountIs(48),
          providerOptions: enableAnthropicThinking
            ? {
                anthropic: {
                  thinking: {
                    type: 'enabled',
                    budgetTokens: Math.min(
                      Math.max(1024, Math.floor((orchestratorProfile.maxTokens ?? 4096) * 0.5)),
                      16384,
                    ),
                  },
                },
              }
            : undefined,
          onChunk: ({ chunk }) => {
            const chunkType = typeof (chunk as any).type === 'string' ? String((chunk as any).type) : '';
            if (chunkType.includes('reasoning') || chunkType.includes('thinking')) {
              sendReasoningDelta((chunk as any).text || (chunk as any).delta || '');
            }
          },
        });

        const resolveText = async () => {
          try {
            return await result.text;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error ?? '');
            if (message.includes('No output generated')) {
              return '';
            }
            throw error;
          }
        };

        try {
          if (streamEnabled) {
            try {
              for await (const textPart of result.textStream) {
                sendTextDelta(textPart || '');
              }
            } catch (error) {
              textStreamError = (error as any)?.message || String(error ?? '');
              console.warn('Streaming text error:', error);
            }
          }

          const text = await resolveText();
          const [reasoning, usage, steps, responseMessages] = await Promise.all([
            safeAwait(result.reasoningText, null),
            safeAwait(result.totalUsage as any, { inputTokens: 0, outputTokens: 0, totalTokens: 0 } as any),
            safeAwait(result.steps as any, [] as any),
            safeAwait((result as any).responseMessages as Promise<any>, [] as any),
          ]);
          const resolvedText = text || extractTextFromResponseMessages(responseMessages);

          const resolvedReasoning = showThinking
            ? reasoning || extractThinkingFromResponseMessages(responseMessages)
            : reasoning || null;

          if (streamEnabled && showThinking && resolvedReasoning && reasoningDeltaCount === 0) {
            sendReasoningDelta(resolvedReasoning);
          }

          if (streamEnabled && resolvedText && textDeltaCount === 0) {
            await emitSyntheticStream(resolvedText);
          }

          if (!resolvedText && textStreamError) {
            const streamClassified = classifyApiError(new Error(textStreamError), captureErrorClassificationContext());
            const detail = streamClassified.action ? ` ${streamClassified.action}` : '';
            this.sendRuntime(runMeta, {
              type: 'run_warning',
              message: `Model produced no output. ${streamClassified.message}${detail}`,
            });
          }

          sendStreamStop();

          const normalizedUsage = {
            inputTokens: Number(usage?.inputTokens || 0),
            outputTokens: Number(usage?.outputTokens || 0),
            totalTokens: Number(usage?.totalTokens || 0),
          };

          return {
            text: resolvedText || '',
            reasoningText: resolvedReasoning || null,
            totalUsage: normalizedUsage,
            toolResults: steps.flatMap((step) => step.toolResults || []),
          };
        } catch (error) {
          sendStreamStop();
          if (abortSignal.aborted) {
            throw error;
          }
          const classified = classifyApiError(error, captureErrorClassificationContext());
          const statusCode = Number((error as any)?.statusCode ?? (error as any)?.status ?? 0);
          if (classified.category === 'model' || APICallError.isInstance(error) || statusCode >= 400) {
            throw error;
          }
          console.error('[runModelPass] Error:', error);
          // Return empty result instead of throwing to prevent crash
          return {
            text: '',
            reasoningText: null,
            totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            toolResults: [],
          };
        }
      };

      const runModelPassWithFallback = async (messages: Message[]) => {
        let lastModelError: unknown = null;
        let refreshedProxyAuthOnce = false;
        for (let idx = 0; idx < modelRetryOrder.length; idx += 1) {
          const candidateModelId = modelRetryOrder[idx];
          if (!switchActiveModel(candidateModelId)) {
            continue;
          }
          if (idx > 0) {
            this.sendRuntime(runMeta, {
              type: 'run_warning',
              message: `Model "${modelRetryOrder[0]}" unavailable. Retrying with "${candidateModelId}".`,
            });
          }
          try {
            const pass = await runModelPass(messages);
            if (idx > 0) {
              await persistRecoveredModelSelection(candidateModelId);
            }
            return pass;
          } catch (error) {
            const classified = classifyApiError(error, captureErrorClassificationContext());
            const statusCode = Number((error as any)?.statusCode ?? (error as any)?.status ?? 0);
            const isProxyAuthFailure =
              runtimeProfileResolution.route === 'proxy' &&
              (classified.category === 'auth' || statusCode === 401 || statusCode === 403);
            if (isProxyAuthFailure && !refreshedProxyAuthOnce) {
              const refreshed = await this.refreshConvexProxyAuthSession(settings, { force: true });
              if (refreshed) {
                refreshedProxyAuthOnce = true;
                if ((orchestratorProfile as any)?.useProxy) {
                  (orchestratorProfile as any).proxyAuthToken = String(settings.convexAccessToken || '').trim();
                }
                if ((visionProfile as any)?.useProxy) {
                  (visionProfile as any).proxyAuthToken = String(settings.convexAccessToken || '').trim();
                }
                this.sendRuntime(runMeta, {
                  type: 'run_warning',
                  message: 'Refreshing paid runtime session and retrying request.',
                });
                idx -= 1;
                continue;
              }
            }
            if (classified.category !== 'model') {
              throw error;
            }
            lastModelError = error;
          }
        }
        throw lastModelError || new Error('Model unavailable after fallback attempts.');
      };

      while (true) {
        if (abortSignal.aborted) return;
        const passResult = await runModelPassWithFallback(currentHistory);
        const xmlToolCalls = this.extractXmlToolCalls(passResult.text);
        toolResults = passResult.toolResults || [];

        if (xmlToolCalls.length > 0 && toolResults.length === 0 && recoveryAttempt < maxRecoveryAttempts) {
          this.sendRuntime(runMeta, {
            type: 'run_warning',
            message: 'Detected XML tool call output. Executing tools and retrying.',
          });

          const cleanedText = this.stripXmlToolCalls(passResult.text);
          const parsedXmlAssistant = extractThinking(cleanedText, passResult.reasoningText || null);
          const toolMessages: Message[] = [];
          const xmlToolCallEntries: ToolCall[] = [];
          for (const call of xmlToolCalls) {
            if (abortSignal.aborted) return;
            const toolCallId = `xml_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            xmlToolCallEntries.push({ id: toolCallId, name: call.name, args: call.args });
            const output = await this.executeToolByName(
              call.name,
              call.args,
              {
                runMeta,
                settings,
                visionProfile,
                actor: 'assistant',
              },
              toolCallId,
            );
            toolMessages.push({
              role: 'tool',
              toolCallId,
              toolName: call.name,
              content: [
                {
                  type: 'tool-result',
                  toolCallId,
                  toolName: call.name,
                  output:
                    output && typeof output === 'object'
                      ? { type: 'json', value: output }
                      : { type: 'text', value: String(output ?? '') },
                },
              ],
            });
          }
          const xmlAssistantMsg: Message = {
            role: 'assistant',
            content: parsedXmlAssistant.content || '',
            thinking: parsedXmlAssistant.thinking || null,
            toolCalls: xmlToolCallEntries,
          };
          currentHistory = normalizeConversationHistory([...currentHistory, xmlAssistantMsg]);

          currentHistory = normalizeConversationHistory([
            ...currentHistory,
            ...toolMessages,
            {
              role: 'system',
              content:
                'Previous response included XML tool call markup. Tools were executed. Continue without XML tool tags.',
            },
          ]);

          recoveryAttempt += 1;
          continue;
        }

        const cleanedText = this.stripXmlToolCalls(passResult.text);
        const parsedFinal = extractThinking(cleanedText, passResult.reasoningText || null);
        reasoningText = parsedFinal.thinking || passResult.reasoningText || null;
        totalUsage = passResult.totalUsage || totalUsage;
        const isValid = isValidFinalResponse(parsedFinal.content, { allowEmpty: false });
        finalText = isValid ? parsedFinal.content.trim() : '';

        if (!finalText) {
          const maxFinalizeAttempts = 2;

          const toolDigest = (() => {
            if (!toolResults.length) return '';
            const items = toolResults.slice(-10).map((r) => ({
              tool: r.toolName || 'tool',
              args: r.input || r.args || {},
              output: r.output ?? null,
            }));
            let raw = JSON.stringify(items);
            const limit = 12_000;
            if (raw.length > limit) raw = `${raw.slice(0, limit)}...`;
            return raw;
          })();

          for (let attempt = 1; attempt <= maxFinalizeAttempts; attempt += 1) {
            this.sendRuntime(runMeta, {
              type: 'run_warning',
              message: `Model did not produce a valid final response. Retrying finalization (${attempt}/${maxFinalizeAttempts}).`,
            });

            const finalizePromptParts = [
              'Your previous response did not include a valid final answer.',
              'Write the final answer now.',
              'Do NOT call tools.',
              'Do NOT mention retrying, failures, or internal errors unless the user explicitly asked.',
            ];
            if (toolDigest) {
              finalizePromptParts.push('Use the tool results below as ground truth.');
              finalizePromptParts.push(`TOOL_RESULTS_JSON=${toolDigest}`);
            }

            const finalizeResult = await generateText({
              model,
              system: this.enhanceSystemPrompt(
                orchestratorProfile.systemPrompt || '',
                context,
                sessionState,
                matchedSkills,
              ),
              messages: [
                ...toModelMessages(currentHistory),
                {
                  role: 'user',
                  content: finalizePromptParts.join('\n'),
                },
              ],
              abortSignal,
              temperature: 0.2,
              maxOutputTokens: Math.min(2048, orchestratorProfile.maxTokens ?? 4096),
            });

            const candidateRaw = String(finalizeResult.text || '');
            const parsedFinalize = extractThinking(candidateRaw, reasoningText || null);
            if (parsedFinalize.thinking) {
              reasoningText = parsedFinalize.thinking;
            }
            const candidate = parsedFinalize.content.trim();
            if (isValidFinalResponse(candidate, { allowEmpty: false })) {
              finalText = candidate;
              totalUsage = {
                inputTokens: (totalUsage.inputTokens || 0) + Number((finalizeResult as any)?.usage?.inputTokens || 0),
                outputTokens:
                  (totalUsage.outputTokens || 0) + Number((finalizeResult as any)?.usage?.outputTokens || 0),
                totalTokens: (totalUsage.totalTokens || 0) + Number((finalizeResult as any)?.usage?.totalTokens || 0),
              };
              break;
            }
          }

          if (!finalText) {
            this.sendRuntime(runMeta, {
              type: 'run_error',
              message: 'Model failed to produce a valid final response after retries.',
              errorCategory: 'finalize',
              action: 'Try a different model, increase maxTokens, or disable streaming if enabled.',
              recoverable: true,
            });
            return;
          }
        }

        const assistantMsg: Message = {
          role: 'assistant',
          content: finalText,
          thinking: reasoningText || null,
        };
        if (toolResults.length > 0) {
          assistantMsg.toolCalls = toolResults.map((r) => ({
            id: r.toolCallId || `tc_${Date.now()}`,
            name: r.toolName || 'tool',
            args: r.input || r.args || {},
          }));
        }
        responseMessages = [assistantMsg];
        if (toolResults.length > 0) {
          responseMessages.push({
            role: 'tool',
            content: toolResults.map((resultItem) => ({
              type: 'tool-result',
              toolCallId: resultItem.toolCallId,
              toolName: resultItem.toolName,
              output:
                resultItem.output && typeof resultItem.output === 'object'
                  ? { type: 'json', value: resultItem.output }
                  : { type: 'text', value: String(resultItem.output ?? '') },
            })),
          });
        }

        break;
      }

      this.sendRuntime(runMeta, {
        type: 'assistant_final',
        content: finalText,
        thinking: reasoningText || null,
        model: orchestratorProfile.model || settings.model || '',
        usage: {
          inputTokens: totalUsage.inputTokens || 0,
          outputTokens: totalUsage.outputTokens || 0,
          totalTokens: totalUsage.totalTokens || 0,
        },
        responseMessages,
      });

      const nextHistory = normalizeConversationHistory([...currentHistory, ...responseMessages]);
      const contextLimit = orchestratorProfile.contextLimit || settings.contextLimit || 200000;
      const compactionSettings = DEFAULT_COMPACTION_SETTINGS;
      const contextUsage = estimateContextTokens(nextHistory);
      const compactionCheck = shouldCompact({
        contextTokens: contextUsage.tokens,
        contextLimit,
        settings: compactionSettings,
      });

      if (compactionCheck.shouldCompact) {
        const currentPercent = Math.max(0, Math.min(100, Math.round(compactionCheck.percent * 100)));
        this.sendRuntime(runMeta, {
          type: 'run_status',
          phase: 'finalizing',
          attempts: { api: 0, tool: 0, finalize: 0 },
          maxRetries: { api: 0, tool: 0, finalize: 0 },
          note: `Context near limit (${currentPercent}%, ${compactionCheck.approxTokens}/${contextLimit} tokens). Compaction started.`,
        });

        let summaryIndex = -1;
        for (let i = nextHistory.length - 1; i >= 0; i -= 1) {
          const msg = nextHistory[i];
          if (msg.role === 'system' && msg.meta?.kind === 'summary') {
            summaryIndex = i;
            break;
          }
        }

        const previousSummary =
          summaryIndex >= 0
            ? typeof nextHistory[summaryIndex].content === 'string'
              ? nextHistory[summaryIndex].content
              : JSON.stringify(nextHistory[summaryIndex].content)
            : undefined;

        const compactionStart = summaryIndex >= 0 ? summaryIndex + 1 : 0;
        const cutIndex = findCutPoint(nextHistory, compactionStart, compactionSettings.keepRecentTokens);
        const messagesToSummarize = nextHistory.slice(compactionStart, cutIndex);
        const preserved = nextHistory.slice(cutIndex);

        if (messagesToSummarize.length > 0) {
          const conversationText = serializeConversation(messagesToSummarize);
          let promptText = `<conversation>\n${conversationText}\n</conversation>\n\n`;
          if (previousSummary) {
            promptText += `<previous-summary>\n${previousSummary}\n</previous-summary>\n\n`;
          }
          promptText += previousSummary ? UPDATE_SUMMARIZATION_PROMPT : SUMMARIZATION_PROMPT;

          const summaryResult = await generateText({
            model,
            system: SUMMARIZATION_SYSTEM_PROMPT,
            messages: [
              {
                role: 'user',
                content: promptText,
              },
            ],
            abortSignal,
            temperature: 0.2,
            maxOutputTokens: Math.floor(0.8 * compactionSettings.reserveTokens),
          });

          const parsedSummary = extractThinking(summaryResult.text || '', null);
          const summaryText = parsedSummary.content || String(summaryResult.text || '').trim();
          const compactedInfo = `Compaction result: summarized ${messagesToSummarize.length} messages, kept ${preserved.length} recent messages.`;
          const compactedSummary = `${compactedInfo}\n\n${summaryText}`;

          const summaryMessage = buildCompactionSummaryMessage(compactedSummary, messagesToSummarize.length);
          const compaction = applyCompaction({
            summaryMessage,
            preserved,
            trimmedCount: messagesToSummarize.length,
          });
          const newSessionId = `session-${Date.now()}`;

          this.sendRuntime(runMeta, {
            type: 'context_compacted',
            summary: compactedSummary,
            trimmedCount: messagesToSummarize.length,
            preservedCount: compaction.preservedCount,
            newSessionId,
            contextMessages: compaction.compacted,
            contextUsage: {
              approxTokens: compactionCheck.approxTokens,
              contextLimit,
              percent: Math.round(compactionCheck.percent * 100),
            },
          });

          this.sendRuntime(runMeta, {
            type: 'run_status',
            phase: 'finalizing',
            attempts: { api: 0, tool: 0, finalize: 0 },
            maxRetries: { api: 0, tool: 0, finalize: 0 },
            note: `Context compacted. ${compactedInfo}`,
          });
        }
      }
    } catch (error) {
      if (abortSignal.aborted || this.isRunCancelled(runMeta.runId)) {
        return;
      }
      console.error('Error processing user message:', error);
      const classified = classifyApiError(error, {
        ...latestErrorContext,
      });
      let message = classified.message;
      if (classified.category === 'unknown' && APICallError.isInstance(error)) {
        const status = error.statusCode ? ` Status ${error.statusCode}.` : '';
        const body = error.responseBody ? ` Response: ${error.responseBody.slice(0, 500)}` : '';
        message = `${error.message || 'Unknown error'}${status}${body}`;
      }
      this.sendRuntime(runMeta, {
        type: 'run_error',
        message,
        errorCategory: classified.category,
        action: classified.action,
        recoverable: classified.recoverable,
      });
    } finally {
      this.cleanupRun(runMeta, origin);
      if (origin === 'relay') this.relayActiveRunIds.delete(runMeta.runId);
    }
  }

  async runApiSmokeTest(
    settings: {
      provider?: string;
      apiKey?: string;
      model?: string;
      customEndpoint?: string;
      extraHeaders?: any;
      convexUrl?: string;
      convexAccessToken?: string;
      convexSubscriptionStatus?: string;
      convexSubscriptionPlan?: string;
      accountModeChoice?: string;
    },
    prompt: string,
  ) {
    try {
      const runtimeSettings = settings as Record<string, any>;
      if (!this.hasOwnApiKey({ apiKey: settings.apiKey || '' })) {
        await this.refreshConvexProxyAuthSession(runtimeSettings);
      }

      const runtimeProfile = this.resolveRuntimeModelProfile(
        {
          provider: settings.provider || 'openai',
          apiKey: settings.apiKey || '',
          model: settings.model || '',
          customEndpoint: settings.customEndpoint,
          extraHeaders: settings.extraHeaders,
        },
        runtimeSettings,
      );
      if (!runtimeProfile.allowed) {
        return {
          rawText: '',
          fallbackText: '',
          resolvedText: '',
          error: runtimeProfile.errorMessage || 'No API key configured',
          usage: {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
          },
        };
      }

      const model = resolveLanguageModel(runtimeProfile.profile as any);

      const result = streamText({
        model,
        messages: [{ role: 'user', content: prompt }],
        maxOutputTokens: 64,
        temperature: 0,
      });

      const [text, responseMessages, usage] = await Promise.all([
        result.text,
        (result as any).responseMessages,
        result.totalUsage,
      ]);

      const fallbackText = extractTextFromResponseMessages(responseMessages);
      const resolvedText = (text || fallbackText || '').trim();

      return {
        rawText: text || '',
        fallbackText,
        resolvedText,
        usage: {
          inputTokens: Number(usage?.inputTokens || 0),
          outputTokens: Number(usage?.outputTokens || 0),
          totalTokens: Number(usage?.totalTokens || 0),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error ?? 'Unknown error');
      console.error('[runApiSmokeTest] Error:', error);
      return {
        rawText: '',
        fallbackText: '',
        resolvedText: '',
        error: errorMessage,
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
      };
    }
  }

  async generateWorkflowPrompt(
    sessionContext: string,
    maxOutputTokens?: number,
  ): Promise<{ prompt: string; error?: string }> {
    try {
      const settings =
        this.currentSettings || (await chrome.storage.local.get(PARCHI_STORAGE_KEYS as unknown as string[]));
      const runtimeProfile = this.resolveRuntimeModelProfile(
        {
          provider: settings.provider,
          apiKey: settings.apiKey,
          model: settings.model,
          customEndpoint: settings.customEndpoint,
          extraHeaders: settings.extraHeaders,
        },
        settings,
      );
      if (!runtimeProfile.allowed) {
        return { prompt: '', error: runtimeProfile.errorMessage || 'No API key configured' };
      }
      const model = resolveLanguageModel(runtimeProfile.profile as any);

      const outputLimit = Math.min(maxOutputTokens || 4096, 4096);

      const result = await generateText({
        model,
        system: `You are a workflow prompt engineer. Your job is to distill a chat session transcript into a single, reusable workflow prompt.

Rules:
- Output ONLY the workflow prompt itself — no preamble, no "Here is your workflow:", no markdown fences wrapping the entire output.
- The prompt must be self-contained and reproducible: when a user pastes it into a new chat session, an AI assistant should be able to replicate the same behavior and steps.
- Break the process down into clear numbered steps.
- Preserve important details: specific URLs, selectors, field names, values, edge cases, and error-handling the assistant performed.
- Omit irrelevant chatter, greetings, and status updates.
- If the session involved browser automation, include the exact actions (navigate, click, type, scroll) with their targets.
- Keep the prompt concise but thorough — aim for under 1500 words.
- Use imperative mood ("Navigate to…", "Click…", "Wait for…").`,
        messages: [
          {
            role: 'user',
            content: `Here is the full chat session transcript. Please create a workflow prompt out of it that captures the complete process step by step, so it can be reused to reproduce this exact behavior in a new session.\n\n---\n\n${sessionContext}`,
          },
        ],
        maxOutputTokens: outputLimit,
        temperature: 0.3,
      });

      const text = typeof result.text === 'string' ? result.text.trim() : '';
      return { prompt: text };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error ?? 'Unknown error');
      console.error('[generateWorkflowPrompt] Error:', error);
      return { prompt: '', error: msg };
    }
  }

  async executeToolByName(
    toolName: string,
    args: Record<string, any>,
    options: {
      runMeta: RunMeta;
      settings: Record<string, any>;
      visionProfile?: Record<string, any> | null;
      actor?: 'assistant' | 'subagent';
    },
    toolCallId?: string,
  ) {
    const callId = toolCallId || `tool_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    if (this.isRunCancelled(options.runMeta.runId)) {
      return { success: false, error: 'Run stopped.' };
    }
    const sessionId = options.runMeta.sessionId;
    const sessionState = this.getSessionState(sessionId);
    const browserTools = this.getBrowserTools(sessionId);
    const computeCurrentStepMeta = () => {
      const steps = sessionState.currentPlan?.steps || [];
      const currentIndex = steps.findIndex((step) => step.status !== 'done');
      if (currentIndex < 0) return {};
      const step = steps[currentIndex];
      return {
        stepIndex: currentIndex,
        stepTitle: step?.title || undefined,
      };
    };

    const sendStart = () =>
      this.sendRuntime(options.runMeta, {
        type: 'tool_execution_start',
        tool: toolName,
        id: callId,
        args,
        ...computeCurrentStepMeta(),
      });
    const sendResult = (result: unknown) =>
      this.sendRuntime(options.runMeta, {
        type: 'tool_execution_result',
        tool: toolName,
        id: callId,
        args,
        result,
        ...computeCurrentStepMeta(),
      });

    sendStart();

    if (toolName === 'set_plan') {
      const hadPlan = Boolean(sessionState.currentPlan && sessionState.currentPlan.steps.length > 0);
      const plan = this.buildPlanFromArgs(args, sessionState.currentPlan);
      if (!plan) {
        const errorResult = {
          success: false,
          error: 'Plan must include steps array with title for each step.',
          hint: 'Example: set_plan({ steps: [{ title: "Navigate to site" }, { title: "Click login" }] })',
          received: JSON.stringify(args).slice(0, 200),
        };
        sendResult(errorResult);
        return errorResult;
      }
      sessionState.currentPlan = plan;
      this.sendRuntime(options.runMeta, { type: 'plan_update', plan });
      const result = {
        success: true,
        plan,
        message: hadPlan
          ? `Plan extended with ${plan.steps.length} total steps. Continue with the active step and use update_plan({ step_index: 0, status: "done" }) after completing each step.`
          : `Plan created with ${plan.steps.length} steps. Use update_plan({ step_index: 0, status: "done" }) after completing each step.`,
      };
      sendResult(result);
      return result;
    }

    if (toolName === 'update_plan') {
      if (!sessionState.currentPlan) {
        const errorResult = {
          success: false,
          error: 'No active plan to update. Call set_plan first.',
          hint: 'Create a plan with set_plan({ steps: [{ title: "..." }, ...] }) before updating.',
        };
        sendResult(errorResult);
        return errorResult;
      }
      const rawIndex = args.step_index ?? args.stepIndex ?? args.step ?? args.index;
      const parsedIndex = typeof rawIndex === 'number' ? rawIndex : Number(rawIndex);
      let stepIndex = Number.isFinite(parsedIndex) ? parsedIndex : -1;
      const rawStatus = typeof args.status === 'string' ? args.status : 'done';
      const normalizedStatus = rawStatus === 'completed' || rawStatus === 'complete' ? 'done' : rawStatus;
      const status =
        normalizedStatus === 'pending' || normalizedStatus === 'done' || normalizedStatus === 'blocked'
          ? normalizedStatus
          : 'done';
      const maxIndex = sessionState.currentPlan.steps.length - 1;
      if (stepIndex < 0 || stepIndex > maxIndex) {
        const oneBasedIndex = stepIndex - 1;
        if (oneBasedIndex >= 0 && oneBasedIndex <= maxIndex) {
          stepIndex = oneBasedIndex;
        }
      }
      if (stepIndex < 0 || stepIndex > maxIndex) {
        const errorResult = {
          success: false,
          error: `Invalid step_index: ${stepIndex}. Valid range is 0-${maxIndex}.`,
          hint: `Plan has ${sessionState.currentPlan.steps.length} steps (indices 0 to ${maxIndex}).`,
          currentPlan: sessionState.currentPlan.steps.map((s, i) => `${i}: ${s.title} [${s.status}]`),
        };
        sendResult(errorResult);
        return errorResult;
      }
      sessionState.currentPlan.steps[stepIndex].status = status;
      sessionState.currentPlan.updatedAt = Date.now();
      this.sendRuntime(options.runMeta, { type: 'plan_update', plan: sessionState.currentPlan });
      const result = { success: true, step: stepIndex, status, plan: sessionState.currentPlan };
      sendResult(result);
      return result;
    }

    if (toolName === 'spawn_subagent') {
      const result = await this.handleSpawnSubagent(options.runMeta, args, options.settings);
      sendResult(result);
      return result;
    }

    if (toolName === 'set_orchestrator_plan') {
      const raw = args?.plan && typeof args.plan === 'object' ? args.plan : args;
      const nextPlan = buildOrchestratorPlan(
        {
          goal: (raw as Record<string, unknown>)?.goal,
          assumptions: (raw as Record<string, unknown>)?.assumptions,
          interviewQuestions: (raw as Record<string, unknown>)?.interviewQuestions,
          tasks: (raw as Record<string, unknown>)?.tasks,
          whiteboardKeys: (raw as Record<string, unknown>)?.whiteboardKeys,
          maxConcurrentTabs: (raw as Record<string, unknown>)?.maxConcurrentTabs,
        },
        { existingPlan: sessionState.orchestratorPlan },
      );
      if (!nextPlan.goal || !nextPlan.tasks.length) {
        const errorResult = {
          success: false,
          error: 'Invalid orchestrator plan. Provide goal and at least one task.',
        };
        sendResult(errorResult);
        return errorResult;
      }
      sessionState.orchestratorPlan = nextPlan;
      const snapshot = this.getOrchestratorPlanSnapshot(sessionState);
      const result = {
        success: true,
        plan: snapshot.plan,
        validationIssues: snapshot.validationIssues,
        readyTaskIds: snapshot.readyTaskIds,
        dispatchableTaskIds: snapshot.dispatchableTaskIds,
      };
      sendResult(result);
      return result;
    }

    if (toolName === 'get_orchestrator_plan') {
      const snapshot = this.getOrchestratorPlanSnapshot(sessionState);
      const result = {
        success: true,
        plan: snapshot.plan,
        validationIssues: snapshot.validationIssues,
        readyTaskIds: snapshot.readyTaskIds,
        dispatchableTaskIds: snapshot.dispatchableTaskIds,
        runningTaskIds: snapshot.runningTaskIds || [],
      };
      sendResult(result);
      return result;
    }

    if (toolName === 'update_orchestrator_task') {
      const plan = sessionState.orchestratorPlan;
      if (!plan) {
        const errorResult = { success: false, error: 'No orchestrator plan is set.' };
        sendResult(errorResult);
        return errorResult;
      }
      const taskId = String(args?.id || args?.taskId || '').trim();
      if (!taskId) {
        const errorResult = { success: false, error: 'Missing task id.' };
        sendResult(errorResult);
        return errorResult;
      }
      const task = plan.tasks.find((entry) => entry.id === taskId);
      if (!task) {
        const errorResult = { success: false, error: `Task "${taskId}" not found.` };
        sendResult(errorResult);
        return errorResult;
      }
      if (typeof args?.status === 'string') {
        task.status = normalizeOrchestratorTaskStatus(args.status);
      }
      if (typeof args?.notes === 'string' && args.notes.trim()) {
        task.notes = args.notes.trim();
      }
      if (typeof args?.assignedProfile === 'string') {
        task.assignedProfile = args.assignedProfile.trim() || undefined;
      }
      if (typeof args?.assignedTabId === 'number' && Number.isFinite(args.assignedTabId)) {
        task.assignedTabId = args.assignedTabId;
      }
      plan.updatedAt = Date.now();
      const snapshot = this.getOrchestratorPlanSnapshot(sessionState);
      const result = {
        success: true,
        task,
        validationIssues: snapshot.validationIssues,
        readyTaskIds: snapshot.readyTaskIds,
      };
      sendResult(result);
      return result;
    }

    if (toolName === 'dispatch_orchestrator_tasks') {
      const plan = sessionState.orchestratorPlan;
      if (!plan) {
        const errorResult = { success: false, error: 'No orchestrator plan is set.' };
        sendResult(errorResult);
        return errorResult;
      }
      const onlyTaskIds = new Set(
        (Array.isArray(args?.onlyTaskIds) ? args.onlyTaskIds : [])
          .map((value: unknown) => String(value || '').trim())
          .filter(Boolean),
      );
      const runningTaskIds = this.getRunningOrchestratorTaskIds(sessionState);
      const availableSlots = Math.max(0, 5 - this.getRunningSubagentCount(sessionState));
      const maxTasks = Math.max(
        0,
        Math.min(availableSlots, Number.isFinite(Number(args?.maxTasks)) ? Math.floor(Number(args.maxTasks)) : 5),
      );
      const dispatchableIds = getDispatchableOrchestratorTaskIds(plan, {
        runningTaskIds,
        maxSlots: maxTasks || 1,
      }).filter((taskId) => (onlyTaskIds.size ? onlyTaskIds.has(taskId) : true));

      const dispatched: Array<{ taskId: string; subagentId?: string; status: string; error?: string }> = [];
      for (const taskId of dispatchableIds.slice(0, maxTasks)) {
        const task = plan.tasks.find((entry) => entry.id === taskId);
        if (!task) continue;
        const spawnResult = await this.handleSpawnSubagent(
          options.runMeta,
          {
            mode: 'async',
            profile: task.assignedProfile,
            tabId: task.assignedTabId,
            prompt: task.prompt || `Complete task "${task.title}" and publish outputs to whiteboard.`,
            tasks: [
              task.title,
              task.summary || '',
              `Required outputs: ${task.outputs.map((output) => output.key).join(', ') || 'none'}`,
            ].filter(Boolean),
            whiteboardKeys: Array.from(new Set([...task.inputs.map((binding) => binding.key), ...task.outputs.map((binding) => binding.key)])),
            taskId: task.id,
            name: `Task ${task.id}`,
          },
          options.settings,
        );
        if (spawnResult?.success) {
          this.updateOrchestratorTaskStatus(sessionState, task.id, 'running');
          dispatched.push({ taskId: task.id, subagentId: spawnResult.id, status: 'running' });
        } else {
          this.updateOrchestratorTaskStatus(sessionState, task.id, 'blocked', String(spawnResult?.error || 'dispatch failed'));
          dispatched.push({
            taskId: task.id,
            status: 'blocked',
            error: String(spawnResult?.error || 'dispatch failed'),
          });
        }
      }
      const snapshot = this.getOrchestratorPlanSnapshot(sessionState);
      const result = {
        success: true,
        dispatched,
        readyTaskIds: snapshot.readyTaskIds,
        dispatchableTaskIds: snapshot.dispatchableTaskIds,
        runningTaskIds: snapshot.runningTaskIds || [],
        validationIssues: snapshot.validationIssues,
      };
      sendResult(result);
      return result;
    }

    if (toolName === 'list_subagents') {
      const result = {
        success: true,
        runningCount: this.getRunningSubagentCount(sessionState),
        subagents: this.listSubagentRuns(sessionState),
        tabLeases: Array.from(sessionState.tabLeases.entries()).map(([tabId, subagentId]) => ({
          tabId,
          subagentId,
        })),
      };
      sendResult(result);
      return result;
    }

    if (toolName === 'await_subagent') {
      const requestedIds = new Set(
        [
          ...(typeof args?.id === 'string' ? [args.id] : []),
          ...(Array.isArray(args?.ids) ? args.ids : []),
        ]
          .map((value) => String(value || '').trim())
          .filter(Boolean),
      );
      const defaultIds = Array.from(sessionState.subAgentRuns.values())
        .filter((run) => run.status === 'running')
        .map((run) => run.id);
      const targetIds = requestedIds.size ? Array.from(requestedIds) : defaultIds;
      const timeoutMs = Math.max(500, Math.min(120000, Number(args?.timeoutMs || 30000)));
      const missingIds = targetIds.filter((id) => !sessionState.subAgentRuns.has(id));
      const waitResult = await this.awaitSubagentRuns(
        sessionState,
        targetIds.filter((id) => !missingIds.includes(id)),
        timeoutMs,
      );
      const result = {
        success: true,
        timedOut: waitResult.timedOut,
        waitedMs: waitResult.waitedMs,
        targetIds,
        missingIds,
        runningCount: this.getRunningSubagentCount(sessionState),
        subagents: this.listSubagentRuns(sessionState),
      };
      sendResult(result);
      return result;
    }

    if (toolName === 'subagent_complete') {
      const result = { success: true, ack: true, details: args || {} };
      sendResult(result);
      return result;
    }

    if (toolName === 'whiteboard_get') {
      const key = String(args?.key || '').trim();
      if (!key) {
        const errorResult = {
          success: false,
          error: 'Missing key.',
        };
        sendResult(errorResult);
        return errorResult;
      }
      const entry = this.getWhiteboardEntry(sessionState, key);
      const result = entry
        ? { success: true, found: true, entry: { ...entry }, availableKeys: Array.from(sessionState.whiteboard.keys()) }
        : { success: true, found: false, key, availableKeys: Array.from(sessionState.whiteboard.keys()) };
      sendResult(result);
      return result;
    }

    if (toolName === 'whiteboard_set') {
      const key = String(args?.key || '').trim();
      if (!key) {
        const errorResult = {
          success: false,
          error: 'Missing key.',
        };
        sendResult(errorResult);
        return errorResult;
      }
      const entry = this.setWhiteboardEntry(sessionState, key, args?.value, {
        updatedBy: options.actor === 'subagent' ? 'subagent' : 'assistant',
        note: typeof args?.note === 'string' ? args.note : undefined,
        merge: args?.merge === true,
      });
      const result = {
        success: true,
        entry,
        entryCount: sessionState.whiteboard.size,
      };
      sendResult(result);
      return result;
    }

    if (toolName === 'whiteboard_list') {
      const result = {
        success: true,
        entries: this.getWhiteboardEntries(sessionState),
        entryCount: sessionState.whiteboard.size,
      };
      sendResult(result);
      return result;
    }

    if (toolName === 'list_report_images') {
      const images = this.getReportImageSummary(sessionState);
      const result = {
        success: true,
        images,
        selectedImageIds: Array.from(sessionState.selectedReportImageIds),
        selectedCount: sessionState.selectedReportImageIds.size,
      };
      sendResult(result);
      return result;
    }

    if (toolName === 'select_report_images') {
      const rawIds = Array.isArray(args?.imageIds) ? args.imageIds : Array.isArray(args?.ids) ? args.ids : [];
      const imageIds = rawIds
        .map((value: unknown) => String(value || '').trim())
        .filter((value: string) => value.length > 0);
      const requestedMode = String(args?.mode || '').toLowerCase();
      const mode: 'replace' | 'add' | 'remove' | 'clear' =
        requestedMode === 'add' || requestedMode === 'remove' || requestedMode === 'clear' ? requestedMode : 'replace';

      const images = this.applyReportImageSelection(sessionState, imageIds, mode);
      const selectedImageIds = Array.from(sessionState.selectedReportImageIds);
      this.sendRuntime(options.runMeta, {
        type: 'report_images_selection',
        images,
        selectedImageIds,
      });
      const result = {
        success: true,
        mode,
        selectedImageIds,
        selectedCount: selectedImageIds.length,
        images,
      };
      sendResult(result);
      return result;
    }

    const available = browserTools?.tools ? Object.keys(browserTools.tools) : [];
    if (!available.includes(toolName)) {
      const errorResult = {
        success: false,
        error: `Unknown tool: ${toolName}`,
      };
      sendResult(errorResult);
      return errorResult;
    }

    // Use the run's settings snapshot so parallel runs can't trample each other.
    const permissionCheck = await this.checkToolPermission(toolName, args, options.settings, sessionId);
    if (!permissionCheck.allowed) {
      const blocked = {
        success: false,
        error: permissionCheck.reason || 'Tool blocked by permissions.',
        policy: permissionCheck.policy,
      };
      sendResult(blocked);
      return blocked;
    }

    if (toolName === 'screenshot' && options.settings?.enableScreenshots === false) {
      const blocked = {
        success: false,
        error: 'Screenshots are disabled in settings.',
      };
      sendResult(blocked);
      return blocked;
    }

    let result: any;
    try {
      result = await browserTools.executeTool(toolName, args);
    } catch (error) {
      const errorResult = {
        success: false,
        error: error?.message || String(error) || 'Tool execution failed',
      };
      sendResult(errorResult);
      return errorResult;
    }

    const finalResult = result || { error: 'No result returned' };

    // Failure dedup: track repeated failures on same tool+target
    const failureKey = `${toolName}:${args?.selector || args?.url || ''}`;
    if (finalResult.success === false || finalResult.error) {
      const tracker = sessionState.failureTracker || new Map();
      sessionState.failureTracker = tracker;
      const existing = tracker.get(failureKey) || { count: 0, lastError: '' };
      existing.count++;
      existing.lastError = String(finalResult.error || '');
      tracker.set(failureKey, existing);
      if (existing.count >= 3) {
        finalResult._failureAdvice = `This tool+target has failed ${existing.count} times. Try a fundamentally different approach (different selector, different strategy, or skip this step).`;
      }
    } else {
      // Clear failure tracker on success for this key
      sessionState.failureTracker?.delete(failureKey);
    }

    // Broadcast session tab state after tab-modifying tools
    const tabModifyingTools = ['openTab', 'closeTab', 'navigate', 'switchTab', 'focusTab'];
    if (tabModifyingTools.includes(toolName)) {
      const state = browserTools.getSessionState();
      this.sendRuntime(options.runMeta, {
        type: 'session_tabs_update',
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        maxTabs: state.maxTabs,
        groupTitle: state.groupTitle,
      });
    }

    // Track state for enforcement - only set awaiting if tool succeeded
    const browserActions = ['navigate', 'click', 'clickAt', 'type', 'scroll', 'pressKey'];
    if (browserActions.includes(toolName) && finalResult?.success !== false) {
      sessionState.lastBrowserAction = toolName;
      sessionState.awaitingVerification = true;
      sessionState.currentStepVerified = false;
    } else if (toolName === 'getContent') {
      sessionState.awaitingVerification = false;
      sessionState.currentStepVerified = true;
    }

    if (toolName === 'screenshot' && finalResult?.success && finalResult.dataUrl) {
      if (options.settings?.visionBridge && options.visionProfile?.apiKey) {
        try {
          const description = await describeImageWithModel({
            settings: {
              provider: options.visionProfile.provider,
              apiKey: options.visionProfile.apiKey,
              model: options.visionProfile.model,
              customEndpoint: options.visionProfile.customEndpoint,
            },
            dataUrl: finalResult.dataUrl,
            prompt: 'Provide a concise description of this screenshot for a non-vision model.',
          });
          finalResult.visionDescription = description;
          finalResult.message = 'Screenshot captured and described by vision model.';
        } catch (visionError) {
          finalResult.visionError = visionError.message;
        }
      }

      const reportImage = this.captureReportImage(sessionState, finalResult, args, callId);
      if (reportImage) {
        const imagePayload = {
          id: reportImage.id,
          dataUrl: reportImage.dataUrl,
          capturedAt: reportImage.capturedAt,
          toolCallId: reportImage.toolCallId,
          tabId: reportImage.tabId,
          url: reportImage.url,
          title: reportImage.title,
          visionDescription: reportImage.visionDescription,
          selected: sessionState.selectedReportImageIds.has(reportImage.id),
        };
        this.sendRuntime(options.runMeta, {
          type: 'report_image_captured',
          image: imagePayload,
          images: this.getReportImageSummary(sessionState),
          selectedImageIds: Array.from(sessionState.selectedReportImageIds),
        });
        finalResult.reportImageId = reportImage.id;
      }

      if (!options.settings?.sendScreenshotsAsImages) {
        delete finalResult.dataUrl;
      }
    }

    // Handle video frame analysis with vision model
    if (
      toolName === 'watchVideo' &&
      finalResult?.success &&
      finalResult.frames &&
      finalResult.frames.length > 0 &&
      options.settings?.visionBridge &&
      options.visionProfile?.apiKey
    ) {
      try {
        const frames = finalResult.frames as Array<{ time: number; timeFormatted: string; dataUrl: string }>;
        const question =
          finalResult.question ||
          'What is happening in this video? Describe the content, actions, and any important details.';

        // Build multi-frame analysis prompt
        const frameDescriptions: string[] = [];

        // Process frames (limit to avoid token limits)
        const maxFrames = Math.min(frames.length, 8);
        const step = frames.length > maxFrames ? Math.floor(frames.length / maxFrames) : 1;

        for (let i = 0; i < frames.length && frameDescriptions.length < maxFrames; i += step) {
          const frame = frames[i];
          try {
            const description = await describeImageWithModel({
              settings: {
                provider: options.visionProfile.provider,
                apiKey: options.visionProfile.apiKey,
                model: options.visionProfile.model,
                customEndpoint: options.visionProfile.customEndpoint,
              },
              dataUrl: frame.dataUrl,
              prompt: `At timestamp ${frame.timeFormatted}: Describe what you see in this video frame. Be specific about visual content, people, objects, text, actions, and scene changes.`,
              maxTokens: 256,
            });
            frameDescriptions.push(`[${frame.timeFormatted}] ${description}`);
          } catch (frameError) {
            frameDescriptions.push(`[${frame.timeFormatted}] (Failed to analyze frame: ${frameError.message})`);
          }
        }

        // Now summarize the entire video based on frame descriptions
        const fullDescription = await describeImageWithModel({
          settings: {
            provider: options.visionProfile.provider,
            apiKey: options.visionProfile.apiKey,
            model: options.visionProfile.model,
            customEndpoint: options.visionProfile.customEndpoint,
          },
          dataUrl: frames[0].dataUrl, // Use first frame as reference
          prompt: `Based on these frame-by-frame descriptions from a video:\n\n${frameDescriptions.join('\n\n')}\n\n${question}\n\nProvide a coherent summary of what happens in the video.`,
          maxTokens: 1024,
        });

        finalResult.analysis = fullDescription;
        finalResult.frameDescriptions = frameDescriptions;
        finalResult.analyzedFrameCount = frameDescriptions.length;
        finalResult.message = `Analyzed ${frameDescriptions.length} frames from video.`;

        // Remove raw frame data to reduce response size
        delete finalResult.frames;
      } catch (visionError) {
        finalResult.visionError = visionError.message;
        finalResult.message = `Video frames captured but analysis failed: ${visionError.message}`;
      }
    } else if (toolName === 'watchVideo' && finalResult?.success && finalResult.frames) {
      // No vision profile configured - keep frames but note limitation
      finalResult.message = `Captured ${finalResult.frames.length} video frames. Configure a vision profile to enable automatic analysis.`;
    }

    const enrichedResult = this.attachPlanToResult(finalResult, toolName, sessionState);
    sendResult(enrichedResult);
    return enrichedResult;
  }

  attachPlanToResult(result: unknown, toolName: string, sessionState: SessionState) {
    if (!sessionState.currentPlan || toolName === 'set_plan') return result;
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      return { ...(result as Record<string, unknown>), plan: sessionState.currentPlan };
    }
    return { result, plan: sessionState.currentPlan };
  }

  private getReportImageSummary(sessionState: SessionState) {
    return sessionState.reportImages.map((image) => ({
      id: image.id,
      capturedAt: image.capturedAt,
      url: image.url,
      title: image.title,
      tabId: image.tabId,
      visionDescription: image.visionDescription,
      selected: sessionState.selectedReportImageIds.has(image.id),
    }));
  }

  private captureReportImage(
    sessionState: SessionState,
    result: Record<string, any>,
    args: Record<string, any>,
    toolCallId: string,
  ): ReportImage | null {
    const dataUrl = typeof result?.dataUrl === 'string' ? result.dataUrl : '';
    if (!dataUrl) return null;

    const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const image: ReportImage = {
      id,
      dataUrl,
      capturedAt: Date.now(),
      toolCallId,
      tabId: typeof args?.tabId === 'number' ? args.tabId : undefined,
      url: typeof result?.url === 'string' ? result.url : undefined,
      title: typeof result?.title === 'string' ? result.title : undefined,
      visionDescription: typeof result?.visionDescription === 'string' ? result.visionDescription : undefined,
    };
    sessionState.reportImages.push(image);
    return image;
  }

  private applyReportImageSelection(
    sessionState: SessionState,
    imageIds: string[],
    mode: 'replace' | 'add' | 'remove' | 'clear',
  ) {
    const validIds = new Set(sessionState.reportImages.map((image) => image.id));
    const filteredIds = imageIds.filter((id) => validIds.has(id));

    if (mode === 'clear') {
      sessionState.selectedReportImageIds.clear();
    } else if (mode === 'replace') {
      sessionState.selectedReportImageIds = new Set(filteredIds);
    } else if (mode === 'add') {
      filteredIds.forEach((id) => sessionState.selectedReportImageIds.add(id));
    } else if (mode === 'remove') {
      filteredIds.forEach((id) => sessionState.selectedReportImageIds.delete(id));
    }

    return this.getReportImageSummary(sessionState);
  }

  extractXmlToolCalls(text: string): Array<{ name: string; args: Record<string, unknown>; raw: string }> {
    if (!text || typeof text !== 'string') return [];
    const results: Array<{ name: string; args: Record<string, unknown>; raw: string }> = [];
    const blocks: string[] = [];

    const blockRegex = /<\s*(?:tool|function)_call[^>]*>[\s\S]*?<\s*\/\s*(?:tool|function)_call\s*>/gi;
    let match: RegExpExecArray | null;
    while ((match = blockRegex.exec(text))) {
      blocks.push(match[0]);
    }

    const inlineRegex = /([A-Za-z0-9_]+)\s*<\s*argkey\s*>[\s\S]*?<\s*\/\s*tool_call\s*>/gi;
    while ((match = inlineRegex.exec(text))) {
      blocks.push(match[0]);
    }

    if (!blocks.length && /<\s*argkey\s*>/i.test(text)) {
      blocks.push(text);
    }

    for (const block of blocks) {
      const name = this.extractXmlToolName(block);
      if (!name) continue;
      const args = this.extractXmlArgs(block);
      results.push({ name, args, raw: block });
    }

    return results;
  }

  extractXmlToolName(block: string): string {
    const nameMatch =
      block.match(/<\s*(?:tool|function)_name\s*>([^<]+)<\s*\/\s*(?:tool|function)_name\s*>/i) ||
      block.match(/<\s*name\s*>([^<]+)<\s*\/\s*name\s*>/i) ||
      block.match(/<\s*tool\s*>([^<]+)<\s*\/\s*tool\s*>/i) ||
      block.match(/<\s*function\s*>([^<]+)<\s*\/\s*function\s*>/i) ||
      block.match(/([A-Za-z0-9_]+)\s*<\s*argkey\s*>/i);

    if (!nameMatch) return '';
    const name = nameMatch[1] ? String(nameMatch[1]) : '';
    return name.trim();
  }

  extractXmlArgs(block: string): Record<string, unknown> {
    const args: Record<string, unknown> = {};
    const pairRegex = /<\s*argkey\s*>([\s\S]*?)<\s*\/\s*argkey\s*>\s*<\s*argvalue\s*>([\s\S]*?)<\s*\/\s*argvalue\s*>/gi;
    let match: RegExpExecArray | null;
    while ((match = pairRegex.exec(block))) {
      const key = String(match[1] || '').trim();
      const value = this.coerceXmlArgValue(String(match[2] || '').trim());
      if (key) args[key] = value;
    }

    const namedRegex = /<\s*arg\s+name\s*=\s*['\"]?([^'\">]+)['\"]?\s*>([\s\S]*?)<\s*\/\s*arg\s*>/gi;
    while ((match = namedRegex.exec(block))) {
      const key = String(match[1] || '').trim();
      const value = this.coerceXmlArgValue(String(match[2] || '').trim());
      if (key) args[key] = value;
    }

    return args;
  }

  coerceXmlArgValue(value: string): unknown {
    if (!value) return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (!Number.isNaN(Number(trimmed)) && trimmed.length < 18) return Number(trimmed);
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  stripXmlToolCalls(text: string): string {
    if (!text || typeof text !== 'string') return text;
    let cleaned = text;
    cleaned = cleaned.replace(/<\s*(?:tool|function)_call[^>]*>[\s\S]*?<\s*\/\s*(?:tool|function)_call\s*>/gi, '');
    cleaned = cleaned.replace(/[A-Za-z0-9_]+\s*<\s*argkey\s*>[\s\S]*?<\s*\/\s*tool_call\s*>/gi, '');
    cleaned = cleaned.replace(/<\s*argkey\s*>[\s\S]*?<\s*\/\s*argvalue\s*>/gi, '');
    return cleaned.trim();
  }

  parsePlanSteps(text: string) {
    if (!text) return [];
    return text
      .split('\n')
      .map((line) =>
        line
          .replace(/^\s*[-*]\s*/, '')
          .replace(/^\s*\d+[.)]\s*/, '')
          .trim(),
      )
      .filter(Boolean);
  }

  buildPlanFromArgs(args: Record<string, any>, existingPlan?: RunPlan | null) {
    const stepInput = Array.isArray(args?.steps) ? args.steps : null;
    const planText = typeof args?.plan === 'string' ? args.plan : '';
    const parsedSteps = planText ? this.parsePlanSteps(planText) : [];
    const combined = stepInput && stepInput.length ? stepInput : parsedSteps;
    if (!combined || combined.length === 0) return null;
    return buildRunPlan(combined, {
      existingPlan: existingPlan || null,
      maxSteps: 12,
    });
  }

  getWhiteboardToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'whiteboard_get',
        description: 'Read a value from shared orchestrator memory by key.',
        input_schema: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Whiteboard key to read.',
            },
          },
          required: ['key'],
        },
      },
      {
        name: 'whiteboard_set',
        description: 'Write a value to shared orchestrator memory so later steps or sub-agents can reuse it.',
        input_schema: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Whiteboard key to write.',
            },
            value: {
              description: 'Structured value to store at this key.',
            },
            note: {
              type: 'string',
              description: 'Optional note describing the source or meaning of this value.',
            },
            merge: {
              type: 'boolean',
              description: 'If true and both old/new values are objects, perform a shallow merge.',
            },
          },
          required: ['key', 'value'],
        },
      },
      {
        name: 'whiteboard_list',
        description: 'List all shared whiteboard keys and their latest values.',
        input_schema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  private getWhiteboardEntries(sessionState: SessionState) {
    return Array.from(sessionState.whiteboard.values()).map((entry) => ({ ...entry }));
  }

  private getWhiteboardEntry(sessionState: SessionState, key: string) {
    return sessionState.whiteboard.get(key) || null;
  }

  private setWhiteboardEntry(
    sessionState: SessionState,
    key: string,
    value: unknown,
    options: { updatedBy?: WhiteboardEntry['updatedBy']; note?: string; merge?: boolean } = {},
  ) {
    const existing = sessionState.whiteboard.get(key);
    const shouldMerge =
      options.merge &&
      existing?.value &&
      typeof existing.value === 'object' &&
      !Array.isArray(existing.value) &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value);
    const nextValue = shouldMerge
      ? { ...(existing?.value as Record<string, unknown>), ...(value as Record<string, unknown>) }
      : value;
    const entry: WhiteboardEntry = {
      key,
      value: nextValue,
      updatedAt: Date.now(),
      updatedBy: options.updatedBy || 'assistant',
      note: options.note?.trim() || undefined,
    };
    sessionState.whiteboard.set(key, entry);
    return entry;
  }

  private serializeWhiteboardForPrompt(sessionState: SessionState, requestedKeys?: string[]) {
    const requested = Array.isArray(requestedKeys)
      ? requestedKeys.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    const entries = requested.length
      ? requested
          .map((key) => this.getWhiteboardEntry(sessionState, key))
          .filter((entry): entry is WhiteboardEntry => Boolean(entry))
      : this.getWhiteboardEntries(sessionState);
    if (!entries.length) return '';
    return entries
      .map((entry) => {
        const serializedValue = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
        return `- ${entry.key} (${entry.updatedBy}${entry.note ? `; ${entry.note}` : ''}): ${serializedValue}`;
      })
      .join('\n');
  }

  private listSubagentRuns(sessionState: SessionState) {
    return Array.from(sessionState.subAgentRuns.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .map((run) => ({ ...run }));
  }

  private updateSubagentRun(sessionState: SessionState, id: string, patch: Partial<SubagentRunState>) {
    const existing = sessionState.subAgentRuns.get(id);
    if (!existing) return;
    sessionState.subAgentRuns.set(id, { ...existing, ...patch });
  }

  private releaseTabLease(sessionState: SessionState, subagentId: string, tabId?: number | null) {
    if (typeof tabId !== 'number') return;
    if (sessionState.tabLeases.get(tabId) === subagentId) {
      sessionState.tabLeases.delete(tabId);
    }
  }

  private getRunningSubagentCount(sessionState: SessionState) {
    return Array.from(sessionState.subAgentRuns.values()).filter((run) => run.status === 'running').length;
  }

  private async awaitSubagentRuns(sessionState: SessionState, runIds: string[], timeoutMs: number) {
    const startedAt = Date.now();
    const pendingPromises = runIds
      .map((id) => this.subagentPromisesById.get(id))
      .filter((promise): promise is Promise<Record<string, any>> => Boolean(promise));
    if (pendingPromises.length === 0) {
      return { timedOut: false, waitedMs: 0 };
    }
    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      setTimeout(() => resolve('timeout'), timeoutMs);
    });
    const raceResult = await Promise.race([Promise.allSettled(pendingPromises), timeoutPromise]);
    return {
      timedOut: raceResult === 'timeout',
      waitedMs: Date.now() - startedAt,
      subagents: this.listSubagentRuns(sessionState),
    };
  }

  private getRunningOrchestratorTaskIds(sessionState: SessionState) {
    return Array.from(sessionState.subAgentRuns.values())
      .filter((run) => run.status === 'running' && typeof run.taskId === 'string' && run.taskId)
      .map((run) => run.taskId as string);
  }

  private updateOrchestratorTaskStatus(
    sessionState: SessionState,
    taskId: string,
    status: OrchestratorTaskStatus,
    notes?: string,
  ) {
    const plan = sessionState.orchestratorPlan;
    if (!plan) return null;
    const task = plan.tasks.find((entry) => entry.id === taskId);
    if (!task) return null;
    task.status = normalizeOrchestratorTaskStatus(status);
    if (typeof notes === 'string' && notes.trim()) {
      task.notes = notes.trim();
    }
    plan.updatedAt = Date.now();
    return task;
  }

  private getOrchestratorPlanSnapshot(sessionState: SessionState) {
    const plan = sessionState.orchestratorPlan;
    if (!plan) {
      return {
        plan: null,
        validationIssues: ['No orchestrator plan set.'],
        readyTaskIds: [],
        dispatchableTaskIds: [],
      };
    }
    const runningTaskIds = this.getRunningOrchestratorTaskIds(sessionState);
    return {
      plan,
      validationIssues: getOrchestratorPlanValidationIssues(plan),
      readyTaskIds: getReadyOrchestratorTaskIds(plan),
      dispatchableTaskIds: getDispatchableOrchestratorTaskIds(plan, {
        runningTaskIds,
        maxSlots: Math.max(1, 5 - this.getRunningSubagentCount(sessionState)),
      }),
      runningTaskIds,
    };
  }

  getToolPermissionCategory(toolName) {
    const mapping = {
      navigate: 'navigate',
      openTab: 'navigate',
      click: 'interact',
      clickAt: 'interact',
      type: 'interact',
      pressKey: 'interact',
      scroll: 'interact',
      getContent: 'read',
      findHtml: 'read',
      screenshot: 'screenshots',
      watchVideo: 'screenshots',
      getVideoInfo: 'screenshots',
      getTabs: 'tabs',
      closeTab: 'tabs',
      switchTab: 'tabs',
      groupTabs: 'tabs',
      focusTab: 'tabs',
      describeSessionTabs: 'tabs',
    };
    return mapping[toolName] || null;
  }

  parseAllowedDomains(value = '') {
    return String(value)
      .split(/[\n,]/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }

  isUrlAllowed(url, allowlist) {
    if (!allowlist.length) return true;
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return allowlist.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch (error) {
      return false;
    }
  }

  async resolveToolUrl(_toolName, args, sessionId?: string) {
    if (args?.url) return args.url;
    const tools = this.getBrowserTools(sessionId || this.currentSessionId || 'default');
    const tabId = args?.tabId || tools.getCurrentSessionTabId();
    try {
      if (tabId) {
        const tab = await chrome.tabs.get(tabId);
        return tab?.url || '';
      }
    } catch (error) {
      console.warn('Failed to resolve tab URL for permissions:', error);
    }
    const [active] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    return active?.url || '';
  }

  async checkToolPermission(toolName, args, settingsOverride?: Record<string, any> | null, sessionId?: string) {
    const settings = settingsOverride || this.currentSettings;
    if (!settings) return { allowed: true };
    const permissions = settings.toolPermissions || {};
    const category = this.getToolPermissionCategory(toolName);
    if (category && permissions[category] === false) {
      return {
        allowed: false,
        reason: `Permission blocked: ${category}`,
        policy: {
          type: 'permission',
          category,
          reason: `Permission blocked: ${category}`,
        },
      };
    }

    if (category === 'tabs') return { allowed: true };

    const allowlist = this.parseAllowedDomains(settings.allowedDomains || '');
    if (!allowlist.length) return { allowed: true };

    const targetUrl = await this.resolveToolUrl(toolName, args, sessionId);
    if (!this.isUrlAllowed(targetUrl, allowlist)) {
      return {
        allowed: false,
        reason: 'Blocked by allowed domains list.',
        policy: {
          type: 'allowlist',
          domain: targetUrl,
          reason: 'Blocked by allowed domains list.',
        },
      };
    }

    return { allowed: true };
  }

  private isRunCancelled(runId: string) {
    return this.cancelledRunIds.has(runId);
  }

  private stopRun(runId: string, note = 'Stopped') {
    const active = this.activeRuns.get(runId);
    if (!active) return;

    // Tell the UI to stop "running" state without showing an error banner.
    this.sendRuntime(active.runMeta, {
      type: 'run_status',
      phase: 'stopped',
      attempts: { api: 0, tool: 0, finalize: 0 },
      maxRetries: { api: 0, tool: 0, finalize: 0 },
      note,
    });

    // From here on, suppress any further runtime events for this run.
    this.cancelledRunIds.add(runId);

    try {
      active.controller.abort(note);
    } catch {}

    if (active.origin === 'relay') {
      this.relayActiveRunIds.delete(runId);
      if (this.relay.isConnected()) {
        this.relay.notify('run.done', { runId, status: 'stopped', note });
      }
    }
  }

  private stopRunBySession(sessionId: string, note = 'Stopped') {
    const runId = this.activeRunIdBySessionId.get(sessionId);
    if (runId) {
      this.stopRun(runId, note);
      return true;
    }
    return false;
  }

  private stopAllSidepanelRuns(note = 'Stopped') {
    for (const [runId, active] of this.activeRuns.entries()) {
      if (active.origin !== 'sidepanel') continue;
      this.stopRun(runId, note);
    }
  }

  private static readonly MAX_SESSIONS = 10;

  private getSessionState(sessionId: string): SessionState {
    const id = typeof sessionId === 'string' && sessionId.trim() ? sessionId : 'default';
    const existing = this.sessionStateById.get(id);
    if (existing) {
      if (!(existing.subAgentRuns instanceof Map)) existing.subAgentRuns = new Map();
      if (!(existing.tabLeases instanceof Map)) existing.tabLeases = new Map();
      return existing;
    }
    // Evict oldest sessions when at capacity
    if (this.sessionStateById.size >= BackgroundService.MAX_SESSIONS) {
      const oldestKey = this.sessionStateById.keys().next().value;
      if (oldestKey !== undefined) this.sessionStateById.delete(oldestKey);
    }
    const created: SessionState = {
      sessionId: id,
      currentPlan: null,
      orchestratorPlan: null,
      subAgentCount: 0,
      subAgentProfileCursor: 0,
      subAgentRuns: new Map(),
      tabLeases: new Map(),
      whiteboard: new Map(),
      lastBrowserAction: null,
      awaitingVerification: false,
      currentStepVerified: false,
      kimiWarningSent: false,
      failureTracker: new Map(),
      reportImages: [],
      selectedReportImageIds: new Set(),
    };
    this.sessionStateById.set(id, created);
    return created;
  }

  private getBrowserTools(sessionId: string): BrowserTools {
    const id = typeof sessionId === 'string' && sessionId.trim() ? sessionId : 'default';
    const existing = this.browserToolsBySessionId.get(id);
    if (existing) return existing;
    // Evict oldest entries when at capacity
    if (this.browserToolsBySessionId.size >= BackgroundService.MAX_SESSIONS) {
      const oldestKey = this.browserToolsBySessionId.keys().next().value;
      if (oldestKey !== undefined) this.browserToolsBySessionId.delete(oldestKey);
    }
    const created = new BrowserTools();
    this.browserToolsBySessionId.set(id, created);
    return created;
  }

  private registerActiveRun(runMeta: RunMeta, origin: 'sidepanel' | 'relay') {
    // Allow parallel runs across sessions, but keep a single active run per
    // session to avoid interleaving output within the same chat.
    this.stopRunBySession(runMeta.sessionId, 'Superseded by a new message');

    const controller = new AbortController();
    this.activeRuns.set(runMeta.runId, { runMeta, origin, controller });
    this.activeRunIdBySessionId.set(runMeta.sessionId, runMeta.runId);
    return controller;
  }

  private cleanupRun(runMeta: RunMeta, origin: 'sidepanel' | 'relay') {
    const active = this.activeRuns.get(runMeta.runId);
    if (active && active.origin === origin) {
      this.activeRuns.delete(runMeta.runId);
    }
    const mapped = this.activeRunIdBySessionId.get(runMeta.sessionId);
    if (mapped === runMeta.runId) {
      this.activeRunIdBySessionId.delete(runMeta.sessionId);
    }
    this.cancelledRunIds.delete(runMeta.runId);
  }

  sendRuntime(runMeta: RunMeta, payload: Record<string, unknown>) {
    if (this.isRunCancelled(runMeta.runId)) return;
    const message = {
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      runId: runMeta.runId,
      turnId: runMeta.turnId,
      sessionId: runMeta.sessionId,
      timestamp: Date.now(),
      ...payload,
    };
    this.sendToSidePanel(message);

    if (this.relayActiveRunIds.has(runMeta.runId) && this.relay.isConnected()) {
      this.relay.notify('run.event', { runId: runMeta.runId, event: message });
      const type = typeof payload.type === 'string' ? payload.type : '';
      if (type === 'assistant_final') {
        this.relay.notify('run.done', { runId: runMeta.runId, status: 'completed', final: message });
      } else if (type === 'run_error') {
        this.relay.notify('run.done', { runId: runMeta.runId, status: 'failed', error: message });
      }
    }
  }

  sendToSidePanel(message) {
    chrome.runtime.sendMessage(message).catch((err) => {
      console.log('Side panel not open:', err);
    });
  }

  async getMatchedSkills(url: string): Promise<Array<{ name: string; description: string; steps: string }>> {
    try {
      const data = await chrome.storage.local.get('skills');
      const skills: ComposedSkill[] = Array.isArray(data.skills) ? data.skills : [];
      return skills
        .filter((skill) => {
          if (!skill.sitePattern) return false;
          try {
            return new RegExp(skill.sitePattern.replace(/\*/g, '.*')).test(url);
          } catch {
            return false;
          }
        })
        .slice(0, 5)
        .map((skill) => ({
          name: skill.name,
          description: skill.description,
          steps: skill.steps.map((s, i) => `${i + 1}. ${s.tool}(${JSON.stringify(s.args)})`).join('\n'),
        }));
    } catch {
      return [];
    }
  }

  enhanceSystemPrompt(
    basePrompt: string,
    context,
    sessionState: SessionState,
    matchedSkills: Array<{ name: string; description: string; steps: string }> = [],
  ) {
    const tabsSection =
      Array.isArray(context.availableTabs) && context.availableTabs.length
        ? `Tabs selected (${context.availableTabs.length}). You MUST only act on these tabs (session tabs). Always pass tabId from this list to navigate/click/clickAt/type/pressKey/scroll/getContent/findHtml/screenshot/watchVideo/getVideoInfo.\n${context.availableTabs
            .map((tab) => `  - [${tab.id}] ${tab.title || 'Untitled'} - ${tab.url}`)
            .join('\n')}`
        : 'No tabs selected; tools will fail until the user selects at least one tab in the UI.';
    const teamProfiles = Array.isArray(context.teamProfiles) ? context.teamProfiles : [];
    const teamSection = teamProfiles.length
      ? `Team profiles available for sub-agents:\n${teamProfiles
          .map((profile) => `  - ${profile.name}: ${profile.provider || 'provider'} · ${profile.model || 'model'}`)
          .join('\n')}\nUse spawn_subagent with a profile name to delegate parallel browser work.`
      : '';
    const orchestratorSection = context.orchestratorEnabled ? 'Orchestrator mode is enabled.' : '';
    const modelLabel = String(context.model || '').toLowerCase();
    const isKimi = context.provider === 'kimi' || modelLabel.includes('kimi');
    const thinkingSection =
      context.showThinking && isKimi
        ? '\n<thinking>\nIf you produce internal reasoning, wrap it in <analysis>...</analysis> tags. Keep it concise. Do not include the analysis in your final answer text.\n</thinking>'
        : '';
    const toolCatalog = Array.isArray(context.toolCatalog) ? context.toolCatalog : [];
    const availableToolNames = toolCatalog.length
      ? toolCatalog.map((tool) => String(tool?.name || '')).filter(Boolean)
      : [];
    const toolCatalogSection = toolCatalog.length
      ? `<tooling>
${toolCatalog.map((tool) => `  - ${tool.name}: ${tool.description || 'No description.'}`).join('\n')}
</tooling>`
      : '';
    const hasVisionTools =
      availableToolNames.includes('screenshot') ||
      availableToolNames.includes('watchVideo') ||
      availableToolNames.includes('getVideoInfo');
    const visionToolSection = hasVisionTools
      ? `<vision_tools>
Vision-capable tools enabled:
  - screenshot: capture a full screenshot of the current tab for visual verification.
  - watchVideo: analyze on-page video/audio elements for motion content.
  - getVideoInfo: fetch metadata for video elements (duration, playback, resolution).
  - findHtml: confirm whether exact HTML structure exists within page markup.
If vision tools are enabled, use them when visual structure or media context cannot be verified by text alone.
</vision_tools>`
      : '<vision_tools>Vision-capable tools are disabled for this model.</vision_tools>';
    const orchestratorToolSection = context.orchestratorEnabled
      ? availableToolNames.includes('spawn_subagent')
        ? '<orchestrator_tools>Orchestrator tools enabled: set_orchestrator_plan, get_orchestrator_plan, update_orchestrator_task, dispatch_orchestrator_tasks, spawn_subagent, list_subagents, await_subagent, subagent_complete, whiteboard_get, whiteboard_set, whiteboard_list. Use orchestrator-plan tools to manage graph tasks, dispatch_orchestrator_tasks for ready nodes, and await_subagent to join before synthesis.</orchestrator_tools>'
        : '<orchestrator_tools>Orchestrator mode is enabled.</orchestrator_tools>'
      : '';
    const whiteboardSnapshot = this.serializeWhiteboardForPrompt(sessionState);
    const whiteboardSection = whiteboardSnapshot
      ? `<whiteboard>Shared memory currently contains:\n${whiteboardSnapshot}\n</whiteboard>`
      : '';

    // Build state section with enforcement - tracks exactly what model needs to do next
    let stateSection = '';
    let requiredNextCall = '';

    if (!sessionState.currentPlan || sessionState.currentPlan.steps.length === 0) {
      // No plan - MUST create one first
      requiredNextCall = 'set_plan({ steps: [{ title: "..." }, ...] })';
      stateSection = `
<execution_state>
⛔ NO ACTIVE PLAN

REQUIRED NEXT CALL: ${requiredNextCall}

You CANNOT call navigate, click, clickAt, type, scroll, or pressKey until you call set_plan.
Create 3-6 specific action steps, then proceed.
</execution_state>`;
    } else {
      const steps = sessionState.currentPlan.steps;
      const doneCount = steps.filter((s) => s.status === 'done').length;
      const currentIndex = steps.findIndex((s) => s.status !== 'done');
      const planLines = steps.map((step, i) => {
        const marker = step.status === 'done' ? '[✓]' : i === currentIndex ? '[→]' : '[ ]';
        return `${marker} step_index=${i}: ${step.title}`;
      });

      if (currentIndex === -1) {
        // All steps complete
        requiredNextCall = 'Provide final summary with findings';
        stateSection = `
<execution_state>
✅ ALL STEPS COMPLETE (${doneCount}/${steps.length})
${planLines.join('\n')}

REQUIRED: Provide your final summary now with evidence from getContent.
</execution_state>`;
      } else if (sessionState.awaitingVerification) {
        // Browser action taken but getContent not called yet
        requiredNextCall = 'getContent({ mode: "text" })';
        stateSection = `
<execution_state>
PROGRESS: ${doneCount}/${steps.length} steps complete
${planLines.join('\n')}

CURRENT STEP: "${steps[currentIndex].title}"
LAST ACTION: ${sessionState.lastBrowserAction || 'unknown'}
VERIFICATION: ⚠️ PENDING - getContent NOT called

⛔ REQUIRED NEXT CALL: ${requiredNextCall}

You MUST call getContent to verify your action before proceeding.
Do NOT call update_plan or any other tool until you call getContent.
</execution_state>`;
      } else {
        // Ready to mark step done or execute next action
        requiredNextCall = `update_plan({ step_index: ${currentIndex}, status: "done" })`;
        stateSection = `
<execution_state>
PROGRESS: ${doneCount}/${steps.length} steps complete
${planLines.join('\n')}

CURRENT STEP: "${steps[currentIndex].title}"
VERIFICATION: ✓ getContent was called

⚠️ REQUIRED NEXT CALL: ${requiredNextCall}

After marking step ${currentIndex} done, proceed to step ${currentIndex + 1}.
</execution_state>`;
      }
    }

    const skillSection =
      matchedSkills.length > 0
        ? `<available_skills>\nSite-matched skills for ${context.currentUrl}:\n${matchedSkills
            .map((s) => `- ${s.name}: ${s.description}\n  Steps: ${s.steps}`)
            .join('\n')}\n</available_skills>`
        : '';

    return `${basePrompt}
 ${stateSection}${thinkingSection}
${toolCatalogSection}
${visionToolSection}
${orchestratorToolSection}
${whiteboardSection ? `\n${whiteboardSection}` : ''}
${skillSection ? `\n${skillSection}` : ''}

 <browser_context>
URL: ${context.currentUrl}
Title: ${context.currentTitle}
Tab: ${context.tabId}
${tabsSection}
</browser_context>
${orchestratorSection ? `\n${orchestratorSection}` : ''}
${teamSection ? `\n${teamSection}` : ''}

<checkpoint>
Before your next tool call, verify:
□ Required next call shown above: ${requiredNextCall}
□ If awaiting verification, call getContent first
□ If step complete, call update_plan before next step

When a tool fails:
• Read the error message carefully
• Try alternative approaches (different selector, wait longer, scroll first, etc.)
• You can retry the same tool with different parameters
• If an element is not found, try a broader selector or use text-based selection
• Never give up - keep trying until you succeed or exhaust options
</checkpoint>`;
  }

  hasOwnApiKey(profile: Record<string, any> | null | undefined) {
    return Boolean(String(profile?.apiKey || '').trim());
  }

  hasConfiguredModel(profile: Record<string, any> | null | undefined) {
    return Boolean(String(profile?.model || '').trim());
  }

  normalizeProxyModelId(provider: string, modelId: string) {
    const model = String(modelId || '').trim();
    if (!model) return '';
    if (provider !== 'openrouter') return model;
    return normalizeOpenRouterModelId(model);
  }

  hasActivePaidSubscription(settings: Record<string, any> = {}) {
    const mode = String(settings.accountModeChoice || '').toLowerCase();
    if (mode !== 'paid') return false;
    // Support both legacy subscriptions AND prepaid credits
    const hasCredits = Number(settings.convexCreditBalanceCents || 0) > 0;
    const status = String(settings.convexSubscriptionStatus || '').toLowerCase();
    const plan = String(settings.convexSubscriptionPlan || '').toLowerCase();
    const hasLegacySub = plan === 'pro' && status === 'active';
    return hasCredits || hasLegacySub;
  }

  resolveConvexProxyBaseUrl(settings: Record<string, any> = {}) {
    const explicitSite = String(settings.convexSiteUrl || '').trim();
    const rawBase = explicitSite || String(settings.convexUrl || '').trim();
    if (!rawBase) return '';
    try {
      const url = new URL(rawBase);
      if (url.hostname.endsWith('.convex.cloud')) {
        url.hostname = url.hostname.replace(/\.convex\.cloud$/i, '.convex.site');
      }
      return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
    } catch {
      return rawBase.replace(/\/+$/, '');
    }
  }

  canUseConvexProxy(settings: Record<string, any> = {}) {
    return Boolean(this.resolveConvexProxyBaseUrl(settings) && String(settings.convexAccessToken || '').trim());
  }

  async refreshConvexProxyAuthSession(settings: Record<string, any>, options: { force?: boolean } = {}) {
    const mode = String(settings.accountModeChoice || '')
      .trim()
      .toLowerCase();
    if (mode !== 'paid') return false;
    if (!this.resolveConvexProxyBaseUrl(settings)) return false;

    try {
      const session = await refreshRuntimeAuthSession({ force: options.force === true });
      const accessToken = String(session.accessToken || '').trim();
      if (!accessToken) return false;
      settings.convexAccessToken = accessToken;
      settings.convexRefreshToken = String(session.refreshToken || '').trim();
      settings.convexTokenExpiresAt = Number(session.expiresAt || 0);
      return true;
    } catch (error) {
      console.warn('[paid-auth] Failed to refresh convex proxy auth session:', error);
      return false;
    }
  }

  applyConvexProxyProfile(profile: Record<string, any>, settings: Record<string, any>) {
    const preferredProvider =
      profile?.provider === 'kimi'
        ? 'kimi'
        : profile?.provider === 'anthropic'
          ? 'anthropic'
          : profile?.provider === 'openrouter' || profile?.provider === 'parchi'
            ? 'openrouter'
            : 'openai';
    const requestedModel = String(profile?.model || settings.model || '').trim();
    const normalizedModel = this.normalizeProxyModelId(preferredProvider, requestedModel);
    const proxyBaseUrl = this.resolveConvexProxyBaseUrl(settings);
    return {
      provider: preferredProvider,
      apiKey: profile?.apiKey || '',
      model: normalizedModel,
      customEndpoint: profile?.customEndpoint || '',
      extraHeaders: profile?.extraHeaders || {},
      useProxy: true,
      proxyBaseUrl,
      proxyAuthToken: String(settings.convexAccessToken || '').trim(),
      proxyProvider: preferredProvider,
    };
  }

  resolveRuntimeModelProfile(profile: Record<string, any>, settings: Record<string, any>) {
    if (!this.hasConfiguredModel(profile)) {
      return {
        allowed: false,
        route: 'none',
        profile,
        errorMessage: 'No model configured. Open Settings and choose a model to continue.',
      };
    }
    if (this.hasOwnApiKey(profile)) {
      return { allowed: true, route: 'byok', profile };
    }
    if (!this.hasActivePaidSubscription(settings)) {
      return {
        allowed: false,
        route: 'none',
        profile,
        errorMessage: 'No access configured. Add your own API key in Setup, or buy credits in Account & Billing.',
      };
    }
    if (!this.canUseConvexProxy(settings)) {
      return {
        allowed: false,
        route: 'none',
        profile,
        errorMessage:
          'Paid access is selected but auth is missing. Sign in again in Account & Billing, then click Refresh.',
      };
    }
    return {
      allowed: true,
      route: 'proxy',
      profile: this.applyConvexProxyProfile(profile, settings),
    };
  }

  resolveProfile(settings: Record<string, any>, name = 'default') {
    const base = {
      provider: settings.provider,
      apiKey: settings.apiKey,
      model: settings.model,
      customEndpoint: settings.customEndpoint,
      extraHeaders: settings.extraHeaders,
      systemPrompt: settings.systemPrompt,
      sendScreenshotsAsImages: settings.sendScreenshotsAsImages,
      screenshotQuality: settings.screenshotQuality,
      showThinking: settings.showThinking,
      streamResponses: settings.streamResponses,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
      timeout: settings.timeout,
      contextLimit: settings.contextLimit,
      enableScreenshots: settings.enableScreenshots,
    };
    const profile = settings.configs && settings.configs[name] ? settings.configs[name] : {};
    return { ...base, ...profile };
  }

  resolveTeamProfiles(settings: Record<string, any>) {
    const names = Array.isArray(settings.auxAgentProfiles) ? settings.auxAgentProfiles : [];
    const unique = Array.from(new Set(names)).filter(
      (name): name is string => typeof name === 'string' && name.trim().length > 0,
    );
    return unique.map((name) => {
      const profile = this.resolveProfile(settings, name);
      return {
        name,
        provider: profile.provider || '',
        model: profile.model || '',
      };
    });
  }

  isVisionModelProfile(profile: Record<string, any> | null | undefined) {
    const provider = String(profile?.provider || '').toLowerCase();
    const model = String(profile?.model || '').toLowerCase();

    if (!provider) return false;
    if (provider === 'anthropic') return true;
    if (provider === 'kimi') return true;
    if (provider === 'openrouter' || provider === 'parchi') {
      return /(claude|gpt-4o|gpt-4-turbo|gemini|vision)/i.test(model);
    }
    if (provider === 'openai') {
      return /gpt-4o|gpt-4\.1|gpt-4-turbo|gpt-4-vision|vision/.test(model);
    }
    if (provider === 'google') {
      return /(gemini|imagen)/.test(model);
    }

    return model.includes('vision');
  }

  getToolsForSession(
    settings: Record<string, any>,
    includeOrchestrator = false,
    teamProfiles: Array<{ name: string }> = [],
    includeVisionTools = false,
  ) {
    let tools = this.browserTools.getToolDefinitions();
    if (settings && settings.enableScreenshots === false) {
      tools = tools.filter((tool) => tool.name !== 'screenshot');
    }
    if (!includeVisionTools) {
      tools = tools.filter(
        (tool) => tool.name !== 'screenshot' && tool.name !== 'watchVideo' && tool.name !== 'getVideoInfo',
      );
    }
    tools = tools.concat([
      {
        name: 'set_plan',
        description:
          'Set a checklist of concrete action steps to complete the task. Each step should be a single specific action (e.g., "Navigate to example.com", "Click the login button", "Extract product prices"). Avoid headers, phases, or abstract descriptions. Keep to 3-6 actionable steps. Mark steps done via update_plan as you complete them.',
        input_schema: {
          type: 'object',
          properties: {
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    description: 'Short action description (e.g., "Search for user profile", "Extract contact info")',
                  },
                  status: {
                    type: 'string',
                    enum: ['pending', 'done'],
                    description: 'Step status - pending or done',
                  },
                },
                required: ['title'],
              },
              description: 'Ordered list of 3-6 concrete action steps. Each step = one tool call or logical action.',
            },
          },
          required: ['steps'],
        },
      },
      {
        name: 'update_plan',
        description: 'Mark a plan step as done after completing it. Call this after each step you finish.',
        input_schema: {
          type: 'object',
          properties: {
            step_index: {
              type: 'number',
              description: 'Zero-based index of the step to mark done (0 = first step)',
            },
            status: {
              type: 'string',
              enum: ['done', 'pending', 'blocked'],
              description: 'New status for the step (defaults to "done")',
            },
          },
          required: ['step_index'],
        },
      },
      {
        name: 'list_report_images',
        description:
          'List screenshots captured in this run session and whether they are selected for the final report.',
        input_schema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'select_report_images',
        description:
          'Select which captured screenshots should be included in the final report export. Use mode add/remove/replace/clear.',
        input_schema: {
          type: 'object',
          properties: {
            imageIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Screenshot IDs from list_report_images.',
            },
            mode: {
              type: 'string',
              enum: ['replace', 'add', 'remove', 'clear'],
              description: 'Selection mode. replace is default.',
            },
          },
        },
      },
    ]);

    if (includeOrchestrator) {
      const teamNames = Array.isArray(teamProfiles) ? teamProfiles.map((profile) => profile.name).filter(Boolean) : [];
      const profileSchema: {
        type: string;
        description: string;
        enum?: string[];
      } = {
        type: 'string',
        description: teamNames.length
          ? `Name of saved profile to use. Available: ${teamNames.join(', ')}`
          : 'Name of saved profile to use.',
      };
      if (teamNames.length) {
        profileSchema.enum = teamNames;
      }
      tools = tools.concat([
        ...this.getWhiteboardToolDefinitions(),
        {
          name: 'set_orchestrator_plan',
          description:
            'Set or replace the orchestrator task graph plan (goal, tasks, dependencies, whiteboard bindings).',
          input_schema: {
            type: 'object',
            properties: {
              goal: { type: 'string' },
              assumptions: { type: 'array', items: { type: 'string' } },
              interviewQuestions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    question: { type: 'string' },
                    answerKey: { type: 'string' },
                    required: { type: 'boolean' },
                  },
                },
              },
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    title: { type: 'string' },
                    summary: { type: 'string' },
                    kind: { type: 'string' },
                    status: { type: 'string' },
                    dependencies: { type: 'array', items: { type: 'string' } },
                    sitePatterns: { type: 'array', items: { type: 'string' } },
                    requiredSkills: { type: 'array', items: { type: 'string' } },
                    assignedProfile: { type: 'string' },
                    assignedTabId: { type: 'number' },
                    prompt: { type: 'string' },
                  },
                  required: ['title'],
                },
              },
              whiteboardKeys: { type: 'array', items: { type: 'string' } },
              maxConcurrentTabs: { type: 'number' },
            },
            required: ['goal', 'tasks'],
          },
        },
        {
          name: 'get_orchestrator_plan',
          description: 'Get orchestrator plan status, validation issues, and currently ready/dispatchable task ids.',
          input_schema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'update_orchestrator_task',
          description: 'Update one orchestrator task status or assignment.',
          input_schema: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Task id to update.' },
              status: { type: 'string', description: 'pending|ready|running|blocked|completed|failed|cancelled' },
              notes: { type: 'string' },
              assignedProfile: { type: 'string' },
              assignedTabId: { type: 'number' },
            },
            required: ['id'],
          },
        },
        {
          name: 'dispatch_orchestrator_tasks',
          description:
            'Dispatch ready orchestrator tasks as async sub-agents (tab-pinned when assignedTabId is set).',
          input_schema: {
            type: 'object',
            properties: {
              maxTasks: { type: 'number', description: 'Max tasks to dispatch this call (default: available slots).' },
              onlyTaskIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional allowlist of task ids to dispatch.',
              },
            },
          },
        },
        {
          name: 'spawn_subagent',
          description: 'Start a focused sub-agent with its own goal, prompt, and optional profile override.',
          input_schema: {
            type: 'object',
            properties: {
              profile: profileSchema,
              prompt: {
                type: 'string',
                description: 'System prompt for the sub-agent',
              },
              tasks: {
                type: 'array',
                items: { type: 'string' },
                description: 'Task list for the sub-agent',
              },
              goal: {
                type: 'string',
                description: 'Single goal string if tasks not provided',
              },
              name: {
                type: 'string',
                description: 'Optional label for the sub-agent.',
              },
              tabId: {
                type: 'number',
                description: 'Optional session tab id to pin this sub-agent to.',
              },
              whiteboardKeys: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional whiteboard keys this sub-agent should prioritize reading.',
              },
              mode: {
                type: 'string',
                enum: ['sync', 'async'],
                description:
                  'Execution mode. Use "async" for parallel tab work and then call await_subagent to join results.',
              },
            },
          },
        },
        {
          name: 'list_subagents',
          description: 'List currently running and completed sub-agents plus active tab leases.',
          input_schema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'await_subagent',
          description:
            'Wait for one or more sub-agents to finish. If no id is provided, waits for all currently running sub-agents.',
          input_schema: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                description: 'Optional sub-agent id to wait for.',
              },
              ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional list of sub-agent ids to wait for.',
              },
              timeoutMs: {
                type: 'number',
                description: 'Optional timeout in milliseconds (default 30000).',
              },
            },
          },
        },
        {
          name: 'subagent_complete',
          description: 'Sub-agent calls this when finished to return a summary payload.',
          input_schema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              data: { type: 'object' },
            },
            required: ['summary'],
          },
        },
      ]);
    }
    return tools;
  }

  async handleSpawnSubagent(runMeta: RunMeta, args, settings: Record<string, any>) {
    const sessionState = this.getSessionState(runMeta.sessionId);
    const browserTools = this.getBrowserTools(runMeta.sessionId);
    if (sessionState.subAgentRuns.size >= 50) {
      const terminal = Array.from(sessionState.subAgentRuns.values())
        .filter((run) => run.status !== 'running')
        .sort((a, b) => a.startedAt - b.startedAt);
      while (sessionState.subAgentRuns.size >= 50 && terminal.length) {
        const stale = terminal.shift();
        if (!stale) break;
        sessionState.subAgentRuns.delete(stale.id);
      }
    }
    if (this.getRunningSubagentCount(sessionState) >= 5) {
      return {
        success: false,
        error: 'Sub-agent concurrency limit reached for this session (max 5 running).',
      };
    }
    sessionState.subAgentCount += 1;
    const subagentId = `subagent-${Date.now()}-${sessionState.subAgentCount}`;
    let profileName = args.profile || args.config;
    if (!profileName) {
      const teamProfiles = Array.isArray(settings?.auxAgentProfiles) ? settings.auxAgentProfiles : [];
      if (teamProfiles.length) {
        profileName = teamProfiles[sessionState.subAgentProfileCursor % teamProfiles.length];
        sessionState.subAgentProfileCursor += 1;
      }
    }
    if (!profileName) {
      profileName = settings?.activeConfig || 'default';
    }
    const profileSettings = this.resolveProfile(settings || {}, profileName);
    const rawLockedTabId = typeof args?.tabId === 'number' ? args.tabId : Number(args?.tabId);
    const lockedTabId = Number.isFinite(rawLockedTabId) ? rawLockedTabId : null;
    const sessionTabIds = new Set(browserTools.getSessionTabSummaries().map((tab) => tab.id));
    if (lockedTabId !== null && !sessionTabIds.has(lockedTabId)) {
      return {
        success: false,
        error: `Cannot pin sub-agent to tab ${lockedTabId}. It is not part of the current session tabs.`,
      };
    }
    if (lockedTabId !== null) {
      const leasedTo = sessionState.tabLeases.get(lockedTabId);
      if (leasedTo) {
        const owner = sessionState.subAgentRuns.get(leasedTo);
        if (!owner || owner.status !== 'running') {
          sessionState.tabLeases.delete(lockedTabId);
        } else if (leasedTo !== subagentId) {
          return {
            success: false,
            error: `Tab ${lockedTabId} is already reserved by ${leasedTo}. Wait for it or pick another tab.`,
          };
        }
      }
      sessionState.tabLeases.set(lockedTabId, subagentId);
    }

    const requestedMode = String(args?.mode || '').trim().toLowerCase();
    const mode: 'sync' | 'async' = requestedMode === 'async' || args?.detach === true ? 'async' : 'sync';
    const taskList = Array.isArray(args?.tasks)
      ? args.tasks.map((task: unknown) => String(task || '').trim()).filter(Boolean)
      : [args?.goal || args?.task || 'Task'].map((task: unknown) => String(task || '').trim()).filter(Boolean);

    const subagentName = args.name || `Sub-Agent ${sessionState.subAgentCount}`;
    sessionState.subAgentRuns.set(subagentId, {
      id: subagentId,
      name: subagentName,
      status: 'running',
      tasks: taskList,
      taskId: typeof args?.taskId === 'string' && args.taskId.trim() ? args.taskId.trim() : undefined,
      profile: profileName,
      tabId: lockedTabId ?? undefined,
      startedAt: Date.now(),
    });
    this.sendRuntime(runMeta, {
      type: 'subagent_start',
      id: subagentId,
      name: subagentName,
      tasks: taskList,
      tabId: lockedTabId ?? undefined,
      profile: profileName,
      whiteboardKeys: Array.isArray(args?.whiteboardKeys) ? args.whiteboardKeys : undefined,
    });
    const taskLines = taskList.map((task, idx) => `${idx + 1}. ${task}`).join('\n');

    const runSubagent = async () => {
      try {
        const pinnedToolBlocklist = new Set([
          'openTab',
          'closeTab',
          'switchTab',
          'focusTab',
          'groupTabs',
          'getTabs',
          'describeSessionTabs',
        ]);
        const browserScopedTools = new Set([
          'navigate',
          'click',
          'clickAt',
          'type',
          'pressKey',
          'scroll',
          'getContent',
          'findHtml',
          'screenshot',
          'watchVideo',
          'getVideoInfo',
        ]);
        const whiteboardContext = this.serializeWhiteboardForPrompt(sessionState, args?.whiteboardKeys);
        const subAgentSystemPrompt = `${args.prompt || 'You are a focused sub-agent working under an orchestrator. Be concise and tool-driven.'}
${lockedTabId !== null ? `You are pinned to tabId ${lockedTabId}. Do not open, close, switch, focus, group, or inspect any other tabs.` : ''}
${whiteboardContext ? `Shared whiteboard context:\n${whiteboardContext}` : 'Shared whiteboard context is currently empty.'}
Use whiteboard_get to read shared context and whiteboard_set to publish durable outputs for sibling tasks.
Always cite evidence from tools. Finish by calling subagent_complete with a short summary and any structured findings.`;

        let tools = this.getToolsForSession(profileSettings, false, [], this.isVisionModelProfile(profileSettings));
        tools = tools.concat(this.getWhiteboardToolDefinitions());
        tools = tools.filter((tool) => !pinnedToolBlocklist.has(tool.name) || lockedTabId === null);
        const toolSet = buildToolSet(tools, async (toolName, toolArgs, options) => {
          const nextArgs =
            toolArgs && typeof toolArgs === 'object' && !Array.isArray(toolArgs) ? { ...toolArgs } : {};
          if (lockedTabId !== null) {
            if (pinnedToolBlocklist.has(toolName)) {
              return {
                success: false,
                error: `Sub-agent is pinned to tab ${lockedTabId}; tool ${toolName} is not available in pinned mode.`,
              };
            }
            if (browserScopedTools.has(toolName)) {
              if (
                typeof (nextArgs as Record<string, any>).tabId === 'number' &&
                (nextArgs as Record<string, any>).tabId !== lockedTabId
              ) {
                return {
                  success: false,
                  error: `Sub-agent is pinned to tab ${lockedTabId}; received mismatched tabId ${(nextArgs as Record<string, any>).tabId}.`,
                };
              }
              (nextArgs as Record<string, any>).tabId = lockedTabId;
            }
          }
          return this.executeToolByName(
            toolName,
            nextArgs,
            {
              runMeta,
              settings: settings || {},
              visionProfile: this.isVisionModelProfile(profileSettings) ? profileSettings : null,
              actor: 'subagent',
            },
            options.toolCallId,
          );
        });

        const subHistory: Message[] = [
          {
            role: 'user',
            content: `Task group:\n${taskLines || 'Follow the provided prompt and complete the goal.'}`,
          },
        ];

        const subModel = resolveLanguageModel(profileSettings);
        const abortSignal = this.activeRuns.get(runMeta.runId)?.controller.signal;
        const result = streamText({
          model: subModel,
          system: subAgentSystemPrompt,
          messages: toModelMessages(subHistory),
          tools: toolSet,
          abortSignal,
          temperature: profileSettings.temperature ?? 0.4,
          maxOutputTokens: profileSettings.maxTokens ?? 1024,
          stopWhen: stepCountIs(24),
        });

        let summary: string;
        try {
          summary = (await result.text) || 'Sub-agent finished without a final summary.';
        } catch (textError) {
          const message = (textError as any)?.message || String(textError ?? '');
          if (typeof message === 'string' && message.includes('No output generated')) {
            summary = 'Sub-agent finished without generating output.';
          } else {
            throw textError;
          }
        }

        this.updateSubagentRun(sessionState, subagentId, {
          status: 'completed',
          summary,
          finishedAt: Date.now(),
        });
        const taskId =
          typeof args?.taskId === 'string' && args.taskId.trim() ? args.taskId.trim() : undefined;
        if (taskId) {
          this.updateOrchestratorTaskStatus(sessionState, taskId, 'completed');
        }
        this.sendRuntime(runMeta, {
          type: 'subagent_complete',
          id: subagentId,
          success: true,
          summary,
          tabId: lockedTabId ?? undefined,
          profile: profileName,
        });

        return {
          success: true,
          source: 'subagent',
          id: subagentId,
          name: subagentName,
          summary,
          tasks: taskLines,
          status: 'completed',
          mode,
          tabId: lockedTabId ?? undefined,
          profile: profileName,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error ?? 'Unknown error');
        console.error('[subagent] Error:', error);
        const isAbort =
          error instanceof Error && (error.name === 'AbortError' || /abort|cancel|stopped/i.test(error.message));
        this.updateSubagentRun(sessionState, subagentId, {
          status: isAbort ? 'cancelled' : 'failed',
          error: errorMessage,
          summary: `Sub-agent failed: ${errorMessage}`,
          finishedAt: Date.now(),
        });
        const taskId =
          typeof args?.taskId === 'string' && args.taskId.trim() ? args.taskId.trim() : undefined;
        if (taskId) {
          this.updateOrchestratorTaskStatus(
            sessionState,
            taskId,
            isAbort ? 'cancelled' : 'failed',
            errorMessage,
          );
        }
        this.sendRuntime(runMeta, {
          type: 'subagent_complete',
          id: subagentId,
          success: false,
          summary: `Sub-agent failed: ${errorMessage}`,
          tabId: lockedTabId ?? undefined,
          profile: profileName,
        });

        return {
          success: false,
          source: 'subagent',
          id: subagentId,
          name: subagentName,
          error: errorMessage,
          summary: `Sub-agent failed: ${errorMessage}`,
          status: isAbort ? 'cancelled' : 'failed',
          mode,
          tabId: lockedTabId ?? undefined,
          profile: profileName,
        };
      } finally {
        this.releaseTabLease(sessionState, subagentId, lockedTabId);
        this.subagentPromisesById.delete(subagentId);
      }
    };

    const subagentPromise = runSubagent();
    this.subagentPromisesById.set(subagentId, subagentPromise);
    if (mode === 'async') {
      return {
        success: true,
        source: 'subagent',
        id: subagentId,
        name: subagentName,
        mode,
        status: 'running',
        tasks: taskList,
        tabId: lockedTabId ?? undefined,
        profile: profileName,
      };
    }
    return await subagentPromise;
  }
}

// Instantiated by packages/extension/background.ts entrypoint.
