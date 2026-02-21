import { APICallError } from '@ai-sdk/provider';
import { generateText, stepCountIs, streamText } from 'ai';
import { buildRunPlan } from '../../shared/src/plan.js';
import type { RunPlan } from '../../shared/src/plan.js';
import { RUNTIME_MESSAGE_SCHEMA_VERSION } from '../../shared/src/runtime-messages.js';
import { PARCHI_STORAGE_KEYS } from '../../shared/src/settings.js';
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
import { buildToolSet, describeImageWithModel, resolveLanguageModel } from '../ai/sdk-client.js';
import { RelayBridge } from '../relay/relay-bridge.js';
import { BrowserTools } from '../tools/browser-tools.js';
import { getActiveTab } from '../utils/active-tab.js';

type RunMeta = {
  runId: string;
  turnId: string;
  sessionId: string;
};

type SessionState = {
  sessionId: string;
  currentPlan: RunPlan | null;
  subAgentCount: number;
  subAgentProfileCursor: number;
  lastBrowserAction: string | null;
  awaitingVerification: boolean;
  currentStepVerified: boolean;
  kimiWarningSent: boolean;
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
  private safariPanelWindowId: number | null;
  private alarmKeepaliveRegistered: boolean;
  // State tracking for enforcement
  lastBrowserAction: string | null;
  awaitingVerification: boolean;
  currentStepVerified: boolean;
  kimiHeaderRuleOk: boolean;
  kimiWarningSent: boolean;

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

  constructor() {
    this.browserTools = new BrowserTools();
    this.currentSettings = null;
    this.currentSessionId = null;
    this.currentPlan = null;
    this.subAgentCount = 0;
    this.subAgentProfileCursor = 0;
    this.relayActiveRunIds = new Set();
    this.relayKeepalivePorts = new Set();
    this.safariPanelWindowId = null;
    this.alarmKeepaliveRegistered = false;
    this.activeRuns = new Map();
    this.activeRunIdBySessionId = new Map();
    this.cancelledRunIds = new Set();
    this.sessionStateById = new Map();
    this.browserToolsBySessionId = new Map();
    // State tracking for enforcement
    this.lastBrowserAction = null;
    this.awaitingVerification = false;
    this.currentStepVerified = false;
    this.kimiHeaderRuleOk = false;
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
          browser:
            typeof (globalThis as any).browser !== 'undefined'
              ? navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Firefox')
                ? 'safari'
                : 'firefox'
              : 'chrome',
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
    if (offscreen?.createDocument) {
      try {
        const hasDoc = typeof offscreen.hasDocument === 'function' ? await offscreen.hasDocument() : false;
        if (hasDoc) return;
        await offscreen.createDocument({
          url: 'offscreen/offscreen.html',
          reasons: [offscreen.Reason?.DOM_PARSER || 'DOM_PARSER'],
          justification: 'Keep relay WebSocket alive for the extension relay agent in MV3.',
        });
        return;
      } catch (err) {
        console.warn('[relay] offscreen keepalive failed:', err);
      }
    }
    // Fallback for Safari / browsers without offscreen API: use alarms-based keepalive
    if (chrome.alarms && !this.alarmKeepaliveRegistered) {
      this.alarmKeepaliveRegistered = true;
      chrome.alarms.create('relay-keepalive', { periodInMinutes: 0.4 });
      chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'relay-keepalive') {
          // Waking the service worker is sufficient to keep the relay WebSocket alive
          if (!this.relay.isConnected()) {
            void this.applyRelayConfig();
          }
        }
      });
    }
  }

  private async closeRelayKeepalive() {
    const offscreen = (chrome as any).offscreen;
    if (offscreen?.closeDocument) {
      try {
        const hasDoc = typeof offscreen.hasDocument === 'function' ? await offscreen.hasDocument() : false;
        if (hasDoc) await offscreen.closeDocument();
      } catch (err) {
        // Ignore - offscreen may not exist or may already be closed.
      }
    }
    // Clear alarms-based keepalive if active
    if (chrome.alarms) {
      chrome.alarms.clear('relay-keepalive').catch(() => {});
      this.alarmKeepaliveRegistered = false;
    }
  }

  init() {
    if (chrome.sidePanel?.setPanelBehavior) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));
    } else if (chrome.sidebarAction?.open && chrome.action?.onClicked) {
      chrome.action.onClicked.addListener((tab) => {
        const options = typeof tab?.windowId === 'number' ? { windowId: tab.windowId } : undefined;
        chrome.sidebarAction.open(options).catch((error) => console.error('Failed to open sidebar:', error));
      });
    } else if (chrome.action?.onClicked) {
      // Safari: try native messaging to toggle the companion sidebar panel.
      // Falls back to a detached popup window if native messaging is unavailable.
      const hasNativeMessaging = typeof (globalThis as any).browser?.runtime?.sendNativeMessage === 'function';
      if (hasNativeMessaging) {
        chrome.action.onClicked.addListener(() => {
          (globalThis as any).browser.runtime.sendNativeMessage(
            'com.parchi.safari',
            { action: 'toggleSidebar' },
          ).catch((err: Error) => console.warn('[safari] native toggle failed:', err));
        });
      } else {
        // Popup window fallback (used during development before the Xcode app is built)
        chrome.windows.onRemoved.addListener((closedId) => {
          if (closedId === this.safariPanelWindowId) {
            this.safariPanelWindowId = null;
          }
        });
        chrome.action.onClicked.addListener(() => {
          if (this.safariPanelWindowId !== null) {
            chrome.windows.remove(this.safariPanelWindowId).catch(() => {
              this.safariPanelWindowId = null;
            });
            this.safariPanelWindowId = null;
            return;
          }
          chrome.windows.create(
            {
              url: chrome.runtime.getURL('sidepanel/panel.html'),
              type: 'popup',
              width: 420,
              height: 700,
            },
            (win) => {
              if (win?.id) {
                this.safariPanelWindowId = win.id;
              }
            },
          );
        });
      }
    }

    // Kimi API requires a coding-agent User-Agent header.
    // Chrome MV3 service workers cannot set User-Agent via fetch(),
    // so we use declarativeNetRequest to inject it at the network level.
    if (chrome.declarativeNetRequest?.updateDynamicRules) {
      chrome.declarativeNetRequest
        .updateDynamicRules({
          removeRuleIds: [9000],
          addRules: [
            {
              id: 9000,
              priority: 1,
              action: {
                type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
                requestHeaders: [
                  {
                    header: 'User-Agent',
                    operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                    value: 'coding-agent',
                  },
                ],
              },
              condition: {
                urlFilter: '||api.kimi.com',
                resourceTypes: [chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST],
              },
            },
          ],
        })
        .then(() => {
          this.kimiHeaderRuleOk = true;
        })
        .catch((e) => {
          this.kimiHeaderRuleOk = false;
          console.warn('Failed to set Kimi UA rule:', e);
        });
    } else {
      this.kimiHeaderRuleOk = false;
      console.warn('declarativeNetRequest not available; skipping Kimi UA header rule.');
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      void this.handleMessage(message, sender, sendResponse);
      return true;
    });

    // Ensure relay can come up after a browser restart without needing the UI opened first.
    chrome.runtime.onStartup?.addListener(() => {
      void this.applyRelayConfig();
    });
    chrome.runtime.onInstalled?.addListener(() => {
      void this.applyRelayConfig();
    });

    chrome.runtime.onConnect.addListener((port) => {
      if (port.name !== 'relay-keepalive') return;
      this.relayKeepalivePorts.add(port);
      port.onDisconnect.addListener(() => {
        this.relayKeepalivePorts.delete(port);
      });
      // Optional: accept pings; no response required.
      port.onMessage.addListener(() => {});
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
        const activeProfile = this.resolveProfile((settings as any), activeProfileName);
        const orchestratorEnabled = (settings as any).useOrchestrator === true;
        const teamProfiles = this.resolveTeamProfiles((settings as any));
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
          void this.processUserMessage(userMessage, message.conversationHistory, message.selectedTabs || [], sessionId);
          break;
        }

        case 'stop_run': {
          const sessionId = typeof message.sessionId === 'string' ? message.sessionId : '';
          if (sessionId) {
            this.stopRunBySession(sessionId, 'Stopped');
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
          const result = await this.generateWorkflowPrompt(
            message.sessionContext || '',
            message.maxOutputTokens,
          );
          sendResponse({ success: true, result });
          break;
        }

        case 'ping_test': {
          // Simple test to verify messaging works
          sendResponse({ success: true, pong: true, time: Date.now() });
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

      const runtimeProfileResolution = this.resolveRuntimeModelProfile(orchestratorProfile, settings);
      if (!runtimeProfileResolution.allowed) {
        this.sendRuntime(runMeta, {
          type: 'run_error',
          message: runtimeProfileResolution.errorMessage || 'Please configure your API key in settings',
        });
        return;
      }
      orchestratorProfile = runtimeProfileResolution.profile;
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
            'Kimi requires a User-Agent header. Some Chromium forks (e.g., Brave) block UA overrides, which can break requests. Try Chrome, or use a proxy that adds the header.',
        });
      }

      const visionToolsEnabled = this.isVisionModelProfile(orchestratorProfile);
      const tools = this.getToolsForSession(settings, orchestratorEnabled, teamProfiles, visionToolsEnabled);
      const streamEnabled = settings.streamResponses !== false && settings.streamResponses !== 'false';
      const showThinking = settings.showThinking !== false && settings.showThinking !== 'false';
      const enableAnthropicThinking =
        showThinking && (orchestratorProfile.provider === 'anthropic' || orchestratorProfile.provider === 'kimi');

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

      const historyInput = Array.isArray(conversationHistory) ? conversationHistory : [];
      const trimmedUserMessage = typeof userMessage === 'string' ? userMessage.trim() : '';
      const lastMessage = historyInput[historyInput.length - 1];
      const lastContentText = typeof lastMessage?.content === 'string' ? lastMessage.content : '';
      const shouldAppendUserMessage =
        trimmedUserMessage && (!lastMessage || lastMessage.role !== 'user' || lastContentText !== userMessage);
      const normalizedHistory = normalizeConversationHistory(
        shouldAppendUserMessage ? [...historyInput, { role: 'user', content: userMessage }] : historyInput,
      );
      const model = resolveLanguageModel(orchestratorProfile);

      const toolSet = buildToolSet(tools, async (toolName, args, options) =>
        this.executeToolByName(
          toolName,
          args,
          {
            runMeta,
            settings,
            visionProfile,
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
          system: this.enhanceSystemPrompt(orchestratorProfile.systemPrompt || '', context, sessionState),
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
            const streamClassified = classifyApiError(new Error(textStreamError));
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

      while (true) {
        if (abortSignal.aborted) return;
        const passResult = await runModelPass(currentHistory);
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
              system: this.enhanceSystemPrompt(orchestratorProfile.systemPrompt || '', context, sessionState),
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
      const classified = classifyApiError(error);
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
      const runtimeProfile = this.resolveRuntimeModelProfile(
        {
          provider: settings.provider || 'openai',
          apiKey: settings.apiKey || '',
          model: settings.model || '',
          customEndpoint: settings.customEndpoint,
          extraHeaders: settings.extraHeaders,
        },
        settings as Record<string, any>,
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
      const settings = this.currentSettings || await chrome.storage.local.get(PARCHI_STORAGE_KEYS as unknown as string[]);
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

    if (toolName === 'subagent_complete') {
      const result = { success: true, ack: true, details: args || {} };
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
    const browserActions = ['navigate', 'click', 'type', 'scroll', 'pressKey'];
    if (browserActions.includes(toolName) && finalResult?.success !== false) {
      sessionState.lastBrowserAction = toolName;
      sessionState.awaitingVerification = true;
      sessionState.currentStepVerified = false;
    } else if (toolName === 'getContent') {
      sessionState.awaitingVerification = false;
      sessionState.currentStepVerified = true;
    }

    if (
      toolName === 'screenshot' &&
      finalResult?.success &&
      finalResult.dataUrl &&
      options.settings?.visionBridge &&
      options.visionProfile?.apiKey
    ) {
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
        if (!options.settings?.sendScreenshotsAsImages) {
          delete finalResult.dataUrl;
        }
      } catch (visionError) {
        finalResult.visionError = visionError.message;
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

  getToolPermissionCategory(toolName) {
    const mapping = {
      navigate: 'navigate',
      openTab: 'navigate',
      click: 'interact',
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
    if (runId) this.stopRun(runId, note);
  }

  private getSessionState(sessionId: string): SessionState {
    const id = typeof sessionId === 'string' && sessionId.trim() ? sessionId : 'default';
    const existing = this.sessionStateById.get(id);
    if (existing) return existing;
    const created: SessionState = {
      sessionId: id,
      currentPlan: null,
      subAgentCount: 0,
      subAgentProfileCursor: 0,
      lastBrowserAction: null,
      awaitingVerification: false,
      currentStepVerified: false,
      kimiWarningSent: false,
    };
    this.sessionStateById.set(id, created);
    return created;
  }

  private getBrowserTools(sessionId: string): BrowserTools {
    const id = typeof sessionId === 'string' && sessionId.trim() ? sessionId : 'default';
    const existing = this.browserToolsBySessionId.get(id);
    if (existing) return existing;
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

  enhanceSystemPrompt(basePrompt: string, context, sessionState: SessionState) {
    const tabsSection =
      Array.isArray(context.availableTabs) && context.availableTabs.length
        ? `Tabs selected (${context.availableTabs.length}). You MUST only act on these tabs (session tabs). Always pass tabId from this list to navigate/click/type/pressKey/scroll/getContent/screenshot.\n${context.availableTabs
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
        ? '<orchestrator_tools>Orchestrator tools enabled: spawn_subagent, subagent_complete. Use spawn_subagent for focused parallel work, and have each sub-agent report via subagent_complete.</orchestrator_tools>'
        : '<orchestrator_tools>Orchestrator mode is enabled.</orchestrator_tools>'
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

You CANNOT call navigate, click, type, scroll, or pressKey until you call set_plan.
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

  return `${basePrompt}
 ${stateSection}${thinkingSection}
${toolCatalogSection}
${visionToolSection}
${orchestratorToolSection}

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

  hasActivePaidSubscription(settings: Record<string, any> = {}) {
    const mode = String(settings.accountModeChoice || '').toLowerCase();
    const status = String(settings.convexSubscriptionStatus || '').toLowerCase();
    const plan = String(settings.convexSubscriptionPlan || '').toLowerCase();
    return mode === 'paid' && plan === 'pro' && status === 'active';
  }

  canUseConvexProxy(settings: Record<string, any> = {}) {
    return Boolean(String(settings.convexUrl || '').trim() && String(settings.convexAccessToken || '').trim());
  }

  applyConvexProxyProfile(profile: Record<string, any>, settings: Record<string, any>) {
    const preferredProvider =
      profile?.provider === 'kimi' ? 'kimi' : profile?.provider === 'anthropic' ? 'anthropic' : 'openai';
    return {
      provider: preferredProvider,
      apiKey: profile?.apiKey || '',
      model: profile?.model || settings.model || 'gpt-4o',
      customEndpoint: profile?.customEndpoint || '',
      extraHeaders: profile?.extraHeaders || {},
      useProxy: true,
      proxyBaseUrl: String(settings.convexUrl || '').trim(),
      proxyAuthToken: String(settings.convexAccessToken || '').trim(),
      proxyProvider: preferredProvider,
    };
  }

  resolveRuntimeModelProfile(profile: Record<string, any>, settings: Record<string, any>) {
    if (this.hasOwnApiKey(profile)) {
      return { allowed: true, route: 'byok', profile };
    }
    if (!this.hasActivePaidSubscription(settings)) {
      return {
        allowed: false,
        route: 'none',
        profile,
        errorMessage: 'Add an API key in settings or subscribe to the paid plan.',
      };
    }
    if (!this.canUseConvexProxy(settings)) {
      return {
        allowed: false,
        route: 'none',
        profile,
        errorMessage: 'Paid plan is active but auth is missing. Sign in again in Account & Billing.',
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
    if (sessionState.subAgentCount >= 10) {
      return {
        success: false,
        error: 'Sub-agent limit reached for this session (max 10).',
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

    const subagentName = args.name || `Sub-Agent ${sessionState.subAgentCount}`;
    this.sendRuntime(runMeta, {
      type: 'subagent_start',
      id: subagentId,
      name: subagentName,
      tasks: args.tasks || [args.goal || args.task || 'Task'],
    });

    try {
      const subAgentSystemPrompt = `${args.prompt || 'You are a focused sub-agent working under an orchestrator. Be concise and tool-driven.'}
Always cite evidence from tools. Finish by calling subagent_complete with a short summary and any structured findings.`;

      const tools = this.getToolsForSession(profileSettings, false, [], this.isVisionModelProfile(profileSettings));
      const toolSet = buildToolSet(tools, async (toolName, toolArgs, options) =>
        this.executeToolByName(
          toolName,
          toolArgs,
          {
            runMeta,
            settings: settings || {},
            visionProfile: null,
          },
          options.toolCallId,
        ),
      );

      const taskLines = Array.isArray(args.tasks)
        ? args.tasks.map((t, idx) => `${idx + 1}. ${t}`).join('\n')
        : args.goal || args.task || args.prompt || '';

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

      // Safely get text with error handling for "No output generated" errors
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

      this.sendRuntime(runMeta, {
        type: 'subagent_complete',
        id: subagentId,
        success: true,
        summary,
      });

      return {
        success: true,
        source: 'subagent',
        id: subagentId,
        name: subagentName,
        summary,
        tasks: taskLines,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error ?? 'Unknown error');
      console.error('[subagent] Error:', error);

      this.sendRuntime(runMeta, {
        type: 'subagent_complete',
        id: subagentId,
        success: false,
        summary: `Sub-agent failed: ${errorMessage}`,
      });

      return {
        success: false,
        source: 'subagent',
        id: subagentId,
        name: subagentName,
        error: errorMessage,
        summary: `Sub-agent failed: ${errorMessage}`,
      };
    }
  }
}

// Instantiated by packages/extension/background.ts entrypoint.
