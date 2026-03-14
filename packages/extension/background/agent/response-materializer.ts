import type { Message } from '../../ai/messages/schema.js';

export type NormalizedToolResult = Record<string, unknown> & {
  toolCallId: string;
  toolName: string;
};

export function buildResponseMessages(
  finalText: string,
  reasoningText: string | null,
  toolResults: Array<Record<string, unknown>>,
): {
  normalizedToolResults: NormalizedToolResult[];
  responseMessages: Message[];
} {
  const assistantMsg: Message = {
    role: 'assistant',
    content: finalText,
    thinking: reasoningText || null,
  };

  const normalizedToolResults: NormalizedToolResult[] =
    toolResults.length > 0
      ? toolResults.map((resultItem, index) => ({
          ...resultItem,
          toolCallId:
            typeof resultItem?.toolCallId === 'string' && resultItem.toolCallId.trim()
              ? resultItem.toolCallId
              : `tc_${Date.now()}_${index}`,
          toolName:
            typeof resultItem?.toolName === 'string' && resultItem.toolName.trim() ? resultItem.toolName : 'tool',
        }))
      : [];

  if (normalizedToolResults.length > 0) {
    assistantMsg.toolCalls = normalizedToolResults.map((resultItem) => ({
      id: resultItem.toolCallId,
      name: resultItem.toolName,
      args: (resultItem.input || resultItem.args || {}) as Record<string, unknown>,
    }));
  }

  const responseMessages: Message[] = [assistantMsg];
  if (normalizedToolResults.length > 0) {
    responseMessages.push(
      ...normalizedToolResults.map((resultItem) => ({
        role: 'tool' as const,
        toolCallId: resultItem.toolCallId,
        toolName: resultItem.toolName,
        content: [
          {
            type: 'tool-result',
            toolCallId: resultItem.toolCallId,
            toolName: resultItem.toolName,
            output:
              resultItem.output && typeof resultItem.output === 'object'
                ? { type: 'json', value: resultItem.output }
                : { type: 'text', value: String(resultItem.output ?? '') },
          },
        ],
      })),
    );
  }

  return { normalizedToolResults, responseMessages };
}
