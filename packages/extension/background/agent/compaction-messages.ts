import type { Message } from '../../ai/message-schema.js';
import { buildToolTraceMessage, messageSignature, toContentPreview } from './compaction-trace.js';

export function isSafeAnchorMessage(message: Message | null | undefined): message is Message {
  if (!message) return false;
  if (message.role === 'tool') return false;
  if (message.role === 'assistant' && Array.isArray(message.toolCalls) && message.toolCalls.length > 0) {
    return false;
  }
  return true;
}

export function buildContinuationMessage(nextHistory: Message[], source: string): Message {
  const latestUserMessage = [...nextHistory].reverse().find((message) => message.role === 'user');

  return {
    role: 'system',
    content: [
      'Compaction checkpoint:',
      '- Continue from the latest user objective.',
      '- Use this summary + preserved anchors + mini tool traces as source of truth.',
      '- Do not resend full old history unless explicitly requested.',
      latestUserMessage ? `Latest user request: ${toContentPreview(latestUserMessage.content, 280)}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    meta: {
      kind: 'summary',
      summaryOfCount: 1,
      source: source || 'auto',
    },
  };
}

export function assembleCompactedMessages(
  summaryMessage: Message,
  continuationMessage: Message,
  nextHistory: Message[],
  preserved: Message[],
): Message[] {
  const firstAnchor = nextHistory.find((message) => isSafeAnchorMessage(message)) || null;
  const lastAnchor = [...nextHistory].reverse().find((message) => isSafeAnchorMessage(message)) || null;
  const toolTraceMessage = buildToolTraceMessage(nextHistory);

  const compactedCandidates: Array<Message | null> = [
    summaryMessage,
    continuationMessage,
    toolTraceMessage,
    firstAnchor,
    ...preserved,
    lastAnchor,
  ];

  const compacted: Message[] = [];
  const compactedSeen = new Set<string>();

  for (const candidate of compactedCandidates) {
    if (!candidate) continue;
    const signature = messageSignature(candidate);
    if (compactedSeen.has(signature)) continue;
    compactedSeen.add(signature);
    compacted.push(candidate);
  }

  return compacted;
}
