import fs from 'node:fs';
import path from 'node:path';
import type { OrchestratorPlan, WhiteboardEntry as OrchestratorWhiteboardEntry } from '@parchi/shared';
import type { ServiceContext } from '../../packages/extension/background/service-context.js';
import type {
  HistoricalSubagent,
  RunMeta,
  SessionState,
  SubagentResult,
} from '../../packages/extension/background/service-types.js';
import { getSessionState as getManagedSessionState } from '../../packages/extension/background/session-manager.js';
import { executeBuiltinTool } from '../../packages/extension/background/tools/tool-executor/builtins.js';
import { recordSubagentStart } from '../../packages/extension/background/tools/tool-executor/orchestrator.js';

export type OrchestratorServiceScenario = {
  id: string;
  passed: boolean;
  details: Record<string, unknown>;
};

export type OrchestratorServiceIntegrationArtifact = {
  generatedAt: string;
  runtimeEventCount: number;
  scenarios: OrchestratorServiceScenario[];
};

type BuiltinBaseResult = { success: boolean; error?: string };
type RunningSubagentSummary = HistoricalSubagent;
type WhiteboardSnapshot = Record<string, OrchestratorWhiteboardEntry>;
type OrchestratorPlanSummary = {
  plan: OrchestratorPlan;
  validationIssues: string[];
  readyTaskIds: string[];
  taskCounts: {
    total: number;
    pending: number;
    ready: number;
    running: number;
    blocked: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
};

type SetOrchestratorPlanResult = BuiltinBaseResult & OrchestratorPlanSummary;
type DispatchOrchestratorTasksResult = BuiltinBaseResult & {
  dispatched: Array<Record<string, unknown>>;
  validationIssues?: string[];
};
type ListSubagentsResult = BuiltinBaseResult & {
  running: RunningSubagentSummary[];
  history: HistoricalSubagent[];
};
type AwaitSubagentExtras = {
  planSummary?: OrchestratorPlanSummary;
  whiteboard?: WhiteboardSnapshot;
  taskValidationFailures?: string[];
};
type AwaitSubagentResult =
  | ({ success: true; agents: SubagentResult[]; note?: string } & AwaitSubagentExtras)
  | ({
      success: false;
      error: string;
      pendingAgents?: Array<{ id: string; name: string; tabId: number }>;
    } & AwaitSubagentExtras);
type GetOrchestratorPlanResult = BuiltinBaseResult &
  OrchestratorPlanSummary & {
    whiteboard: WhiteboardSnapshot;
    subagents: {
      running: RunningSubagentSummary[];
      history: HistoricalSubagent[];
    };
  };

type StubBrowserTools = Pick<ServiceContext['browserTools'], 'resolveSessionWindowId'>;
type StubRelay = Pick<ServiceContext['relay'], 'isConnected' | 'notify'>;
type StubRecordingCoordinator = Record<string, never>;

export type HarnessContext = ServiceContext & {
  runtimeEvents: Array<Record<string, unknown>>;
  sessionStates: Map<string, SessionState>;
};

const repoRoot = path.resolve(process.cwd());

export const defaultRunMeta: RunMeta = {
  runId: 'orchestrator-service-harness',
  turnId: 'turn-orchestrator-service-harness',
  sessionId: 'session-orchestrator-service-harness',
};

export function createHarnessContext(): HarnessContext {
  const sessionStates = new Map<string, SessionState>();
  const runtimeEvents: Array<Record<string, unknown>> = [];
  const ctx: Record<string, unknown> = {
    browserTools: {} as StubBrowserTools,
    currentSettings: null,
    currentSessionId: null,
    currentPlan: null,
    subAgentCount: 0,
    subAgentProfileCursor: 0,
    relay: { isConnected: () => false, notify: () => {} } as StubRelay,
    relayActiveRunIds: new Set<string>(),
    activeRuns: new Map(),
    activeRunIdBySessionId: new Map(),
    cancelledRunIds: new Set<string>(),
    sidepanelLifecyclePorts: new Set(),
    recordingCoordinator: {} as StubRecordingCoordinator,
    subagentTabBadges: new Map(),
    kimiHeaderRuleOk: false,
    kimiHeaderMode: 'none' as const,
    _relayStatusTimer: undefined,
    _relayAutoPairTimer: undefined,
    runtimeEvents,
    sessionStates,
    sendRuntime(_runMeta: RunMeta, payload: Record<string, unknown>) {
      runtimeEvents.push(payload);
    },
    sendToSidePanel(message: unknown) {
      runtimeEvents.push({ type: 'sidepanel_message', message });
    },
    getSessionState(sessionId: string) {
      return getManagedSessionState(sessionStates, sessionId);
    },
    getBrowserTools() {
      return { resolveSessionWindowId: async () => 1 } as StubBrowserTools;
    },
    releaseSessionResources() {},
    setSubagentTabBadge() {},
    syncSubagentTabBadge() {},
    emitTokenTrace() {},
    isRunCancelled() {
      return false;
    },
    registerActiveRun() {
      return new AbortController();
    },
    cleanupRun() {},
    stopRunBySession() {
      return false;
    },
    stopAllSidepanelRuns() {},
    async processUserMessage() {
      throw new Error('Not implemented in orchestrator service harness.');
    },
    async processContextCompaction() {
      throw new Error('Not implemented in orchestrator service harness.');
    },
    async executeToolByName() {
      throw new Error('Not implemented in orchestrator service harness.');
    },
    getToolsForSession() {
      return [];
    },
    async runApiSmokeTest() {
      throw new Error('Not implemented in orchestrator service harness.');
    },
    async generateWorkflowPrompt() {
      throw new Error('Not implemented in orchestrator service harness.');
    },
  };
  return ctx as HarnessContext;
}

export const loadFixture = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(repoRoot, 'tests', 'fixtures', 'orchestrator', name), 'utf8')) as Record<
    string,
    unknown
  >;

