import type { RunPlan } from '@parchi/shared';
import type { RecordingCoordinator } from '../recording/recording-coordinator.js';
import type { BrowserTools } from '../tools/browser-tools.js';
import type { RunMeta, SessionState, SessionTokenVisibility } from './service-types.js';
import type { SubagentTabBadgeState } from './subagent-tab-badges.js';

export type ActiveRun = {
  runMeta: RunMeta;
  origin: 'sidepanel';
  controller: AbortController;
};

export type TokenTracePayload = {
  action: string;
  reason: string;
  note?: string;
  before?: SessionTokenVisibility;
  afterPatch?: Partial<SessionTokenVisibility>;
  details?: Record<string, unknown>;
};

export type ServiceContext = {
  // Shared state
  browserTools: BrowserTools;
  currentSettings: Record<string, any> | null;
  currentSessionId: string | null;
  currentPlan: RunPlan | null;
  subAgentCount: number;
  subAgentProfileCursor: number;
  activeRuns: Map<string, ActiveRun>;
  activeRunIdBySessionId: Map<string, string>;
  cancelledRunIds: Set<string>;
  sidepanelLifecyclePorts: Set<chrome.runtime.Port>;
  recordingCoordinator: RecordingCoordinator;
  subagentTabBadges: Map<number, SubagentTabBadgeState>;

  // Kimi header state
  kimiHeaderRuleOk: boolean;
  kimiHeaderMode: 'dnr' | 'webRequest' | 'none';

  // Shared methods
  sendRuntime(runMeta: RunMeta, payload: Record<string, unknown>): void;
  sendToSidePanel(message: unknown): void;
  getSessionState(sessionId: string): SessionState;
  getBrowserTools(sessionId: string): BrowserTools;
  hasBrowserTools(sessionId: string): boolean;
  releaseSessionResources(sessionId: string): void;
  setSubagentTabBadge(tabId: number, state: SubagentTabBadgeState): void;
  syncSubagentTabBadge(tabId: number): void;
  emitTokenTrace(runMeta: RunMeta, sessionState: SessionState, payload: TokenTracePayload): void;
  isRunCancelled(runId: string): boolean;
  registerActiveRun(runMeta: RunMeta, origin: 'sidepanel'): AbortController;
  cleanupRun(runMeta: RunMeta, origin: 'sidepanel'): void;
  stopRunBySession(sessionId: string, note?: string): boolean;
  stopAllSidepanelRuns(note?: string): void;

  // Delegated methods (implemented in extracted modules, wired by service)
  processUserMessage(
    userMessage: string,
    conversationHistory: any[],
    selectedTabs: chrome.tabs.Tab[],
    sessionId: string,
    meta?: Partial<RunMeta> & { origin?: 'sidepanel' },
    recordedContext?: any,
  ): Promise<void>;

  processContextCompaction(
    conversationHistory: any[],
    sessionId: string,
    options?: { source?: string; force?: boolean },
  ): Promise<void>;

  executeToolByName(
    toolName: string,
    args: Record<string, any>,
    options: {
      runMeta: RunMeta;
      settings: Record<string, any>;
      visionProfile?: Record<string, any> | null;
    },
    toolCallId?: string,
  ): Promise<any>;

  getToolsForSession(
    settings: Record<string, any>,
    includeOrchestrator?: boolean,
    teamProfiles?: Array<{ name: string }>,
    includeVisionTools?: boolean,
  ): any[];

  runApiSmokeTest(settings: Record<string, any>, prompt: string): Promise<any>;
  generateWorkflowPrompt(sessionContext: string, maxOutputTokens?: number): Promise<{ prompt: string; error?: string }>;
};
