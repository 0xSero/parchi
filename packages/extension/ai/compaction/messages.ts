// Message serialization and compaction utilities
import type { Message, MessageContent } from '../messages/types.js';

export function serializeConversation(messages: Message[]): string {
  const parts: string[] = [];

  for (const msg of messages) {
    const contentText = normalizeContentText(msg.content);
    if (msg.role === 'user') {
      if (contentText) parts.push(`[User]: ${contentText}`);
    } else if (msg.role === 'assistant') {
      if (contentText) parts.push(`[Assistant]: ${contentText}`);
      if (Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) {
        const toolCalls = msg.toolCalls.map((call) => `${call.name}(${JSON.stringify(call.args || {})})`).join('; ');
        parts.push(`[Assistant tool calls]: ${toolCalls}`);
      }
    } else if (msg.role === 'tool') {
      if (contentText) parts.push(`[Tool result]: ${contentText}`);
    } else if (msg.role === 'system') {
      if (contentText) parts.push(`[System]: ${contentText}`);
    }
  }

  return parts.join('\n\n');
}

function normalizeContentText(content: MessageContent): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          if (typeof part.text === 'string') return part.text;
          if (typeof part.content === 'string') return part.content;
          try {
            return JSON.stringify(part);
          } catch {
            return '';
          }
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  try {
    return JSON.stringify(content);
  } catch {
    return String(content ?? '');
  }
}

export function buildCompactionSummaryMessage(summary: string, trimmedCount: number): Message {
  return {
    role: 'system',
    content: summary.trim(),
    meta: {
      kind: 'summary',
      summaryOfCount: trimmedCount,
      source: 'auto',
    },
  };
}

export function applyCompaction({
  summaryMessage,
  preserved,
  trimmedCount,
}: {
  summaryMessage: Message;
  preserved: Message[];
  trimmedCount: number;
}): {
  compacted: Message[];
  summaryMessage: Message;
  trimmedCount: number;
  preservedCount: number;
} {
  return {
    compacted: [summaryMessage, ...preserved],
    summaryMessage,
    trimmedCount,
    preservedCount: preserved.length,
  };
}
