#!/usr/bin/env node

/**
 * API Smoke Tests
 * Requires provider API keys in environment variables.
 */

import { streamText } from 'ai';
import { extractTextFromResponseMessages } from '../../packages/extension/ai/messages/utils.js';
import { resolveLanguageModel } from '../../packages/extension/ai/sdk/index.js';

const colors = {
  info: '\x1b[36m',
  success: '\x1b[32m',
  error: '\x1b[31m',
  warning: '\x1b[33m',
  reset: '\x1b[0m',
} as const;

function log(message: string, type: keyof typeof colors = 'info') {
  console.log(`${colors[type]}${message}${colors.reset}`);
}

const readEnv = (key: string) => {
  const raw = process.env[key];
  return typeof raw === 'string' ? raw.trim() : '';
};

type ProviderSpec = {
  label: string;
  provider: 'openai' | 'anthropic' | 'kimi' | 'custom';
  apiKeyEnv: string;
  modelEnv: string;
  endpointEnv?: string;
  defaultModel?: string;
};

const providers: ProviderSpec[] = [
  {
    label: 'OpenAI',
    provider: 'openai',
    apiKeyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MODEL',
    defaultModel: 'gpt-4o',
  },
  {
    label: 'Anthropic',
    provider: 'anthropic',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    modelEnv: 'ANTHROPIC_MODEL',
  },
  {
    label: 'Kimi',
    provider: 'kimi',
    apiKeyEnv: 'KIMI_API_KEY',
    modelEnv: 'KIMI_MODEL',
    endpointEnv: 'KIMI_BASE_URL',
  },
  {
    label: 'Custom',
    provider: 'custom',
    apiKeyEnv: 'CUSTOM_API_KEY',
    modelEnv: 'CUSTOM_MODEL',
    endpointEnv: 'CUSTOM_ENDPOINT',
  },
];

async function runProvider(spec: ProviderSpec) {
  const apiKey = readEnv(spec.apiKeyEnv);
  if (!apiKey) {
    log(`- ${spec.label}: skipped (missing ${spec.apiKeyEnv})`, 'warning');
    return { skipped: true };
  }

  const model = readEnv(spec.modelEnv) || spec.defaultModel || '';
  if (!model) {
    log(`- ${spec.label}: skipped (missing ${spec.modelEnv})`, 'warning');
    return { skipped: true };
  }

  const customEndpoint = spec.endpointEnv ? readEnv(spec.endpointEnv) : '';
  const modelInstance = resolveLanguageModel({
    provider: spec.provider,
    apiKey,
    model,
    customEndpoint: customEndpoint || undefined,
  });

  const prompt = 'Reply with the word "pong" only.';

  const result = streamText({
    model: modelInstance,
    messages: [{ role: 'user', content: prompt }],
    maxOutputTokens: 32,
  });

  let rawText = '';
  let responseMessages: unknown = null;
  try {
    [rawText, responseMessages] = await Promise.all([result.text, (result as any).responseMessages]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    throw new Error(`${spec.label} request failed: ${message}`);
  }

  const fallbackText = extractTextFromResponseMessages(responseMessages);
  const resolvedText = (rawText || fallbackText || '').trim();

  if (!resolvedText) {
    throw new Error(`${spec.label} returned empty text (raw + fallback).`);
  }

  if (!resolvedText.toLowerCase().includes('pong')) {
    throw new Error(`${spec.label} unexpected response: ${resolvedText.slice(0, 200)}`);
  }

  const usedFallback = !rawText || !rawText.trim();
  const suffix = usedFallback ? ' (used responseMessages fallback)' : '';
  log(`✓ ${spec.label}: OK${suffix}`, 'success');
  return { skipped: false };
}

async function main() {
  log('╔════════════════════════════════════════╗', 'info');
  log('║        API Smoke Tests (Live)         ║', 'info');
  log('╚════════════════════════════════════════╝', 'info');

  let ranAny = false;
  let failed = false;

  for (const spec of providers) {
    try {
      const result = await runProvider(spec);
      if (!result.skipped) ranAny = true;
    } catch (error) {
      failed = true;
      const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
      log(`✗ ${spec.label}: ${message}`, 'error');
    }
  }

  if (!ranAny) {
    log('No API credentials configured. Set at least one provider env var to run tests.', 'warning');
  }

  if (failed) {
    log('API smoke tests failed.', 'error');
    process.exit(1);
  }

  log('API smoke tests complete.', 'success');
  process.exit(0);
}

main();
