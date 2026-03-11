/**
 * Run Command - CLI run command using shared relay protocol
 */
import { executeRelayRun, parseTabSelection, printJson } from '../relay-protocol.js';

export async function cmdRun(positional: string[], flags: Record<string, string>) {
  const prompt = positional.slice(1).join(' ').trim();
  if (!prompt) {
    console.error('Usage: parchi run <prompt>');
    process.exit(1);
  }

  const selectedTabIds = parseTabSelection(flags.tabs);
  const timeoutMs = Number(flags.timeoutMs || 600_000);

  const result = await executeRelayRun({
    prompt,
    agentId: flags.agentId,
    timeoutMs,
    selectedTabIds,
  });

  if (!result) {
    printJson({ error: 'Failed to start run' });
    return;
  }
  printJson(result);
}
