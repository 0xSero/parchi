// Token estimation for compaction
import type { Message, Usage } from '../messages/types.js';
import { estimateTokensFromContent } from '../messages/utils.js';

function calculateContextTokens(usage: Usage): number {
  return usage.totalTokens || usage.inputTokens + usage.outputTokens;
}

function getAssistantUsage(message: Message): Usage | undefined {
  if (message.role !== 'assistant') return undefined;
  return message.usage && message.usage.totalTokens >= 0 ? message.usage : undefined;
}

function getLastAssistantUsageInfo(messages: Message[]): { usage: Usage; index: number } | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const usage = getAssistantUsage(messages[i]);
    if (usage) return { usage, index: i };
  }
  return undefined;
}

export function estimateContextTokens(messages: Message[]): {
  tokens: number;
  usageTokens: number;
  trailingTokens: number;
  lastUsageIndex: number | null;
} {
  const usageInfo = getLastAssistantUsageInfo(messages);
  if (!usageInfo) {
    let estimated = 0;
    for (const message of messages) {
      estimated += estimateTokens(message);
    }
    return {
      tokens: estimated,
      usageTokens: 0,
      trailingTokens: estimated,
      lastUsageIndex: null,
    };
  }

  const usageTokens = calculateContextTokens(usageInfo.usage);
  let trailingTokens = 0;
  for (let i = usageInfo.index + 1; i < messages.length; i += 1) {
    trailingTokens += estimateTokens(messages[i]);
  }

  return {
    tokens: usageTokens + trailingTokens,
    usageTokens,
    trailingTokens,
    lastUsageIndex: usageInfo.index,
  };
}

function estimateTokens(message: Message): number {
  let tokens = estimateTokensFromContent(message.content);

  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (!part || typeof part !== 'object') continue;
      if (part.type === 'image' || part.type === 'image_url') {
        tokens += 1200;
      }
      if (part.source?.data) {
        tokens += 1200;
      }
    }
  }

  if (message.role === 'assistant' && Array.isArray(message.toolCalls)) {
    tokens += Math.ceil(JSON.stringify(message.toolCalls).length / 4);
  }
  return tokens;
}

function isValidCutPoint(message: Message): boolean {
  return message.role !== 'tool';
}

export function findCutPoint(messages: Message[], startIndex: number, keepRecentTokens: number): number {
  const cutPoints = messages
    .map((msg, index) => ({ msg, index }))
    .filter(({ msg, index }) => index >= startIndex && isValidCutPoint(msg))
    .map(({ index }) => index);

  if (cutPoints.length === 0) return startIndex;

  let accumulatedTokens = 0;
  let cutIndex = cutPoints[0];

  for (let i = messages.length - 1; i >= startIndex; i -= 1) {
    accumulatedTokens += estimateTokens(messages[i]);
    if (accumulatedTokens >= keepRecentTokens) {
      for (let c = 0; c < cutPoints.length; c += 1) {
        if (cutPoints[c] >= i) {
          cutIndex = cutPoints[c];
          break;
        }
      }
      break;
    }
  }

  if (messages[cutIndex]?.role === 'tool' && cutIndex > startIndex) {
    let adjusted = cutIndex - 1;
    while (adjusted > startIndex && messages[adjusted].role === 'tool') {
      adjusted -= 1;
    }
    cutIndex = adjusted;
  }

  return cutIndex;
}
