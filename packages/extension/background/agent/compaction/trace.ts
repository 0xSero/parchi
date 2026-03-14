import type { Message } from '../../../ai/messages/schema.js';

const getRecord = (value: unknown) => (value && typeof value === 'object' ? (value as Record<string, unknown>) : null);

export function toContentPreview(content: Message['content'], max = 180): string {
  if (typeof content === 'string') return content.replace(/\s+/g, ' ').trim().slice(0, max);
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === 'string') return part;
        const record = getRecord(part);
        if (!record) return '';
        if (typeof record.text === 'string') return record.text;
        if (record.output !== undefined) {
          try {
            return JSON.stringify(record.output);
          } catch {
            return String(record.output ?? '');
          }
        }
        if (record.content !== undefined) {
          try {
            return JSON.stringify(record.content);
          } catch {
            return String(record.content ?? '');
          }
        }
        return '';
      })
      .filter(Boolean)
      .join(' ');
    return joined.replace(/\s+/g, ' ').trim().slice(0, max);
  }
  try {
    return JSON.stringify(content ?? '').slice(0, max);
  } catch {
    return String(content ?? '').slice(0, max);
  }
}

export function messageSignature(message: Message) {
  let contentSig = '';
  try {
    contentSig = JSON.stringify(message.content ?? '').slice(0, 320);
  } catch {
    contentSig = String(message.content ?? '').slice(0, 320);
  }
  const extra = message as Message & {
    toolCallId?: string;
    toolName?: string;
    meta?: { kind?: string };
  };
  return [message.role, extra.toolCallId || '', extra.toolName || '', contentSig, extra.meta?.kind || ''].join('|');
}

export function buildToolTraceMessage(messages: Message[]): Message | null {
  const resultByToolCallId = new Map<string, string>();
  const traces: string[] = [];
  const seen = new Set<string>();

  for (const message of messages) {
    if (message.role !== 'tool') continue;
    const toolMessage = message as Message & { toolCallId?: string };
    const id = String(toolMessage.toolCallId || '').trim();
    if (!id) continue;
    const resultPreview = toContentPreview(message.content, 140);
    if (resultPreview) {
      resultByToolCallId.set(id, resultPreview);
    }
  }

  for (const message of messages) {
    if (message.role !== 'assistant' || !Array.isArray(message.toolCalls)) continue;
    for (const call of message.toolCalls) {
      const id = String(call?.id || '').trim();
      const toolName = String(call?.name || 'tool').trim() || 'tool';
      const argsPreview = (() => {
        try {
          return JSON.stringify(call?.args ?? {}).slice(0, 120);
        } catch {
          return String(call?.args ?? '').slice(0, 120);
        }
      })();
      const key = id || `${toolName}:${argsPreview}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const resultPreview = id ? resultByToolCallId.get(id) : '';
      traces.push(`- ${toolName}(${argsPreview})${resultPreview ? ` -> ${resultPreview}` : ''}${id ? ` [${id}]` : ''}`);
      if (traces.length >= 32) break;
    }
    if (traces.length >= 32) break;
  }

  if (!traces.length) return null;
  return {
    role: 'system',
    content: `## Tool Trace Mini Map\n${traces.join('\n')}`,
    meta: {
      kind: 'summary',
      summaryOfCount: traces.length,
      source: 'auto',
    },
  } satisfies Message;
}
