import { type RuntimeSendResponse, assertNonEmptyString, respondOk } from '../message-response.js';
import type { ServiceContext } from '../service-context.js';
import { normalizeSessionId } from './core.js';

// Tool execution handlers
export async function handleExecuteTool(ctx: ServiceContext, message: any, sendResponse: RuntimeSendResponse) {
  const sessionId = normalizeSessionId(message.sessionId, ctx.currentSessionId || 'default');
  const result = await ctx.getBrowserTools(sessionId).executeTool(message.tool, message.args);
  respondOk(sendResponse, { result });
}

export async function handleExecuteRuntimeToolTest(
  ctx: ServiceContext,
  message: any,
  sendResponse: RuntimeSendResponse,
) {
  const sessionId = normalizeSessionId(message.sessionId, ctx.currentSessionId || 'runtime-tool-test');
  const toolName = assertNonEmptyString(message.tool, 'Missing tool name.');
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
  respondOk(sendResponse, { result });
}

// Subagent handler
export function handleSubagentInstruction(ctx: ServiceContext, message: any, sendResponse: RuntimeSendResponse) {
  const sessionId = assertNonEmptyString(message.sessionId, 'Missing session, agent, or instruction.');
  const agentId = assertNonEmptyString(message.agentId, 'Missing session, agent, or instruction.');
  const instruction = assertNonEmptyString(message.instruction, 'Missing session, agent, or instruction.');

  const sessionState = ctx.getSessionState(sessionId);
  const agent = sessionState.runningSubagents.get(agentId);
  if (!agent || agent.status !== 'running') {
    throw new Error('That agent is no longer running.');
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
  respondOk(sendResponse);
}
