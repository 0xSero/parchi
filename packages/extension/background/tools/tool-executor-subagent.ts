import { resolveProfile } from '../model-profiles.js';
import type { ServiceContext } from '../service-context.js';
import type { RunMeta, SubagentResult } from '../service-types.js';
import { recordSubagentCompletion, recordSubagentStart } from './tool-executor-orchestrator.js';
import type {
  NestedToolExecutor,
  ToolExecutionArgs,
  ToolExecutionOptions,
  ToolExecutionSettings,
} from './tool-executor-shared.js';
import { runSubagentLoop } from './tool-executor-subagent-runner.js';
import { cleanupSubagentTab, createSubagentTab } from './tool-executor-subagent-tab.js';

const getTaskList = (args: ToolExecutionArgs) => {
  if (Array.isArray(args.tasks)) {
    const tasks = args.tasks.map((task) => String(task || '').trim()).filter(Boolean);
    if (tasks.length) return tasks;
  }
  const fallback = [args.goal, args.task, args.prompt]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean);
  return [fallback || 'Task'];
};

/**
 * Spawn a subagent with its own Chrome tab and isolated BrowserTools.
 * Returns immediately (non-blocking). The agent runs in the background
 * and the result promise is tracked in sessionState.runningSubagents.
 */
export async function handleSpawnSubagent(
  ctx: ServiceContext,
  runMeta: RunMeta,
  args: ToolExecutionArgs,
  settings: ToolExecutionSettings,
  executeTool: NestedToolExecutor,
) {
  const sessionState = ctx.getSessionState(runMeta.sessionId);
  if (sessionState.subAgentCount >= 10) {
    return { success: false, error: 'Sub-agent limit reached for this session (max 10).' };
  }

  const nextSubagentCount = sessionState.subAgentCount + 1;
  const subagentId = `subagent-${Date.now()}-${nextSubagentCount}`;
  const subagentSessionId = `${runMeta.sessionId}::${subagentId}`;

  const profileName = resolveProfileName(args, settings, sessionState);
  const profileSettings = resolveProfile(settings, profileName);
  const subagentName =
    typeof args.name === 'string' && args.name.trim() ? args.name.trim() : `Sub-Agent ${nextSubagentCount}`;
  const taskList = getTaskList(args);
  const requestedUrl = typeof args.url === 'string' ? args.url : undefined;
  const orchestratorTaskId =
    typeof args.orchestratorTaskId === 'string' && args.orchestratorTaskId.trim()
      ? args.orchestratorTaskId.trim()
      : undefined;

  // Create dedicated Chrome tab + isolated BrowserTools
  const subTab = await createSubagentTab(ctx, runMeta, subagentSessionId, nextSubagentCount, requestedUrl);
  sessionState.subAgentCount = nextSubagentCount;

  const runtimeMeta: NonNullable<ToolExecutionOptions['runtimeMeta']> = {
    agentId: subagentId,
    agentName: subagentName,
    agentKind: 'subagent',
    agentSessionId: subagentSessionId,
    parentSessionId: runMeta.sessionId,
  };

  ctx.setSubagentTabBadge(subTab.tabId, {
    agentId: subagentId,
    name: subagentName,
    colorIndex: subTab.colorIndex,
    status: 'running',
  });

  // Notify sidepanel about the new tab assignment
  ctx.sendRuntime(runMeta, {
    type: 'subagent_tab_assigned',
    id: subagentId,
    name: subagentName,
    tabId: subTab.tabId,
    url: subTab.url,
    agentSessionId: subagentSessionId,
    colorIndex: subTab.colorIndex,
    ...runtimeMeta,
  });
  ctx.sendRuntime(runMeta, {
    type: 'subagent_start',
    id: subagentId,
    name: subagentName,
    tasks: taskList,
    agentSessionId: subagentSessionId,
    ...runtimeMeta,
  });

  // Subagent-scoped RunMeta routes tool calls through the agent's own BrowserTools
  const subRunMeta: RunMeta = { ...runMeta, sessionId: subagentSessionId };

  // Track the running agent with a resolvable promise
  let resolvePromise!: (result: SubagentResult) => void;
  const promise = new Promise<SubagentResult>((resolve) => {
    resolvePromise = resolve;
  });
  sessionState.runningSubagents.set(subagentId, {
    id: subagentId,
    name: subagentName,
    tabId: subTab.tabId,
    agentSessionId: subagentSessionId,
    colorIndex: subTab.colorIndex,
    status: 'running',
    parentRunMeta: runMeta,
    pendingInstructions: [],
    taskId: orchestratorTaskId,
    startedAt: Date.now(),
    promise,
    resolve: resolvePromise,
  });
  recordSubagentStart(sessionState, {
    id: subagentId,
    name: subagentName,
    tabId: subTab.tabId,
    agentSessionId: subagentSessionId,
    colorIndex: subTab.colorIndex,
    taskId: orchestratorTaskId,
    startedAt: Date.now(),
  });

  // Fire the agent loop in the background (non-blocking)
  const loopCtx = {
    subagentId,
    subagentName,
    subagentSessionId,
    taskList,
    tabId: subTab.tabId,
    taskId: orchestratorTaskId,
  };
  runSubagentLoop(ctx, runMeta, subRunMeta, args, settings, profileSettings, executeTool, runtimeMeta, loopCtx).then(
    (result) => {
      ctx.setSubagentTabBadge(subTab.tabId, {
        agentId: subagentId,
        name: subagentName,
        colorIndex: subTab.colorIndex,
        status: result.success ? 'completed' : 'error',
      });
      const entry = sessionState.runningSubagents.get(subagentId);
      if (entry) {
        entry.status = result.success ? 'completed' : 'error';
        entry.resolve(result);
      }
      recordSubagentCompletion(sessionState, result);
      cleanupSubagentTab(ctx, subagentSessionId);
    },
  );

  return {
    success: true,
    source: 'subagent',
    id: subagentId,
    name: subagentName,
    tabId: subTab.tabId,
    status: 'started',
    note: `${subagentName} is now running in tab ${subTab.tabId}. Use await_agents to wait for results.`,
  };
}

function resolveProfileName(
  args: ToolExecutionArgs,
  settings: ToolExecutionSettings,
  sessionState: { subAgentProfileCursor: number },
): string {
  let name = typeof args.profile === 'string' ? args.profile : typeof args.config === 'string' ? args.config : '';
  if (!name) {
    const teamProfiles = Array.isArray(settings.auxAgentProfiles) ? settings.auxAgentProfiles : [];
    if (teamProfiles.length) {
      const cursor = sessionState.subAgentProfileCursor % teamProfiles.length;
      name = String(teamProfiles[cursor] || '');
      sessionState.subAgentProfileCursor += 1;
    }
  }
  return name || (typeof settings.activeConfig === 'string' ? settings.activeConfig : 'default');
}
