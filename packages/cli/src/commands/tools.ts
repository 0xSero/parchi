import { fetchRpc } from '../rpc-client.js';

const print = (value: unknown) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

export async function cmdTools(flags: Record<string, string>) {
  const agentId = flags.agentId;
  const params = agentId ? { agentId } : undefined;
  const result = await fetchRpc({ method: 'tools.list', params });
  print(result);
}

export async function cmdTool(positional: string[], flags: Record<string, string>) {
  const toolName = positional[1];
  if (!toolName) {
    console.error("Usage: parchi tool <name> [--args='{...}']");
    process.exit(1);
  }
  let args: unknown = {};
  if (flags.args) {
    try {
      args = JSON.parse(flags.args);
    } catch {
      console.error('Invalid JSON for --args');
      process.exit(1);
    }
  }
  const agentId = flags.agentId;
  const params = agentId ? { agentId, tool: toolName, args } : { tool: toolName, args };
  const result = await fetchRpc({ method: 'tool.call', params });
  print(result);
}
