// Message creation and normalization utilities
import type { Message, MessageContent, ProviderMessage, Role, ToolCall, Usage } from './message-types.js';
import { ROLE_SET } from './message-types.js';

interface OpenAIToolCall {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
  function?: { name?: string; arguments?: string };
}

function createMessageId(): string {
  return `msg_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

export function createMessage({ role, content, ...meta }: Partial<Message> = {}): Message | null {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return null;
  const message: Message = {
    id: meta.id || createMessageId(),
    createdAt: meta.createdAt || new Date().toISOString(),
    role: normalizedRole,
    content: normalizeContent(content),
  };

  if (typeof meta.thinking === 'string' && meta.thinking.trim()) {
    message.thinking = meta.thinking;
  }
  if (meta.toolCalls) message.toolCalls = normalizeToolCalls(meta.toolCalls);
  if (meta.toolCallId) message.toolCallId = String(meta.toolCallId);
  if (meta.toolName) message.toolName = String(meta.toolName);
  if (meta.name) message.name = String(meta.name);
  if (meta.usage) message.usage = normalizeUsage(meta.usage);
  if (meta.meta) message.meta = meta.meta;
  return message;
}

export function normalizeConversationHistory(
  history: Message[] = [],
  options: {
    defaultRole?: Role;
    addIds?: boolean;
    addTimestamps?: boolean;
  } = {},
): Message[] {
  const messages = Array.isArray(history) ? history : [];
  const normalized: Message[] = [];
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue;
    const role = normalizeRole(msg.role || options.defaultRole);
    if (!role) continue;

    const base: Message = {
      role,
      content: normalizeContent(msg.content),
    };

    const id = typeof msg.id === 'string' ? msg.id : options.addIds === false ? null : createMessageId();
    if (id) base.id = id;

    const createdAt =
      typeof msg.createdAt === 'string'
        ? msg.createdAt
        : options.addTimestamps === false
          ? null
          : new Date().toISOString();
    if (createdAt) base.createdAt = createdAt;

    if (typeof msg.thinking === 'string' && msg.thinking.trim()) {
      base.thinking = msg.thinking;
    }
    if (role === 'assistant') {
      const toolCalls = msg.toolCalls || msg.tool_calls;
      if (Array.isArray(toolCalls)) {
        base.toolCalls = normalizeToolCalls(toolCalls);
      }
    }

    if (role === 'tool') {
      const toolCallId = msg.toolCallId || msg.tool_call_id;
      if (toolCallId) base.toolCallId = String(toolCallId);
      if (msg.name) base.name = String(msg.name);
      if (msg.toolName) base.toolName = String(msg.toolName);
    }

    if (msg.usage) base.usage = normalizeUsage(msg.usage);
    if (msg.meta) base.meta = msg.meta;

    normalized.push(base);
  }
  return normalized;
}

export function toProviderMessages(history: Message[] = []): ProviderMessage[] {
  const normalized = normalizeConversationHistory(history as Message[], {
    addIds: false,
    addTimestamps: false,
  });
  return normalized.map((msg) => {
    if (msg.role === 'tool') {
      const toolCallId = msg.toolCallId || msg.tool_call_id || '';
      return {
        role: 'tool',
        tool_call_id: toolCallId,
        content: normalizeToolContent(msg.content),
      };
    }

    const payload: ProviderMessage = {
      role: msg.role,
      content: msg.content,
    };

    if (msg.role === 'assistant' && Array.isArray(msg.toolCalls)) {
      payload.tool_calls = msg.toolCalls.map((call) => ({
        id: call.id || createMessageId(),
        type: 'function',
        function: {
          name: call.name || '',
          arguments: JSON.stringify(call.args || {}),
        },
      }));
    }
    return payload;
  });
}

function normalizeToolCalls(toolCalls: Array<ToolCall | OpenAIToolCall> = []): ToolCall[] {
  return toolCalls.map((call) => {
    const openAiCall = call as OpenAIToolCall;
    return {
      id: typeof call?.id === 'string' ? call.id : createMessageId(),
      name:
        typeof call?.name === 'string'
          ? call.name
          : typeof openAiCall?.function?.name === 'string'
            ? openAiCall.function.name
            : '',
      args: normalizeArgs((call as ToolCall)?.args ?? openAiCall?.function?.arguments),
    };
  });
}

export function normalizeUsage(usage: Partial<Usage> = {}): Usage {
  return {
    inputTokens: Number(usage.inputTokens || 0),
    outputTokens: Number(usage.outputTokens || 0),
    totalTokens: Number(usage.totalTokens || 0),
  };
}

function normalizeRole(role?: string): Role | '' {
  if (typeof role !== 'string') return '';
  const lowered = role.toLowerCase();
  return ROLE_SET.has(lowered as Role) ? (lowered as Role) : '';
}

function normalizeContent(content: MessageContent | null | undefined): MessageContent {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content;
  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function normalizeArgs(args: unknown): Record<string, unknown> {
  if (args && typeof args === 'object' && !Array.isArray(args)) return args as Record<string, unknown>;
  if (Array.isArray(args)) return { value: args };
  if (typeof args === 'string') {
    try {
      return JSON.parse(args);
    } catch {
      return { value: args };
    }
  }
  return {};
}

function normalizeToolContent(content: MessageContent): string {
  if (typeof content === 'string') return content;
  try {
    return JSON.stringify(content);
  } catch {
    return String(content ?? '');
  }
}
