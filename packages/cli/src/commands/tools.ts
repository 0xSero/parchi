/**
 * Tools Command - CLI tools command using shared relay protocol
 */
import { executeRelayToolCall, executeRelayToolsList, parseJsonFlag, printJson } from '../relay-protocol.js';

export async function cmdTools(flags: Record<string, string>) {
  const result = await executeRelayToolsList(flags.agentId);
  printJson(result);
}

export async function cmdTool(positional: string[], flags: Record<string, string>) {
  const toolName = positional[1];
  if (!toolName) {
    console.error("Usage: parchi tool <name> [--args='{...}']");
    process.exit(1);
  }
  const args = parseJsonFlag(flags.args, {}, 'Invalid JSON for --args') as Record<string, unknown>;
  const result = await executeRelayToolCall({
    tool: toolName,
    args,
    agentId: flags.agentId,
  });
  printJson(result);
}
