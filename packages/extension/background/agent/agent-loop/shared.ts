import type { Message } from '../../../ai/messages/schema.js';
import type { SDKModelSettings } from '../../../ai/sdk/index.js';
import type { OAuthProviderKey } from '../../../oauth/types.js';
import type { ServiceContext } from '../../service-context.js';
import type { RunMeta, SessionState } from '../../service-types.js';

export type AgentErrorContext = {
  route?: string;
  provider?: string;
  proxyProvider?: string;
  model?: string;
  useProxy?: boolean;
};

export type AgentLoopDiagnostics = {
  runStartedAt: number;
  streamResponsesEnabled: boolean;
  firstChunkAt: number | null;
  firstTextTokenAt: number | null;
  modelAttempts: number;
  benchmarkRoute: string;
  benchmarkProvider: string;
  benchmarkModel: string;
  latestErrorContext: AgentErrorContext;
};

export type AgentLoopUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export type MatchedSkill = {
  name: string;
  description: string;
  steps: string;
};

export type AgentLoopContext = {
  currentUrl: string;
  currentTitle: string;
  tabId: number | null;
  availableTabs: Array<{ id: number; title?: string; url?: string }>;
  orchestratorEnabled: boolean;
  teamProfiles: Array<{ name: string; provider?: string; model?: string }>;
  provider: string;
  model: string;
  toolCatalog: Array<{ name: string; description: string }>;
  showThinking: boolean;
};

export type RecordedContext =
  | {
      summary?: string;
      selectedImages?: Array<{ dataUrl: string }>;
    }
  | null
  | undefined;

export type AgentSettings = Record<string, unknown> & {
  model?: string;
  provider?: string;
  contextLimit?: number;
  convexAccessToken?: string;
  activeConfig?: string;
  configs?: Record<string, unknown>;
};

export type AgentProfile = SDKModelSettings & {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  contextLimit?: number;
  provider: string;
  apiKey: string;
  model: string;
  proxyProvider?: 'openai' | 'anthropic' | 'kimi' | 'openrouter';
};

export type PreparedAgentLoopRun = {
  ctx: ServiceContext;
  runMeta: RunMeta;
  abortSignal: AbortSignal;
  settings: AgentSettings;
  sessionState: SessionState;
  browserTools: ReturnType<ServiceContext['getBrowserTools']>;
  activeProfile: Record<string, unknown>;
  orchestratorProfile: AgentProfile;
  visionProfile: AgentProfile | null;
  runtimeProfileResolution: {
    allowed: boolean;
    route: string;
    profile: AgentProfile;
    errorMessage?: string;
  };
  streamEnabled: boolean;
  showThinking: boolean;
  enableAnthropicThinking: boolean;
  context: AgentLoopContext;
  matchedSkillsResult: MatchedSkill[];
  currentHistory: Message[];
  recordedImages: Array<{ dataUrl: string }>;
  activeModelId: string;
  model: ReturnType<typeof import('../../../ai/sdk/index.js').resolveLanguageModel>;
  modelRetryOrder: string[];
  oauthProviderKey: OAuthProviderKey | null;
  oauthFallbackCandidatesLoaded: boolean;
  requestedModelFamily: string;
  enforceSameFamilyOAuthFallback: boolean;
  openRouterLikeProvider: boolean;
  toolSet: ReturnType<typeof import('../../../ai/sdk/index.js').buildToolSet>;
  switchActiveModel: (nextModelId: string) => boolean;
  persistRecoveredModelSelection: (nextModelId: string) => Promise<void>;
  captureErrorClassificationContext: () => AgentErrorContext;
};

export type PreparedAgentLoopBlocked = {
  blocked: true;
  message: string;
};

export type AgentModelPassResult = {
  text: string;
  reasoningText: string | null;
  totalUsage: AgentLoopUsage;
  toolResults: Array<Record<string, unknown>>;
};

export type AgentResponseResult = {
  finalText: string;
  reasoningText: string | null;
  totalUsage: AgentLoopUsage;
  responseMessages: Message[];
  currentHistory: Message[];
};
