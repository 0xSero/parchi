export type { UsagePayload, Usage as UsageStats } from '@parchi/shared';

export interface SubagentEntry {
  name: string;
  status: string;
  sessionId: string;
  parentSessionId: string;
  messages: Array<{ ts: number; text: string }>;
  pendingText: string;
  pendingReasoning: string;
  tasks?: string[];
  startedAt?: number;
  completedAt?: number;
  summary?: string;
  tabId?: number;
  colorIndex?: number;
  _toolCount?: number;
}
