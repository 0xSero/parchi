export type SubagentLoopContext = {
  subagentId: string;
  subagentName: string;
  subagentSessionId: string;
  taskList: string[];
  tabId: number;
  taskId?: string;
};
