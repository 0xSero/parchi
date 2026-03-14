import { buildToolSet, resolveLanguageModel } from '../../../ai/sdk/index.js';
import type { ServiceContext } from '../../service-context.js';
import type { AgentProfile, AgentSettings, PreparedAgentLoopRun } from './shared.js';

export type ModelConfig = {
  activeModelId: string;
  model: ReturnType<typeof resolveLanguageModel>;
  modelRetryOrder: string[];
  toolSet: ReturnType<typeof buildToolSet>;
};

export function buildModelConfig(
  orchestratorProfile: AgentProfile,
  settings: AgentSettings,
  tools: ReturnType<ServiceContext['getToolsForSession']>,
  ctx: ServiceContext,
  runMeta: PreparedAgentLoopRun['runMeta'],
  visionProfile: AgentProfile | null,
  modelRetryOrder: string[],
): ModelConfig {
  const activeModelId = String(orchestratorProfile.model || settings.model || '').trim();
  const model = resolveLanguageModel(orchestratorProfile);

  const executeTool = (toolName: string, args: Record<string, unknown>, options: { toolCallId?: string }) =>
    ctx.executeToolByName(toolName, args, { runMeta, settings, visionProfile }, options.toolCallId);

  return {
    activeModelId,
    model,
    modelRetryOrder,
    toolSet: buildToolSet(tools, (toolName, args, options) => executeTool(toolName, args, options)),
  };
}

export function createModelSwitcher(
  prepared: PreparedAgentLoopRun,
  diagnostics: { benchmarkModel: string },
): (nextModelId: string) => boolean {
  return function switchActiveModel(nextModelId: string): boolean {
    const trimmed = String(nextModelId || '').trim();
    if (!trimmed) return false;
    if (trimmed === prepared.activeModelId) return true;
    prepared.orchestratorProfile = { ...prepared.orchestratorProfile, model: trimmed };
    prepared.activeModelId = trimmed;
    prepared.model = resolveLanguageModel(prepared.orchestratorProfile);
    diagnostics.benchmarkModel = trimmed;
    return true;
  };
}
