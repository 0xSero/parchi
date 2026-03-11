import { SidePanelUI } from '../core/panel-ui.js';
const sidePanelProto = SidePanelUI.prototype as SidePanelUI & Record<string, unknown>;

// Rough chars-per-token ratio (conservative; real tokenizers vary).
const CHARS_PER_TOKEN = 3.5;
const MAX_CONTEXT_TOKENS = 100_000;
const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;

sidePanelProto.buildSessionContext = function buildSessionContext(): string {
  const sections: string[] = [];

  // --- 1. Display history (user + assistant messages) -----------------
  if (this.displayHistory?.length) {
    for (const entry of this.displayHistory) {
      const text = this.extractTextContent?.(entry.content) || String(entry.content || '');
      if (!text.trim()) continue;
      if (entry.role === 'user') {
        sections.push(`[User]: ${text}`);
      } else if (entry.role === 'assistant') {
        if (entry.thinking) sections.push(`[Assistant thinking]: ${entry.thinking}`);
        sections.push(`[Assistant]: ${text}`);
      } else if (entry.role === 'system' && entry.meta?.kind === 'summary') {
        sections.push(`[Context summary]: ${text}`);
      }
    }
  }

  // --- 2. Turn-level detail (tool events, plans) ----------------------
  if (this.historyTurnMap?.size) {
    sections.push('\n=== DETAILED TURN LOG ===');
    this.historyTurnMap.forEach((turn: any, turnId: string) => {
      sections.push(`\n--- Turn ${turnId} ---`);
      if (turn.userMessage) sections.push(`[User]: ${turn.userMessage}`);

      if (turn.plan?.steps?.length) {
        const planLines = turn.plan.steps.map((s: any) => `  ${s.status === 'done' ? '[x]' : '[ ]'} ${s.title}`);
        sections.push(`[Plan]:\n${planLines.join('\n')}`);
      }

      if (turn.toolEvents?.length) {
        for (const ev of turn.toolEvents) {
          if (ev.type === 'tool_execution_start') {
            const argsStr = ev.args ? JSON.stringify(ev.args) : '';
            sections.push(`[Tool call] ${ev.tool}(${argsStr})`);
          } else if (ev.type === 'tool_execution_result') {
            const resultStr = ev.result != null ? JSON.stringify(ev.result) : '';
            // Truncate very large results to save context budget
            const truncated = resultStr.length > 2000 ? resultStr.slice(0, 2000) + '...(truncated)' : resultStr;
            sections.push(`[Tool result] ${ev.tool}: ${truncated}`);
          }
        }
      }

      if (turn.assistantFinal) {
        if (turn.assistantFinal.thinking) {
          sections.push(`[Assistant thinking]: ${turn.assistantFinal.thinking}`);
        }
        if (turn.assistantFinal.content) {
          sections.push(`[Assistant]: ${turn.assistantFinal.content}`);
        }
      }
    });
  }

  // --- 3. Current plan ------------------------------------------------
  if (this.currentPlan?.steps?.length) {
    const planLines = this.currentPlan.steps.map((s: any) => `  ${s.status === 'done' ? '[x]' : '[ ]'} ${s.title}`);
    sections.push(`\n=== CURRENT PLAN ===\n${planLines.join('\n')}`);
  }

  // --- 4. Context history (the raw message array sent to the model) ---
  // This often contains richer detail than displayHistory (tool results, etc.)
  if (this.contextHistory?.length) {
    sections.push('\n=== RAW CONTEXT MESSAGES ===');
    for (const msg of this.contextHistory) {
      const text = this.extractTextContent?.(msg.content) || String(msg.content || '');
      if (!text.trim()) continue;
      sections.push(`[${msg.role}]: ${text}`);
      if (msg.thinking) sections.push(`[thinking]: ${msg.thinking}`);
      if (Array.isArray(msg.toolCalls) && msg.toolCalls.length) {
        for (const tc of msg.toolCalls) {
          sections.push(`[tool_call] ${tc.name}(${JSON.stringify(tc.args || {})})`);
        }
      }
    }
  }

  let full = sections.join('\n\n');

  // Trim to fit within the token budget. Priority: keep the beginning
  // (initial request) and the end (most recent context). If we need to
  // trim, cut from the middle.
  if (full.length > MAX_CONTEXT_CHARS) {
    const headBudget = Math.floor(MAX_CONTEXT_CHARS * 0.35);
    const tailBudget = Math.floor(MAX_CONTEXT_CHARS * 0.6);
    const head = full.slice(0, headBudget);
    const tail = full.slice(full.length - tailBudget);
    full = head + '\n\n[...middle of session omitted for brevity...]\n\n' + tail;
  }

  return full;
};

sidePanelProto.generateWorkflowFromSession = async function generateWorkflowFromSession(): Promise<{
  name: string;
  prompt: string;
  positiveExamples: Array<{ tool: string; args: any; result: string }>;
  negativeExamples: Array<{ tool: string; args: any; error: string; count: number }>;
} | null> {
  const context = this.buildSessionContext();
  if (!context.trim()) return null;

  const positiveExamples: Array<{ tool: string; args: any; result: string }> = [];
  const negativeExamples: Array<{ tool: string; args: any; error: string; count: number }> = [];
  const failureCounts = new Map<string, number>();

  if (this.historyTurnMap?.size) {
    this.historyTurnMap.forEach((turn: any) => {
      if (!turn.toolEvents?.length) return;
      for (const ev of turn.toolEvents) {
        if (ev.type !== 'tool_execution_result') continue;
        const key = `${ev.tool}:${ev.args?.selector || ev.args?.url || ''}`;
        if (ev.result?.success === false || ev.result?.error) {
          const count = (failureCounts.get(key) || 0) + 1;
          failureCounts.set(key, count);
          if (count <= 1) {
            // Only first failure of each type
            negativeExamples.push({ tool: ev.tool, args: ev.args || {}, error: String(ev.result?.error || ''), count });
          }
        } else {
          positiveExamples.push({
            tool: ev.tool,
            args: ev.args || {},
            result: JSON.stringify(ev.result || {}).slice(0, 200),
          });
        }
      }
    });
  }

  const response = await chrome.runtime.sendMessage({
    type: 'generate_workflow',
    sessionContext: context,
    maxOutputTokens: 4096,
  });

  if (!response?.success || !response.result?.prompt) {
    const err = response?.result?.error || response?.error || 'Generation failed';
    throw new Error(err);
  }

  // Derive a suggested name from the first user message
  const firstUser = (this.displayHistory || []).find((m: any) => m.role === 'user');
  const firstText = firstUser
    ? (this.extractTextContent?.(firstUser.content) || '').toLowerCase().replace(/[^a-z0-9\s]/g, '')
    : '';
  const words = firstText.split(/\s+/).filter(Boolean).slice(0, 3);
  const suggestedName = words.join('-') || 'workflow';

  return { name: suggestedName, prompt: response.result.prompt, positiveExamples, negativeExamples };
};
