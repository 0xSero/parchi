import { formatToolExecutorError } from './tool-executor-shared.js';

export function buildPendingInstructionsResult(instructions: string[]) {
  return {
    success: false,
    accepted: false,
    orchestratorInstructions: instructions,
    orchestratorNote:
      'New orchestrator instructions arrived. Continue working and call subagent_complete again when everything is done.',
  };
}

export function attachQueuedInstructions(result: unknown, instructions: string[]) {
  if (instructions.length === 0) return result;
  const payload =
    typeof result === 'object' && result !== null && !Array.isArray(result)
      ? { ...(result as Record<string, unknown>) }
      : { result };
  return {
    ...payload,
    orchestratorInstructions: instructions,
    orchestratorNote:
      instructions.length === 1
        ? 'The orchestrator sent a new instruction. Incorporate it before continuing.'
        : `The orchestrator sent ${instructions.length} new instructions. Incorporate them before continuing.`,
  };
}

export async function resolveSummary(
  result: { text: PromiseLike<string> },
  capturedSummary: string | null,
  streamedText: string,
): Promise<string> {
  try {
    const rawText = await result.text;
    return capturedSummary || rawText || streamedText || 'Sub-agent completed its task.';
  } catch (error) {
    const msg = formatToolExecutorError(error);
    if (msg.includes('No output generated')) {
      return capturedSummary || streamedText || 'Sub-agent finished without generating output.';
    }
    throw error;
  }
}

export const SUBAGENT_COMPLETE_TOOL = {
  name: 'subagent_complete',
  description: 'Call this when you have finished all assigned tasks. Provide a concise summary of findings.',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: {
        type: 'string',
        description: 'Concise summary of what you found / accomplished.',
      },
      data: { type: 'object', description: 'Optional structured data payload.' },
    },
    required: ['summary'],
  },
};

export async function safeAwait<T>(promise: PromiseLike<T> | undefined, fallback: T): Promise<T> {
  if (!promise) return fallback;
  try {
    return await Promise.resolve(promise);
  } catch {
    return fallback;
  }
}
