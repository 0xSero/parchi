import { buildRunPlan } from '@parchi/shared';
import type { RunPlan } from '@parchi/shared';

export function extractXmlToolCalls(text: string): Array<{ name: string; args: Record<string, unknown>; raw: string }> {
  if (!text || typeof text !== 'string') return [];
  const results: Array<{ name: string; args: Record<string, unknown>; raw: string }> = [];
  const blocks: string[] = [];

  const blockRegex = /<\s*(?:tool|function)_call[^>]*>[\s\S]*?<\s*\/\s*(?:tool|function)_call\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(text))) {
    blocks.push(match[0]);
  }

  const inlineRegex = /([A-Za-z0-9_]+)\s*<\s*argkey\s*>[\s\S]*?<\s*\/\s*tool_call\s*>/gi;
  while ((match = inlineRegex.exec(text))) {
    blocks.push(match[0]);
  }

  if (!blocks.length && /<\s*argkey\s*>/i.test(text)) {
    blocks.push(text);
  }

  for (const block of blocks) {
    const name = extractXmlToolName(block);
    if (!name) continue;
    const args = extractXmlArgs(block);
    results.push({ name, args, raw: block });
  }

  return results;
}

export function extractXmlToolName(block: string): string {
  const nameMatch =
    block.match(/<\s*(?:tool|function)_name\s*>([^<]+)<\s*\/\s*(?:tool|function)_name\s*>/i) ||
    block.match(/<\s*name\s*>([^<]+)<\s*\/\s*name\s*>/i) ||
    block.match(/<\s*tool\s*>([^<]+)<\s*\/\s*tool\s*>/i) ||
    block.match(/<\s*function\s*>([^<]+)<\s*\/\s*function\s*>/i) ||
    block.match(/([A-Za-z0-9_]+)\s*<\s*argkey\s*>/i);

  if (!nameMatch) return '';
  const name = nameMatch[1] ? String(nameMatch[1]) : '';
  return name.trim();
}

export function extractXmlArgs(block: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const pairRegex = /<\s*argkey\s*>([\s\S]*?)<\s*\/\s*argkey\s*>\s*<\s*argvalue\s*>([\s\S]*?)<\s*\/\s*argvalue\s*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pairRegex.exec(block))) {
    const key = String(match[1] || '').trim();
    const value = coerceXmlArgValue(String(match[2] || '').trim());
    if (key) args[key] = value;
  }

  const namedRegex = /<\s*arg\s+name\s*=\s*['\"]?([^'\">]+)['\"]?\s*>([\s\S]*?)<\s*\/\s*arg\s*>/gi;
  while ((match = namedRegex.exec(block))) {
    const key = String(match[1] || '').trim();
    const value = coerceXmlArgValue(String(match[2] || '').trim());
    if (key) args[key] = value;
  }

  return args;
}

export function coerceXmlArgValue(value: string): unknown {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (!Number.isNaN(Number(trimmed)) && trimmed.length < 18) return Number(trimmed);
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export function stripXmlToolCalls(text: string): string {
  if (!text || typeof text !== 'string') return text;
  let cleaned = text;
  cleaned = cleaned.replace(/<\s*(?:tool|function)_call[^>]*>[\s\S]*?<\s*\/\s*(?:tool|function)_call\s*>/gi, '');
  cleaned = cleaned.replace(/[A-Za-z0-9_]+\s*<\s*argkey\s*>[\s\S]*?<\s*\/\s*tool_call\s*>/gi, '');
  cleaned = cleaned.replace(/<\s*argkey\s*>[\s\S]*?<\s*\/\s*argvalue\s*>/gi, '');
  return cleaned.trim();
}

export function parsePlanSteps(text: string) {
  if (!text) return [];
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*[-*]\s*/, '')
        .replace(/^\s*\d+[.)]\s*/, '')
        .trim(),
    )
    .filter(Boolean);
}

export function buildPlanFromArgs(args: Record<string, unknown>, existingPlan?: RunPlan | null) {
  const stepInput = Array.isArray(args?.steps) ? args.steps : null;
  const planText = typeof args?.plan === 'string' ? args.plan : '';
  const parsedSteps = planText ? parsePlanSteps(planText) : [];
  const combined = stepInput && stepInput.length ? stepInput : parsedSteps;
  if (!combined || combined.length === 0) return null;
  return buildRunPlan(combined, {
    existingPlan: existingPlan || null,
    maxSteps: 12,
  });
}
