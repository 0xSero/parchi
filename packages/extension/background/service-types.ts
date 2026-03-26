import type {
  OrchestratorPlan,
  WhiteboardEntry as OrchestratorWhiteboardEntry,
  RunPlan,
  TokenTraceSnapshot,
} from '@parchi/shared';

export type RunMeta = {
  runId: string;
  turnId: string;
  sessionId: string;
};

export type ReportImage = {
  id: string;
  dataUrl: string;
  byteSize: number;
  capturedAt: number;
  toolCallId?: string;
  tabId?: number;
  url?: string;
  title?: string;
  visionDescription?: string;
};

/**
 * Token visibility state for a session.
 * Uses the shared TokenTraceSnapshot shape with all fields required.
 */
export type SessionTokenVisibility = Required<TokenTraceSnapshot>;

export type RunningSubagent = {
  id: string;
  name: string;
  tabId: number;
  agentSessionId: string;
  colorIndex: number;
  status: 'running' | 'completed' | 'error';
  parentRunMeta: RunMeta;
  pendingInstructions: string[];
  taskId?: string;
  startedAt: number;
  promise: Promise<SubagentResult>;
  resolve: (result: SubagentResult) => void;
};

export type SubagentResult = {
  id: string;
  name: string;
  success: boolean;
  summary: string;
  tabId: number;
  taskId?: string;
  data?: unknown;
};

export type HistoricalSubagent = {
  id: string;
  name: string;
  tabId: number;
  agentSessionId: string;
  colorIndex: number;
  taskId?: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  success?: boolean;
  summary?: string;
  data?: unknown;
  startedAt: number;
  finishedAt?: number;
};

export type SessionAttachment = {
  name: string;
  size: number;
  mimeType: string;
  type: string;
  textContent?: string;
  base64Content?: string;
};

export type SessionState = {
  sessionId: string;
  currentPlan: RunPlan | null;
  orchestratorPlan: OrchestratorPlan | null;
  subAgentCount: number;
  subAgentProfileCursor: number;
  lastBrowserAction: string | null;
  awaitingVerification: boolean;
  currentStepVerified: boolean;
  kimiWarningSent: boolean;
  failureTracker: Map<string, { count: number; lastError: string }>;
  reportImages: ReportImage[];
  reportImageBytes: number;
  selectedReportImageIds: Set<string>;
  tokenVisibility: SessionTokenVisibility;
  runningSubagents: Map<string, RunningSubagent>;
  subagentHistory: Map<string, HistoricalSubagent>;
  orchestratorWhiteboard: Map<string, OrchestratorWhiteboardEntry>;
  attachments: SessionAttachment[];
};
