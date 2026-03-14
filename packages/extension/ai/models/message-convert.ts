// Convert Message[] to ModelMessage[] for AI SDK
import type { ModelMessage } from 'ai';
import type { Message } from '../messages/types.js';
import {
  normalizeAssistantContent,
  normalizeSystemContent,
  normalizeToolContent,
  normalizeUserContent,
} from './content-normalize.js';

export function toModelMessages(history: Message[] = []): ModelMessage[] {
  const normalized = Array.isArray(history) ? history : [];

  const expanded = normalized.flatMap((msg) => {
    if (msg.role !== 'tool') return [msg];
    return expandToolMessage(msg);
  });
  const { validToolCallIds, validToolIndexes } = resolveValidToolCallAdjacency(expanded);

  return expanded
    .filter((msg, index) => {
      if (!msg || !msg.role) return false;
      if (msg.role === 'tool' && !validToolIndexes.has(index)) return false;
      return true;
    })
    .map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: 'tool',
          content: normalizeToolContent(msg),
        };
      }
      if (msg.role === 'assistant') {
        return {
          role: 'assistant',
          content: normalizeAssistantContent(msg, validToolCallIds),
        } as ModelMessage;
      }
      if (msg.role === 'system') {
        return {
          role: 'system',
          content: normalizeSystemContent(msg.content),
        };
      }
      return {
        role: 'user',
        content: normalizeUserContent(msg.content),
      };
    });
}

function resolveValidToolCallAdjacency(messages: Message[]) {
  const validToolCallIds = new Set<string>();
  const validToolIndexes = new Set<number>();

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role !== 'assistant' || !Array.isArray(message.toolCalls) || message.toolCalls.length === 0) continue;

    const expectedIds = new Set(message.toolCalls.map((call) => String(call?.id || '').trim()).filter(Boolean));
    if (expectedIds.size === 0) continue;

    const matchedIds = new Set<string>();
    const matchedIndexes: number[] = [];

    for (let cursor = index + 1; cursor < messages.length; cursor += 1) {
      const next = messages[cursor];
      if (next.role !== 'tool') break;
      const toolCallId = String(next.toolCallId || next.tool_call_id || '').trim();
      if (!toolCallId || !expectedIds.has(toolCallId)) continue;
      matchedIds.add(toolCallId);
      matchedIndexes.push(cursor);
    }

    if (matchedIds.size !== expectedIds.size) continue;
    for (const toolCallId of matchedIds) validToolCallIds.add(toolCallId);
    matchedIndexes.forEach((toolIndex) => validToolIndexes.add(toolIndex));
  }

  return { validToolCallIds, validToolIndexes };
}

function expandToolMessage(message: Message): Message[] {
  const directToolCallId = message.toolCallId || message.tool_call_id;
  if (directToolCallId) return [message];

  const entries: Message[] = [];
  const fromPart = (part: unknown) => {
    if (!part || typeof part !== 'object') return;
    const rawPart = part as Record<string, unknown>;
    const toolCallId = rawPart.toolCallId || rawPart.tool_call_id || rawPart.tool_use_id || rawPart.id;
    if (typeof toolCallId !== 'string' || !toolCallId.trim()) return;
    const toolName =
      typeof rawPart.toolName === 'string'
        ? rawPart.toolName
        : typeof rawPart.name === 'string'
          ? rawPart.name
          : message.toolName || message.name || 'tool';
    const output = rawPart.output ?? rawPart.result ?? rawPart.content ?? rawPart;
    entries.push({
      role: 'tool',
      toolCallId: toolCallId.trim(),
      toolName,
      name: toolName,
      content: output as Message['content'],
    });
  };

  if (Array.isArray(message.content)) {
    message.content.forEach((part) => fromPart(part));
  } else {
    fromPart(message.content);
  }

  return entries.length > 0 ? entries : [message];
}
