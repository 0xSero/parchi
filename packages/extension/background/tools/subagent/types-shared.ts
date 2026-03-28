import type { RuntimeMessageBase } from '@parchi/shared';
import type { RunMeta } from '../../service-types.js';

export type ToolExecutionArgs = Record<string, unknown>;
export type ToolExecutionSettings = Record<string, unknown>;
export type ToolExecutionProfile = Record<string, unknown> | null | undefined;

export type ToolExecutionOptions = {
  runMeta: RunMeta;
  settings: ToolExecutionSettings;
  visionProfile?: ToolExecutionProfile;
  runtimeMeta?: Pick<RuntimeMessageBase, 'agentId' | 'agentName' | 'agentKind' | 'agentSessionId' | 'parentSessionId'>;
};

export type NestedToolExecutor = (
  toolName: string,
  args: ToolExecutionArgs,
  options: ToolExecutionOptions,
  toolCallId?: string,
) => Promise<unknown>;

export type SubagentLoopContext = {
  subagentId: string;
  subagentName: string;
  subagentSessionId: string;
  taskList: string[];
  tabId: number;
  taskId?: string;
};
