import type { Message, MessageContent } from './schema.js';

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

export type ExtractThinkingResult = {
  content: string;
  thinking: string | null;
};

export function extractTextFromResponseMessages(messages: unknown): string {
  if (!Array.isArray(messages)) return '';
  const collected: string[] = [];

  const collectFromContent = (content: unknown) => {
    if (!content) return;
    if (typeof content === 'string') {
      if (content.trim()) collected.push(content);
      return;
    }
    if (Array.isArray(content)) {
      content.forEach((part) => collectFromContent(part));
      return;
    }
    if (content && typeof content === 'object') {
      const record = asRecord(content);
      const type = typeof record?.type === 'string' ? String(record.type).toLowerCase() : '';
      if (type && (type.includes('thinking') || type.includes('reasoning') || type.includes('analysis'))) {
        return;
      }
      if (type && (type.includes('tool') || type.includes('function'))) {
        return;
      }
      const text =
        typeof record?.text === 'string' ? record.text : typeof record?.content === 'string' ? record.content : '';
      if (text && text.trim()) collected.push(text);
    }
  };

  messages.forEach((msg) => {
    const message = asRecord(msg) as Message | null;
    collectFromContent(message?.content);
  });
  return collected.join('').trim();
}

export function extractThinking(content: string | null | undefined, existingThinking: string | null = null) {
  let thinking: string | null = existingThinking || null;
  let cleanedContent = content || '';
  const thinkRegex = /<\s*(think|analysis|thinking)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi;
  let match;
  const collected: string[] = [];

  while ((match = thinkRegex.exec(cleanedContent)) !== null) {
    if (match[2]) collected.push(match[2].trim());
  }

  if (collected.length > 0) {
    thinking = [existingThinking, ...collected].filter(Boolean).join('\n\n').trim();
    thinkRegex.lastIndex = 0;
    cleanedContent = cleanedContent.replace(thinkRegex, '').trim();
  }

  return { content: cleanedContent, thinking };
}

export function extractThinkingFromResponseMessages(messages: unknown): string | null {
  if (!Array.isArray(messages)) return null;
  const thinkRegex = /<\s*(think|analysis|thinking)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi;
  const collected: string[] = [];

  const collectFromText = (text: string) => {
    let match;
    while ((match = thinkRegex.exec(text)) !== null) {
      if (match[2]) collected.push(match[2].trim());
    }
    thinkRegex.lastIndex = 0;
  };

  const collectFromContent = (content: unknown) => {
    if (!content) return;
    if (typeof content === 'string') {
      collectFromText(content);
      return;
    }
    if (Array.isArray(content)) {
      content.forEach((part) => collectFromContent(part));
      return;
    }
    if (content && typeof content === 'object') {
      const record = asRecord(content);
      if (!record) return;
      const type = typeof record?.type === 'string' ? String(record.type) : '';
      if (type && (type.includes('thinking') || type.includes('reasoning') || type.includes('analysis'))) {
        const raw = record.text ?? record.content ?? record.value;
        if (typeof raw === 'string' && raw.trim()) collected.push(raw.trim());
        return;
      }
      if (typeof record?.text === 'string') {
        collectFromText(record.text);
        return;
      }
      if (typeof record?.content === 'string') {
        collectFromText(record.content);
      }
    }
  };

  messages.forEach((msg) => collectFromContent(asRecord(msg)?.content));
  const merged = collected.filter(Boolean).join('\n\n').trim();
  return merged || null;
}

export function dedupeThinking(thinking: string | null) {
  if (!thinking) return '';

  // First, split into paragraphs and dedupe whole paragraphs
  const paragraphs = thinking.split(/\n\n+/);
  const seenParagraphs = new Set<string>();
  const dedupedParagraphs: string[] = [];

  for (const para of paragraphs) {
    const normalized = para.trim().toLowerCase();
    if (normalized && !seenParagraphs.has(normalized)) {
      seenParagraphs.add(normalized);
      dedupedParagraphs.push(para.trim());
    }
  }

  // Then dedupe consecutive identical lines within each paragraph
  const result = dedupedParagraphs.join('\n\n');
  const lines = result.split('\n');
  const deduplicated: string[] = [];
  let lastLine: string | null = null;
  let repeatCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === lastLine && trimmed !== '') {
      repeatCount++;
      if (repeatCount >= 2) {
        // Skip repeated lines after 2nd occurrence
      }
    } else {
      deduplicated.push(line);
      lastLine = trimmed;
      repeatCount = 0;
    }
  }

  return deduplicated.join('\n').trim();
}

export function estimateTokensFromContent(content: MessageContent): number {
  if (!content) return 0;
  if (typeof content === 'string') return Math.ceil(content.length / 4);
  if (Array.isArray(content)) {
    return content.reduce((acc, part) => {
      if (typeof part === 'string') return acc + Math.ceil(part.length / 4);
      if (part && typeof part === 'object') {
        if ('text' in part && typeof part.text === 'string') return acc + Math.ceil(part.text.length / 4);
        try {
          return acc + Math.ceil(JSON.stringify(part).length / 4);
        } catch {
          return acc;
        }
      }
      return acc;
    }, 0);
  }
  try {
    return Math.ceil(JSON.stringify(content).length / 4);
  } catch {
    return Math.ceil(String(content).length / 4);
  }
}
