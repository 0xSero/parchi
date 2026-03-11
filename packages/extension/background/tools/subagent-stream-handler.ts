import type { ServiceContext } from '../service-context.js';
import type { RunMeta } from '../service-types.js';
import type { ToolExecutionOptions } from './tool-executor-shared.js';

export type StreamContext = {
  streamedText: string;
  runtimeMeta: NonNullable<ToolExecutionOptions['runtimeMeta']>;
};

export function createStreamContext(runtimeMeta: NonNullable<ToolExecutionOptions['runtimeMeta']>): StreamContext {
  return { streamedText: '', runtimeMeta };
}

export async function processTextStream(
  ctx: ServiceContext,
  parentRunMeta: RunMeta,
  textStream: AsyncIterable<unknown>,
  streamCtx: StreamContext,
): Promise<void> {
  try {
    for await (const textPart of textStream) {
      const p = String(textPart || '');
      if (!p) continue;
      streamCtx.streamedText += p;
      ctx.sendRuntime(parentRunMeta, {
        type: 'assistant_stream_delta',
        content: p,
        channel: 'text',
        ...streamCtx.runtimeMeta,
      });
    }
  } catch {
    // Stream errors are handled at a higher level
  }
}

export function handleReasoningChunk(
  ctx: ServiceContext,
  parentRunMeta: RunMeta,
  chunk: unknown,
  runtimeMeta: NonNullable<ToolExecutionOptions['runtimeMeta']>,
): void {
  const rec = chunk as { type?: unknown; text?: unknown; delta?: unknown };
  const t = typeof rec.type === 'string' ? rec.type : '';
  if (!t.includes('reasoning') && !t.includes('thinking')) return;
  const content = typeof rec.text === 'string' ? rec.text : typeof rec.delta === 'string' ? rec.delta : '';
  if (content) {
    ctx.sendRuntime(parentRunMeta, {
      type: 'assistant_stream_delta',
      content,
      channel: 'reasoning',
      ...runtimeMeta,
    });
  }
}