export async function callBuiltin(
  ctx: HarnessContext,
  toolName: string,
  args: Record<string, unknown>,
  nestedToolExecutor: Parameters<typeof executeBuiltinTool>[4] = async () => ({
    success: false,
    error: 'Nested tool execution not configured.',
  }),
) {
  const result = await executeBuiltinTool(
    ctx,
    toolName,
    args,
    { runMeta: defaultRunMeta, settings: {} },
    nestedToolExecutor,
  );
  if (!result.handled) throw new Error(`Builtin ${toolName} was not handled.`);
  return result.result as Record<string, unknown>;
}

export async function callSetOrchestratorPlan(
  ctx: HarnessContext,
  args: Record<string, unknown>,
): Promise<SetOrchestratorPlanResult> {
  return (await callBuiltin(ctx, 'set_orchestrator_plan', args)) as SetOrchestratorPlanResult;
}

export async function callDispatchOrchestratorTasks(
  ctx: HarnessContext,
  args: Record<string, unknown>,
  nestedToolExecutor: Parameters<typeof executeBuiltinTool>[4],
): Promise<DispatchOrchestratorTasksResult> {
  return (await callBuiltin(
    ctx,
    'dispatch_orchestrator_tasks',
    args,
    nestedToolExecutor,
  )) as DispatchOrchestratorTasksResult;
}

export async function callListSubagents(ctx: HarnessContext): Promise<ListSubagentsResult> {
  return (await callBuiltin(ctx, 'list_subagents', {})) as ListSubagentsResult;
}

export async function callAwaitSubagent(
  ctx: HarnessContext,
  args: Record<string, unknown> = {},
): Promise<AwaitSubagentResult> {
  return (await callBuiltin(ctx, 'await_subagent', args)) as AwaitSubagentResult;
}

export async function callAwaitAgents(
  ctx: HarnessContext,
  args: Record<string, unknown> = {},
): Promise<AwaitSubagentResult> {
  return (await callBuiltin(ctx, 'await_agents', args)) as AwaitSubagentResult;
}

export async function callGetOrchestratorPlan(ctx: HarnessContext): Promise<GetOrchestratorPlanResult> {
  return (await callBuiltin(ctx, 'get_orchestrator_plan', {})) as GetOrchestratorPlanResult;
}

export function createNestedSpawnStub(ctx: HarnessContext) {
  let counter = 0;
  return async (toolName: string, args: Record<string, unknown>) => {
    if (toolName !== 'spawn_subagent') return { success: false, error: `Unexpected nested tool ${toolName}` };

    const sessionState = ctx.getSessionState(defaultRunMeta.sessionId);
    const taskId = String(args.orchestratorTaskId || '').trim();
    const task = sessionState.orchestratorPlan?.tasks.find((entry) => entry.id === taskId) || null;
    if (!task) return { success: false, error: `Task ${taskId} not found` };

    counter += 1;
    const subagentId = `test-subagent-${counter}`;
    const tabId = 100 + counter;
    const name = typeof args.name === 'string' && args.name.trim() ? args.name.trim() : task.title;
    const result: SubagentResult = {
      id: subagentId,
      name,
      success: true,
      summary: `Completed ${task.id}`,
      tabId,
      taskId: task.id,
      data: Object.fromEntries(task.outputs.map((output) => [output.key, `${task.id}:${output.key}`])),
    };

    sessionState.runningSubagents.set(subagentId, {
      id: subagentId,
      name,
      tabId,
      agentSessionId: `${defaultRunMeta.sessionId}::${subagentId}`,
      colorIndex: counter % 6,
      status: 'running',
      parentRunMeta: defaultRunMeta,
      pendingInstructions: [],
      taskId: task.id,
      startedAt: Date.now(),
      promise: Promise.resolve(result),
      resolve: () => {},
    });
    recordSubagentStart(sessionState, {
      id: subagentId,
      name,
      tabId,
      agentSessionId: `${defaultRunMeta.sessionId}::${subagentId}`,
      colorIndex: counter % 6,
      taskId: task.id,
      startedAt: Date.now(),
    });

    return { success: true, source: 'subagent', id: subagentId, name, tabId, status: 'started' };
  };
}

export const getHistory = (sessionState: SessionState): HistoricalSubagent[] =>
  Array.from(sessionState.subagentHistory.values()).sort((a, b) => a.startedAt - b.startedAt);
