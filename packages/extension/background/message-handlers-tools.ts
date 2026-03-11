import { normalizeSessionId } from './message-handlers-core.js';
import type { ServiceContext } from './service-context.js';

// Tool execution handlers
export async function handleExecuteTool(ctx: ServiceContext, message: any, sendResponse: (response?: any) => void) {
  const sessionId = normalizeSessionId(message.sessionId, ctx.currentSessionId || 'default');
  const result = await ctx.getBrowserTools(sessionId).executeTool(message.tool, message.args);
  sendResponse({ success: true, result });
}

export async function handleExecuteRuntimeToolTest(
  ctx: ServiceContext,
  message: any,
  sendResponse: (response?: any) => void,
) {
  const sessionId = normalizeSessionId(message.sessionId, ctx.currentSessionId || 'runtime-tool-test');
  const toolName = typeof message.tool === 'string' ? message.tool.trim() : '';
  if (!toolName) {
    sendResponse({ success: false, error: 'Missing tool name.' });
    return;
  }
  const settings = await chrome.storage.local.get(null);
  const result = await ctx.executeToolByName(
    toolName,
    message.args && typeof message.args === 'object' ? message.args : {},
    {
      runMeta: {
        runId: normalizeSessionId(message.runId, `test-run-${Date.now()}`),
        turnId: normalizeSessionId(message.turnId, `test-turn-${Date.now()}`),
        sessionId,
      },
      settings,
    },
  );
  sendResponse({ success: true, result });
}

// Subagent handler
export function handleSubagentInstruction(ctx: ServiceContext, message: any, sendResponse: (response?: any) => void) {
  const sessionId = normalizeSessionId(message.sessionId, '');
  const agentId = typeof message.agentId === 'string' ? message.agentId.trim() : '';
  const instruction = typeof message.instruction === 'string' ? message.instruction.trim() : '';
  if (!sessionId || !agentId || !instruction) {
    sendResponse({ success: false, error: 'Missing session, agent, or instruction.' });
    return;
  }

  const sessionState = ctx.getSessionState(sessionId);
  const agent = sessionState.runningSubagents.get(agentId);
  if (!agent || agent.status !== 'running') {
    sendResponse({ success: false, error: 'That agent is no longer running.' });
    return;
  }

  agent.pendingInstructions.push(instruction);
  ctx.sendRuntime(agent.parentRunMeta, {
    type: 'run_status',
    phase: 'executing',
    note: "Queued a new instruction for the agent's next tool step.",
    agentId,
    agentName: agent.name,
    agentKind: 'subagent',
    agentSessionId: agent.agentSessionId,
    parentSessionId: sessionId,
  });
  sendResponse({ success: true });
}
