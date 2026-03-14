import type { RunPlan } from '@parchi/shared';
import { RecordingCoordinator } from '../recording/recording-coordinator.js';
import type { RelayBridge } from '../relay/relay-bridge.js';
import { BrowserTools } from '../tools/browser-tools.js';
import { processUserMessage } from './agent/agent-loop/index.js';
import { processContextCompaction } from './agent/compaction/runner.js';
import { setupActionClickOpensPanel, setupKimiUserAgentHeaderSupport } from './browser-compat.js';
import { handleMessage } from './message-router.js';
import {
  createApplyRelayConfig,
  createRelayBridge,
  handleRelayRpc,
  initRelay,
  scheduleRelayAutoPairCheck,
} from './relay/relay-handler.js';
import type { ActiveRun, ServiceContext, TokenTracePayload } from './service-context.js';
import type { RunMeta, SessionState } from './service-types.js';
import {
  cleanupRun,
  emitTokenTrace,
  getBrowserTools,
  getSessionState,
  isRunCancelled,
  registerActiveRun,
  sendRuntime as sendRuntimeImpl,
  stopAllSidepanelRuns,
  stopRunBySession,
} from './session-manager.js';
import { generateWorkflowPrompt, runApiSmokeTest } from './smoke-test.js';
import { type SubagentTabBadgeState, sendSubagentTabBadge } from './subagent-tab-badges.js';
import { getToolsForSession } from './tools/tool-catalog.js';
import { executeToolByName } from './tools/tool-executor/index.js';

export class BackgroundService implements ServiceContext {
  browserTools: BrowserTools;
  currentSettings: Record<string, any> | null;
  currentSessionId: string | null;
  currentPlan: RunPlan | null;
  subAgentCount: number;
  subAgentProfileCursor: number;
  relay: RelayBridge;
  relayActiveRunIds: Set<string>;
  private applyRelayConfig: () => Promise<void>;
  _relayStatusTimer: ReturnType<typeof setTimeout> | undefined;
  _relayAutoPairTimer: ReturnType<typeof setTimeout> | undefined;
  private relayKeepalivePorts: Set<chrome.runtime.Port>;
  sidepanelLifecyclePorts: Set<chrome.runtime.Port>;
  kimiHeaderRuleOk: boolean;
  kimiHeaderMode: 'dnr' | 'webRequest' | 'none';
  recordingCoordinator: RecordingCoordinator;
  subagentTabBadges: Map<number, SubagentTabBadgeState>;

  activeRuns: Map<string, ActiveRun>;
  activeRunIdBySessionId: Map<string, string>;
  cancelledRunIds: Set<string>;
  private sessionStateById: Map<string, SessionState>;
  private browserToolsBySessionId: Map<string, BrowserTools>;

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
    this.recordingCoordinator = new RecordingCoordinator();
    this.subagentTabBadges = new Map();
    this.kimiHeaderRuleOk = false;
    this.kimiHeaderMode = 'none';

    this.relay = createRelayBridge(this);
    this.applyRelayConfig = createApplyRelayConfig(this);

