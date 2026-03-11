import type { ElectronToolContext, JsonRecord } from '../types.js';
import { TOOL_DEFINITIONS } from './tool-definitions.js';
import { toolHandlers } from './tool-handlers.js';

export const getElectronToolDefinitions = () => TOOL_DEFINITIONS;

export const executeElectronTool = async ({
  tool,
  args,
  context,
}: {
  tool: string;
  args: JsonRecord;
  context: ElectronToolContext;
}) => {
  const handler = toolHandlers[tool];
  if (!handler) throw new Error(`Unknown electron tool: ${tool}`);
  return await handler(args, context);
};
