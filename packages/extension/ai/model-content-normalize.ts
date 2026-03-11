// Content normalization helpers for model message conversion
import type { AssistantContent, DataContent, ImagePart, JSONValue, ToolContent, ToolResultPart, UserContent } from 'ai';
import type { Message, MessageContent } from './message-types.js';

export function normalizeToolContent(message: Message): ToolContent {
  const content = message.content;
  const toolCallId = message.toolCallId || message.tool_call_id || `tool_${Date.now()}`;
  return [
    {
      type: 'tool-result',
      toolCallId: String(toolCallId),
      toolName: message.name || message.toolName || 'tool',
      output: normalizeToolOutput(content),
    },
  ];
}

function normalizeToolOutput(content: MessageContent): ToolResultPart['output'] {
  if (typeof content === 'string') {
    return { type: 'text', value: content };
  }
  if (content && typeof content === 'object') {
    return {
      type: 'json',
      value: coerceJsonValue(content),
    };
  }
  return { type: 'text', value: '' };
}

export function normalizeUserContent(content: MessageContent): UserContent {
  if (Array.isArray(content)) {
    const parts: Array<{ type: 'text'; text: string } | ImagePart> = [];
    for (const part of content) {
      if (typeof part === 'string') {
        parts.push({ type: 'text', text: part });
        continue;
      }
      if (part && typeof part === 'object') {
        if ('text' in part && typeof part.text === 'string') {
          parts.push({ type: 'text', text: part.text });
          continue;
        }
        if ('image_url' in part && part.image_url?.url) {
          parts.push({ type: 'image', image: part.image_url.url as DataContent });
          continue;
        }
      }
      parts.push({ type: 'text', text: '' });
    }
    return parts;
  }
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') return JSON.stringify(content);
  return '';
}

export function normalizeSystemContent(content: MessageContent): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return part.text;
        }
        return '';
      })
      .join('\n');
  }
  if (content && typeof content === 'object') return JSON.stringify(content);
  return '';
}

export function normalizeAssistantContent(message: Message, validToolResultIds?: Set<string>): AssistantContent {
  const rawToolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : [];
  const filteredToolCalls =
    validToolResultIds && rawToolCalls.length > 0
      ? rawToolCalls.filter((call) => call.id && validToolResultIds.has(call.id))
      : rawToolCalls;

  const toolCallParts = filteredToolCalls.map((call) => ({
    type: 'tool-call' as const,
    toolCallId: call.id,
    toolName: call.name,
    input: call.args || {},
  }));

  if (toolCallParts.length > 0) {
    const parts: AssistantContent = [];
    const text = typeof message.content === 'string' ? message.content : '';
    if (text) {
      parts.push({ type: 'text' as const, text });
    }
    parts.push(...toolCallParts);
    return parts;
  }

  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (typeof part === 'string') return { type: 'text' as const, text: part };
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
          return { type: 'text' as const, text: part.text };
        }
        return null;
      })
      .filter((part): part is { type: 'text'; text: string } => part !== null);
  }
  if (message.content && typeof message.content === 'object') {
    return JSON.stringify(message.content);
  }
  return '';
}

function coerceJsonValue(value: unknown): JSONValue {
  try {
    return JSON.parse(JSON.stringify(value)) as JSONValue;
  } catch {
    return String(value ?? '');
  }
}
