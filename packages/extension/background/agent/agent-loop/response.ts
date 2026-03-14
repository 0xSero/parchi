import { generateText } from 'ai';
import { normalizeConversationHistory } from '../../../ai/messages/schema.js';
import { extractThinking } from '../../../ai/messages/utils.js';
import { toModelMessages } from '../../../ai/models/convert.js';
import { isValidFinalResponse } from '../../../ai/models/retry-engine.js';
import { buildCodexOAuthProviderOptions, isCodexOAuthProvider } from '../../../ai/sdk/index.js';
import { enhanceSystemPrompt } from '../../system-prompt.js';
import { extractXmlToolCalls, stripXmlToolCalls } from '../../tools/xml-tool-parser.js';
import { buildResponseMessages } from '../response-materializer.js';
import { runAgentModelPassWithFallback } from './model-fallback.js';
import type { AgentLoopDiagnostics, AgentResponseResult, PreparedAgentLoopRun } from './shared.js';

export async function resolveAgentResponse(
  prepared: PreparedAgentLoopRun,
  diagnostics: AgentLoopDiagnostics,
  buildLatencyMetrics: () => Record<string, unknown>,
  buildBenchmarkContext: (success: boolean, errorCategory?: string) => Record<string, unknown>,
): Promise<AgentResponseResult | null> {
  const maxRecoveryAttempts = 2;
  let recoveryAttempt = 0;
  let finalText = '';
  let reasoningText: string | null = null;
  let totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let toolResults: Array<Record<string, unknown>> = [];
  let responseMessages: AgentResponseResult['responseMessages'] = [];

  while (true) {
    if (prepared.abortSignal.aborted) return null;
    const passResult = await runAgentModelPassWithFallback(prepared, diagnostics);
    const xmlToolCalls = extractXmlToolCalls(passResult.text);
    toolResults = passResult.toolResults || [];

    if (xmlToolCalls.length > 0 && toolResults.length === 0 && recoveryAttempt < maxRecoveryAttempts) {
      prepared.ctx.sendRuntime(prepared.runMeta, {
        type: 'run_warning',
        message: 'Detected XML tool call output. Executing tools and retrying.',
      });

      const cleanedText = stripXmlToolCalls(passResult.text);
      const parsedXmlAssistant = extractThinking(cleanedText, passResult.reasoningText || null);
      const toolMessages: AgentResponseResult['responseMessages'] = [];
      const xmlToolCallEntries: Array<{ id: string; name: string; args: Record<string, unknown> }> = [];
      for (const call of xmlToolCalls) {
        if (prepared.abortSignal.aborted) return null;
        const toolCallId = `xml_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        xmlToolCallEntries.push({ id: toolCallId, name: call.name, args: call.args });
        const output = await prepared.ctx.executeToolByName(
          call.name,
          call.args,
          { runMeta: prepared.runMeta, settings: prepared.settings, visionProfile: prepared.visionProfile },
          toolCallId,
        );
        toolMessages.push({
          role: 'tool' as const,
          toolCallId,
          toolName: call.name,
          content: [
            {
              type: 'tool-result',
              toolCallId,
              toolName: call.name,
              output:
                output && typeof output === 'object'
                  ? { type: 'json', value: output }
                  : { type: 'text', value: String(output ?? '') },
            },
          ],
        });
      }
      prepared.currentHistory = normalizeConversationHistory([
        ...prepared.currentHistory,
        {
          role: 'assistant',
          content: parsedXmlAssistant.content || '',
          thinking: parsedXmlAssistant.thinking || null,
          toolCalls: xmlToolCallEntries,
        },
        ...toolMessages,
        {
          role: 'system',
          content:
            'Previous response included XML tool call markup. Tools were executed. Continue without XML tool tags.',
        },
      ]);
      recoveryAttempt += 1;
      continue;
    }

    const cleanedText = stripXmlToolCalls(passResult.text);
    const parsedFinal = extractThinking(cleanedText, passResult.reasoningText || null);
    reasoningText = parsedFinal.thinking || passResult.reasoningText || null;
    totalUsage = passResult.totalUsage || totalUsage;
    finalText = isValidFinalResponse(parsedFinal.content, { allowEmpty: false }) ? parsedFinal.content.trim() : '';

    if (!finalText) {
      for (let attempt = 1; attempt <= 2 && !finalText; attempt += 1) {
        prepared.ctx.sendRuntime(prepared.runMeta, {
          type: 'run_warning',
          message: `Model did not produce a valid final response. Retrying finalization (${attempt}/2).`,
        });
        const finalizePromptParts = [
          'Your previous response did not include a valid final answer.',
          'Write the final answer now.',
          'Do NOT call tools.',
          'Do NOT mention retrying, failures, or internal errors unless the user explicitly asked.',
        ];
        const toolDigest = buildToolDigest(toolResults);
        if (toolDigest) {
          finalizePromptParts.push('Use the tool results below as ground truth.');
          finalizePromptParts.push(`TOOL_RESULTS_JSON=${toolDigest}`);
        }

        const finalizeSystemPrompt = enhanceSystemPrompt(
          prepared.orchestratorProfile.systemPrompt || '',
          prepared.context,
          prepared.sessionState,
          prepared.matchedSkillsResult,
        );
        const usesCodexOAuth = isCodexOAuthProvider(String(prepared.orchestratorProfile?.provider || ''));
        const finalizeResult = await generateText({
          model: prepared.model,
          system: finalizeSystemPrompt,
          messages: [
            ...toModelMessages(prepared.currentHistory),
            { role: 'user', content: finalizePromptParts.join('\n') },
          ],
          abortSignal: prepared.abortSignal,
          temperature: 0.2,
          maxOutputTokens: usesCodexOAuth ? undefined : Math.min(2048, prepared.orchestratorProfile.maxTokens ?? 4096),
          providerOptions: usesCodexOAuth ? buildCodexOAuthProviderOptions(finalizeSystemPrompt) : undefined,
        });
        const parsedFinalize = extractThinking(String(finalizeResult.text || ''), reasoningText || null);
        if (parsedFinalize.thinking) reasoningText = parsedFinalize.thinking;
        const candidate = parsedFinalize.content.trim();
        if (isValidFinalResponse(candidate, { allowEmpty: false })) {
          finalText = candidate;
          const finalizeUsage = (
            finalizeResult as { usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } }
          ).usage;
          totalUsage = {
            inputTokens: (totalUsage.inputTokens || 0) + Number(finalizeUsage?.inputTokens || 0),
            outputTokens: (totalUsage.outputTokens || 0) + Number(finalizeUsage?.outputTokens || 0),
            totalTokens: (totalUsage.totalTokens || 0) + Number(finalizeUsage?.totalTokens || 0),
          };
        }
      }
      if (!finalText) {
        prepared.ctx.sendRuntime(prepared.runMeta, {
          type: 'run_error',
          message: 'Model failed to produce a valid final response after retries.',
          errorCategory: 'finalize',
          action: 'Try a different model, increase maxTokens, or disable streaming if enabled.',
          recoverable: true,
          latency: buildLatencyMetrics(),
          benchmark: buildBenchmarkContext(false, 'finalize'),
        });
        return null;
      }
    }

    const materialized = buildResponseMessages(finalText, reasoningText || null, toolResults);
    responseMessages = materialized.responseMessages;
    break;
  }

  return { finalText, reasoningText, totalUsage, responseMessages, currentHistory: prepared.currentHistory };
}

function buildToolDigest(toolResults: Array<Record<string, unknown>>) {
  if (!toolResults.length) return '';
  const items = toolResults.slice(-10).map((result) => ({
    tool: result.toolName || 'tool',
    args: result.input || result.args || {},
    output: result.output ?? null,
  }));
  const raw = JSON.stringify(items);
  return raw.length > 12_000 ? `${raw.slice(0, 12_000)}...` : raw;
}
