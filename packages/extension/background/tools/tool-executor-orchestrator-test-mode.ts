import type { ServiceContext } from '../service-context.js';
import type { RunMeta, SessionState } from '../service-types.js';
import { recordSubagentStart } from './orchestrator-runtime-state.js';
import { cleanupSubagentTab, createSubagentTab } from './tool-executor-subagent-tab.js';

type SyntheticSubagentSpec = {
  url?: string;
  summary?: string;
  success?: boolean;
  data?: unknown;
  script?: Array<{ tool: string; args?: Record<string, unknown>; waitMs?: number }>;
  verifyTextIncludes?: string[];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

export const getSyntheticSubagentSpecs = (value: unknown) => asRecord(value);

export async function spawnSyntheticSubagentForOrchestratorTest(
  ctx: ServiceContext,
  sessionState: SessionState,
  runMeta: RunMeta,
  task: { id: string; title: string; assignedTabId?: number },
  spec: SyntheticSubagentSpec,
) {
  const nextSubagentCount = sessionState.subAgentCount + 1;
  const subagentId = `orchestrator-test-subagent-${Date.now()}-${nextSubagentCount}`;
  const subagentSessionId = `${runMeta.sessionId}::${subagentId}`;
  const subTab = await createSubagentTab(ctx, runMeta, subagentSessionId, nextSubagentCount, spec.url);
  sessionState.subAgentCount = nextSubagentCount;

  const summary =
    typeof spec.summary === 'string' && spec.summary.trim() ? spec.summary.trim() : `Completed ${task.id}`;
  const promise = (async () => {
    if (Array.isArray(spec.script)) {
      for (const step of spec.script) {
        const result = await subTab.browserTools.executeTool(step.tool, {
          ...(step.args || {}),
          tabId: subTab.tabId,
        });
        if (!result || (result as { success?: unknown }).success === false) {
          return {
            id: subagentId,
            name: task.title,
            success: false,
            summary: `Synthetic subagent step failed for ${task.id}: ${step.tool}`,
            tabId: subTab.tabId,
            taskId: task.id,
            data: spec.data,
          };
        }
        if (typeof step.waitMs === 'number' && step.waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, step.waitMs));
        }
      }
    }

    if (Array.isArray(spec.verifyTextIncludes) && spec.verifyTextIncludes.length > 0) {
      const content = (await subTab.browserTools.executeTool('getContent', {
        type: 'text',
        tabId: subTab.tabId,
        maxChars: 12000,
      })) as { success?: boolean; content?: string; error?: string };
      const text = String(content?.content || '');
      const missing = spec.verifyTextIncludes.filter((entry) => !text.includes(entry));
      if (content?.success === false || missing.length > 0) {
        return {
          id: subagentId,
          name: task.title,
          success: false,
          summary: `Synthetic subagent verification failed for ${task.id}: ${missing.join(', ') || content?.error || 'unknown'}`,
          tabId: subTab.tabId,
          taskId: task.id,
          data: spec.data,
        };
      }
    }

    return {
      id: subagentId,
      name: task.title,
      success: spec.success !== false,
      summary,
      tabId: subTab.tabId,
      taskId: task.id,
      data: spec.data,
    };
  })();
  const startedAt = Date.now();

  ctx.setSubagentTabBadge(subTab.tabId, {
    agentId: subagentId,
    name: task.title,
    colorIndex: subTab.colorIndex,
    status: 'running',
  });
  ctx.sendRuntime(runMeta, {
    type: 'subagent_tab_assigned',
    id: subagentId,
    name: task.title,
    tabId: subTab.tabId,
    url: subTab.url,
    agentSessionId: subagentSessionId,
    colorIndex: subTab.colorIndex,
    agentId: subagentId,
    agentName: task.title,
    agentKind: 'subagent',
    parentSessionId: runMeta.sessionId,
  });
  ctx.sendRuntime(runMeta, {
    type: 'subagent_start',
    id: subagentId,
    name: task.title,
    tasks: [task.title],
    agentSessionId: subagentSessionId,
    agentId: subagentId,
    agentName: task.title,
    agentKind: 'subagent',
    parentSessionId: runMeta.sessionId,
  });

  sessionState.runningSubagents.set(subagentId, {
    id: subagentId,
    name: task.title,
    tabId: subTab.tabId,
    agentSessionId: subagentSessionId,
    colorIndex: subTab.colorIndex,
    status: 'running',
    parentRunMeta: runMeta,
    pendingInstructions: [],
    taskId: task.id,
    startedAt,
    promise,
    resolve: () => {},
  });
  recordSubagentStart(sessionState, {
    id: subagentId,
    name: task.title,
    tabId: subTab.tabId,
    agentSessionId: subagentSessionId,
    colorIndex: subTab.colorIndex,
    taskId: task.id,
    startedAt,
  });

  return {
    success: true,
    source: 'subagent-test',
    id: subagentId,
    name: task.title,
    tabId: subTab.tabId,
    status: 'started',
    cleanup: () => cleanupSubagentTab(ctx, subagentSessionId),
  };
}
