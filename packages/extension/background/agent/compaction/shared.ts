import type { Usage } from '@parchi/shared';
import type { Message } from '../../../ai/messages/schema.js';
import { isCodexOAuthProvider } from '../../../ai/sdk/index.js';
import type { ServiceContext } from '../../service-context.js';
import type { RunMeta, SessionState } from '../../service-types.js';

export type RunContextCompactionOptions = {
  runMeta: RunMeta;
  history: Message[];
  contextLimit: number;
  orchestratorProfile: Record<string, unknown>;
  model: unknown;
  abortSignal?: AbortSignal;
  force?: boolean;
  source?: string;
  statusPrefix?: string;
};

export type CompactionCheckSnapshot = {
  shouldCompact: boolean;
  percent: number;
  approxTokens: number;
};

export type CompactionSummaryResult = {
  summaryText: string;
  summaryUsage: Usage;
  summaryGenerationMs: number;
  hasThinking: boolean;
};

export type PreparedCompactionSlice = {
  previousSummary?: string;
  messagesToSummarize: Message[];
  preserved: Message[];
  promptText: string;
};

export type CompactionExecutionContext = {
  ctx: ServiceContext;
  sessionState: SessionState;
  options: RunContextCompactionOptions;
  source: string;
};

export const profileUsesCodexOAuth = (profile: Record<string, unknown> | null | undefined) =>
  isCodexOAuthProvider(String(profile?.provider || ''));