    this.init();
  }

  private init() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      void handleMessage(this, message, sender, sendResponse, this.applyRelayConfig).catch((error) => {
        console.error('Unhandled runtime message error:', error);
        try {
          const err = error instanceof Error ? error : new Error(String(error ?? 'Unknown error'));
          sendResponse({
            success: false,
            error: err.message,
            errorName: err.name,
            ...(err.stack ? { errorStack: err.stack } : {}),
          });
        } catch (responseError) {
          console.error('Failed to bubble runtime message error:', responseError);
        }
      });
      return true;
    });

    setupActionClickOpensPanel();

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

    chrome.runtime.onStartup?.addListener(() => void this.applyRelayConfig());
    chrome.runtime.onInstalled?.addListener(() => void this.applyRelayConfig());
    chrome.tabs.onRemoved.addListener((tabId) => this.subagentTabBadges.delete(tabId));

    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === 'relay-keepalive') {
        this.relayKeepalivePorts.add(port);
        port.onDisconnect.addListener(() => this.relayKeepalivePorts.delete(port));
        port.onMessage.addListener(() => {});
        return;
      }

      if (port.name === 'sidepanel-lifecycle') {
        this.sidepanelLifecyclePorts.add(port);
        port.onMessage.addListener((message) => {
          if (!message || typeof message !== 'object' || message.type !== 'stop_run') return;
          const sessionId = typeof message.sessionId === 'string' ? message.sessionId : '';
          const note = typeof message.note === 'string' && message.note.trim() ? String(message.note) : 'Stopped';
          const stopped = sessionId ? stopRunBySession(this, sessionId, note) : false;
          if (!stopped) stopAllSidepanelRuns(this, note);
        });
        port.onDisconnect.addListener(() => {
          this.sidepanelLifecyclePorts.delete(port);
          if (this.sidepanelLifecyclePorts.size === 0) {
            stopAllSidepanelRuns(this, 'Stopped (panel closed)');
          }
        });
      }
    });

    void initRelay(this, this.applyRelayConfig);
  }

  // ServiceContext implementation
  sendRuntime(runMeta: RunMeta, payload: Record<string, unknown>) {
    sendRuntimeImpl(this, runMeta, payload);
  }

  sendToSidePanel(message: unknown) {
    chrome.runtime.sendMessage(message).catch((err) => {
      console.log('Side panel not open:', err);
    });
  }

  getSessionState(sessionId: string): SessionState {
    return getSessionState(this.sessionStateById, sessionId);
  }

  getBrowserTools(sessionId: string): BrowserTools {
    return getBrowserTools(this.browserToolsBySessionId, this.currentSettings, sessionId);
  }

  releaseSessionResources(sessionId: string) {
    this.sessionStateById.delete(sessionId);
    this.browserToolsBySessionId.delete(sessionId);
  }

  setSubagentTabBadge(tabId: number, state: SubagentTabBadgeState) {
    this.subagentTabBadges.set(tabId, state);
    void sendSubagentTabBadge(tabId, state);
  }

  syncSubagentTabBadge(tabId: number) {
    const state = this.subagentTabBadges.get(tabId);
    if (state) void sendSubagentTabBadge(tabId, state);
  }

  emitTokenTrace(runMeta: RunMeta, sessionState: SessionState, payload: TokenTracePayload) {
    emitTokenTrace(this, runMeta, sessionState, payload);
  }

  isRunCancelled(runId: string): boolean {
    return isRunCancelled(this.cancelledRunIds, runId);
  }

  registerActiveRun(runMeta: RunMeta, origin: 'sidepanel' | 'relay'): AbortController {
    return registerActiveRun(this, runMeta, origin);
  }

  cleanupRun(runMeta: RunMeta, origin: 'sidepanel' | 'relay') {
    cleanupRun(this, runMeta, origin);
  }

  stopRunBySession(sessionId: string, note = 'Stopped'): boolean {
    return stopRunBySession(this, sessionId, note);
  }

  stopAllSidepanelRuns(note = 'Stopped') {
    stopAllSidepanelRuns(this, note);
  }

  // Delegated methods
  async processUserMessage(
    userMessage: string,
    conversationHistory: any[],
    selectedTabs: chrome.tabs.Tab[],
    sessionId: string,
    meta?: Partial<RunMeta> & { origin?: 'sidepanel' | 'relay' },
    recordedContext?: any,
  ) {
    return processUserMessage(this, userMessage, conversationHistory, selectedTabs, sessionId, meta, recordedContext);
  }

  async processContextCompaction(
    conversationHistory: any[],
    sessionId: string,
    options?: { source?: string; force?: boolean },
  ) {
    return processContextCompaction(this, conversationHistory, sessionId, options);
  }

  async executeToolByName(
    toolName: string,
    args: Record<string, any>,
    options: { runMeta: RunMeta; settings: Record<string, any>; visionProfile?: Record<string, any> | null },
    toolCallId?: string,
  ) {
    return executeToolByName(this, toolName, args, options, toolCallId);
  }

  getToolsForSession(
    settings: Record<string, any>,
    includeOrchestrator?: boolean,
    teamProfiles?: Array<{ name: string }>,
    includeVisionTools?: boolean,
  ) {
    return getToolsForSession(this.browserTools, settings, includeOrchestrator, teamProfiles, includeVisionTools);
  }

  async runApiSmokeTest(settings: Record<string, any>, prompt: string) {
    return runApiSmokeTest(settings, prompt);
  }

  async generateWorkflowPrompt(sessionContext: string, maxOutputTokens?: number) {
    return generateWorkflowPrompt(sessionContext, maxOutputTokens);
  }

  // For backward compatibility with relay handler
  async handleRelayRpc(method: string, params: unknown) {
    return handleRelayRpc(this, method, params);
  }

  scheduleRelayAutoPairCheck(delayMs = 1500) {
    scheduleRelayAutoPairCheck(this, delayMs);
  }
}
