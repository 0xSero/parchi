import {
  SUMMARIZATION_PROMPT,
  UPDATE_SUMMARIZATION_PROMPT,
  findCutPoint,
  serializeConversation,
} from '../../../ai/compaction/index.js';
import type { Message } from '../../../ai/messages/schema.js';
import type { PreparedCompactionSlice } from './shared.js';

export function prepareCompactionSlice(
  nextHistory: Message[],
  keepRecentTokens: number,
  forceCompaction: boolean,
): PreparedCompactionSlice | { skipReason: string } {
  let summaryIndex = -1;
  for (let index = nextHistory.length - 1; index >= 0; index -= 1) {
    const message = nextHistory[index];
    if (message.role === 'system' && message.meta?.kind === 'summary') {
      summaryIndex = index;
      break;
    }
  }

  const summaryMessage = summaryIndex >= 0 ? nextHistory[summaryIndex] : undefined;
  const previousSummary: string | undefined = summaryMessage
    ? typeof summaryMessage.content === 'string'
      ? summaryMessage.content
      : JSON.stringify(summaryMessage.content) || undefined
    : undefined;

  const compactionStart = summaryIndex >= 0 ? summaryIndex + 1 : 0;
  const cutIndex = findCutPoint(nextHistory, compactionStart, keepRecentTokens);
  let messagesToSummarize = nextHistory.slice(compactionStart, cutIndex);
  let preserved = nextHistory.slice(cutIndex);

  if (!messagesToSummarize.length && !forceCompaction) {
    const fallbackKeepMessages = Math.min(12, Math.max(4, Math.floor(nextHistory.length * 0.25)));
    const fallbackCutIndex = Math.max(compactionStart + 1, nextHistory.length - fallbackKeepMessages);
    messagesToSummarize = nextHistory.slice(compactionStart, fallbackCutIndex);
    preserved = nextHistory.slice(fallbackCutIndex);
  }

  if (!messagesToSummarize.length && forceCompaction) {
    const forcedWindow = nextHistory.filter(
      (message) => !(message.role === 'system' && message.meta?.kind === 'summary'),
    );
    messagesToSummarize = forcedWindow.length > 0 ? forcedWindow : nextHistory;
    preserved = [];
  }

  if (!messagesToSummarize.length) {
    return { skipReason: 'Compaction skipped: nothing to summarize yet.' };
  }

  const conversationText = serializeConversation(messagesToSummarize);
  let promptText = `<conversation>\n${conversationText}\n</conversation>\n\n`;
  if (previousSummary) {
    promptText += `<previous-summary>\n${previousSummary}\n</previous-summary>\n\n`;
  }
  promptText += previousSummary ? UPDATE_SUMMARIZATION_PROMPT : SUMMARIZATION_PROMPT;

  return {
    previousSummary,
    messagesToSummarize,
    preserved,
    promptText,
  };
}
