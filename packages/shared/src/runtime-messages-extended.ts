/**
 * Extended runtime message types (context, subagents, reporting).
 */
import type { RuntimeMessageBase } from './runtime-messages-base.js';
import type {
  ContextUsageSnapshot,
  RuntimeBenchmarkContext,
  RuntimeLatencyMetrics,
  TokenTraceSnapshot,
  TokenUsage,
} from './runtime-types.js';

export type AssistantFinal = RuntimeMessageBase & {
  type: 'assistant_final';
  content: string;
  thinking?: string | null;
  model?: string;
  usage?: TokenUsage;
  contextUsage?: ContextUsageSnapshot;
  responseMessages?: Array<Record<string, unknown>>;
  latency?: RuntimeLatencyMetrics;
  benchmark?: RuntimeBenchmarkContext;
};

export type RunError = RuntimeMessageBase & {
  type: 'run_error';
  message: string;
  stage?: string;
  errorCategory?: string;
  action?: string;
  recoverable?: boolean;
  latency?: RuntimeLatencyMetrics;
  benchmark?: RuntimeBenchmarkContext;
};

export type RunWarning = RuntimeMessageBase & {
  type: 'run_warning';
  message: string;
  stage?: string;
};

export type TokenTraceEvent = RuntimeMessageBase & {
  type: 'token_trace';
  action: string;
  reason: string;
  note?: string;
  before?: TokenTraceSnapshot;
  after?: TokenTraceSnapshot;
  details?: Record<string, unknown>;
};

export type CompactionEvent = RuntimeMessageBase & {
  type: 'compaction_event';
  stage: 'decision' | 'start' | 'summary_request' | 'summary_result' | 'applied' | 'skipped' | 'failed' | string;
  source?: string;
  note?: string;
  details?: Record<string, unknown>;
};

export type ContextCompacted = RuntimeMessageBase & {
  type: 'context_compacted';
  source?: string;
  startFreshSession?: boolean;
  summary: string;
  trimmedCount: number;
  preservedCount: number;
  newSessionId: string;
  contextMessages: Array<Record<string, unknown>>;
  beforeContextUsage?: ContextUsageSnapshot;
  contextUsage?: ContextUsageSnapshot;
  compactionMetrics?: Record<string, unknown>;
};

export type SubagentStart = RuntimeMessageBase & {
  type: 'subagent_start';
  id: string;
  name: string;
  tasks?: string[];
  agentSessionId: string;
  parentRunId?: string;
};

export type SubagentComplete = RuntimeMessageBase & {
  type: 'subagent_complete';
  id: string;
  success: boolean;
  summary?: string;
  agentSessionId: string;
  parentRunId?: string;
};

export type SubagentTabAssigned = RuntimeMessageBase & {
  type: 'subagent_tab_assigned';
  id: string;
  name: string;
  tabId: number;
  url: string;
  agentSessionId: string;
  colorIndex: number;
};

export type SessionTabsUpdate = RuntimeMessageBase & {
  type: 'session_tabs_update';
  tabs: Array<{
    id: number;
    title?: string;
    url?: string;
  }>;
  activeTabId: number | null;
  maxTabs: number;
  groupTitle?: string;
};

export type ReportImageSummary = {
  id: string;
  capturedAt: number;
  url?: string;
  title?: string;
  tabId?: number;
  visionDescription?: string;
  selected: boolean;
};

export type ReportImageCaptured = RuntimeMessageBase & {
  type: 'report_image_captured';
  image: {
    id: string;
    dataUrl: string;
    capturedAt: number;
    toolCallId?: string;
    tabId?: number;
    url?: string;
    title?: string;
    visionDescription?: string;
    selected: boolean;
  };
  images: ReportImageSummary[];
  selectedImageIds: string[];
};

export type ReportImagesSelection = RuntimeMessageBase & {
  type: 'report_images_selection';
  images: ReportImageSummary[];
  selectedImageIds: string[];
};
