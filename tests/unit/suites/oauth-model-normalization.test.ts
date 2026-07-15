import { mergeProviderModels } from '../../../packages/extension/ai/providers/instance-models.js';
import { extractModelEntriesRich } from '../../../packages/extension/oauth/model-listing.js';
import {
  normalizeOAuthModelIdForProvider,
  normalizeOAuthModelIdsForProvider,
} from '../../../packages/extension/oauth/model-normalization.js';
import { OAUTH_PROVIDERS } from '../../../packages/extension/oauth/providers.js';
import { computeConfiguredContextLimit } from '../../../packages/extension/sidepanel/ui/chat/panel-context.js';
import { type TestRunner, log } from '../shared/runner.js';

export async function runOauthModelNormalizationSuite(runner: TestRunner) {
  log('\n=== Testing OAuth Model Normalization ===', 'info');

  await runner.test('Copilot prefixed model IDs are normalized', () => {
    runner.assertEqual(normalizeOAuthModelIdForProvider('copilot-oauth', 'copilot/claude-sonnet-4'), 'claude-sonnet-4');
    runner.assertEqual(normalizeOAuthModelIdForProvider('copilot', 'github-copilot/gpt-4o'), 'gpt-4o');
  });

  await runner.test('Codex prefixed model IDs are normalized', () => {
    runner.assertEqual(normalizeOAuthModelIdForProvider('codex-oauth', 'openai/gpt-5.2'), 'gpt-5.2');
  });

  await runner.test('Non-prefixed OAuth model IDs remain unchanged', () => {
    runner.assertEqual(normalizeOAuthModelIdForProvider('qwen-oauth', 'qwen-max'), 'qwen-max');
  });

  await runner.test('Namespaced OAuth model IDs collapse to final raw model segment', () => {
    runner.assertEqual(
      normalizeOAuthModelIdForProvider('copilot-oauth', 'openrouter/moonshotai/kimi-k2.5'),
      'kimi-k2.5',
    );
  });

  await runner.test('Copilot shorthand Anthropic names normalize to claude-* slugs', () => {
    runner.assertEqual(normalizeOAuthModelIdForProvider('copilot-oauth', 'copilot/sonnet-4.6'), 'claude-sonnet-4.6');
    runner.assertEqual(normalizeOAuthModelIdForProvider('copilot-oauth', 'opus-4.6'), 'claude-opus-4.6');
  });

  await runner.test('Normalization handles empty provider keys, empty models, and deduplicates batches', () => {
    runner.assertEqual(normalizeOAuthModelIdForProvider('', 'gpt-4.1'), 'gpt-4.1');
    runner.assertEqual(normalizeOAuthModelIdForProvider('copilot-oauth', 'copilot/'), '');
    runner.assertEqual(normalizeOAuthModelIdForProvider('copilot-oauth', ''), '');
    runner.assertEqual(normalizeOAuthModelIdsForProvider('copilot-oauth', ['copilot/gpt-4o', 'gpt-4o', '']), [
      'gpt-4o',
    ]);
  });

  log('\n=== Testing OAuth Model Normalization (xAI / Grok) ===', 'info');

  await runner.test('xAI / Grok prefixed model IDs are normalized', () => {
    runner.assertEqual(normalizeOAuthModelIdForProvider('xai-oauth', 'xai/grok-4'), 'grok-4');
    runner.assertEqual(normalizeOAuthModelIdForProvider('xai', 'grok/grok-build-0.1'), 'grok-build-0.1');
  });

  await runner.test('Non-prefixed Grok model IDs remain unchanged', () => {
    runner.assertEqual(normalizeOAuthModelIdForProvider('xai-oauth', 'grok-4'), 'grok-4');
  });

  await runner.test('Namespaced Grok OAuth model IDs collapse to final raw model segment', () => {
    runner.assertEqual(normalizeOAuthModelIdForProvider('xai-oauth', 'xai/vendor/grok-3'), 'grok-3');
  });

  await runner.test('Grok normalization handles empty provider keys, empty models, and deduplicates batches', () => {
    runner.assertEqual(normalizeOAuthModelIdForProvider('', 'grok-4'), 'grok-4');
    runner.assertEqual(normalizeOAuthModelIdForProvider('xai-oauth', 'xai/'), '');
    runner.assertEqual(normalizeOAuthModelIdForProvider('xai-oauth', ''), '');
    runner.assertEqual(normalizeOAuthModelIdsForProvider('xai-oauth', ['xai/grok-4', 'grok-4', '']), ['grok-4']);
  });

  await runner.test(
    'extractModelEntriesRich pulls contextWindow from api data (context_length or contextWindow) for grok models',
    () => {
      const entries = extractModelEntriesRich({
        data: [
          { id: 'grok-test-128k', context_length: 128000 },
          { id: 'grok-test-256k', contextWindow: 256000 },
          { id: 'grok-noctx' },
        ],
      });
      runner.assertEqual(entries.find((e) => e.id === 'grok-test-128k')?.contextWindow, 128000);
      runner.assertEqual(entries.find((e) => e.id === 'grok-test-256k')?.contextWindow, 256000);
      runner.assertEqual(entries.find((e) => e.id === 'grok-noctx')?.contextWindow, undefined);
    },
  );

  await runner.test(
    'mergeProviderModels takes context from API entries (later sources) over static fallback for xai',
    () => {
      const staticModels = OAUTH_PROVIDERS.xai?.models || [];
      const apiEntries = [
        { id: 'grok-foo', contextWindow: 128000 },
        { id: 'grok-bar', contextWindow: 131072 },
      ];
      const merged = mergeProviderModels('xai-oauth', staticModels, apiEntries);
      runner.assertEqual(merged.find((m) => m.id === 'grok-foo')?.contextWindow, 128000);
      runner.assertEqual(merged.find((m) => m.id === 'grok-bar')?.contextWindow, 131072);
      // a model only in static keeps its value
      const build = merged.find((m) => m.id === 'grok-build-0.1');
      runner.assertEqual(build?.contextWindow, 256000);
    },
  );

  await runner.test(
    'computeConfiguredContextLimit returns profile contextLimit for grok models (no 256k force)',
    () => {
      const activeWith128k = { model: 'grok-4', contextLimit: 128000 };
      runner.assertEqual(computeConfiguredContextLimit(activeWith128k), 128000);
      const activeWithApi = { model: 'grok-build-0.1', contextLimit: 131072 };
      runner.assertEqual(computeConfiguredContextLimit(activeWithApi), 131072);
      const activeNoLimitGrok = { model: 'grok-foo' };
      runner.assertEqual(computeConfiguredContextLimit(activeNoLimitGrok), 200000);
    },
  );
}
