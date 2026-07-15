import { resolveModelCapabilities } from '../../../packages/extension/ai/providers/model-capabilities.js';
import { extractModelEntries } from '../../../packages/extension/ai/providers/model-listing.js';
import { isVisionModelProfile } from '../../../packages/extension/background/model-profiles.js';
import { type TestRunner, log } from '../shared/runner.js';

export async function runModelCapabilitiesSuite(runner: TestRunner) {
  log('\n=== Testing Model Capabilities ===', 'info');

  await runner.test('resolveModelCapabilities treats Anthropic and Claude OAuth as always vision-capable', () => {
    runner.assertTrue(resolveModelCapabilities('anthropic', 'claude-3-5-haiku-20241022').supportsVision);
    runner.assertTrue(resolveModelCapabilities('claude-oauth', 'claude-opus-4-6-20260204').supportsVision);
  });

  await runner.test('resolveModelCapabilities treats every Kimi model as vision-capable', () => {
    runner.assertTrue(resolveModelCapabilities('kimi', 'kimi-k2-thinking').supportsVision);
    runner.assertTrue(resolveModelCapabilities('kimi', 'kimi-k2.5').supportsVision);
  });

  await runner.test('resolveModelCapabilities matches GLM vision variants only', () => {
    runner.assertTrue(resolveModelCapabilities('glm', 'glm-4.6v').supportsVision);
    runner.assertFalse(resolveModelCapabilities('glm', 'glm-4.6').supportsVision);
  });

  await runner.test('resolveModelCapabilities matches MiniMax vision variants only', () => {
    runner.assertTrue(resolveModelCapabilities('minimax', 'minimax-m2-vision').supportsVision);
    runner.assertFalse(resolveModelCapabilities('minimax', 'MiniMax-M2.7').supportsVision);
  });

  await runner.test('resolveModelCapabilities matches Codex/Copilot OAuth gpt-4o and vision models', () => {
    runner.assertTrue(resolveModelCapabilities('codex-oauth', 'gpt-4o').supportsVision);
    runner.assertTrue(resolveModelCapabilities('copilot-oauth', 'copilot/gpt-4o').supportsVision);
    runner.assertFalse(resolveModelCapabilities('codex-oauth', 'gpt-5.2').supportsVision);
  });

  await runner.test('resolveModelCapabilities matches OpenRouter/Parchi known vision-capable model families', () => {
    runner.assertTrue(resolveModelCapabilities('openrouter', 'anthropic/claude-sonnet-4.6').supportsVision);
    runner.assertTrue(resolveModelCapabilities('parchi', 'openai/gpt-4o').supportsVision);
    runner.assertFalse(resolveModelCapabilities('openrouter', 'mistralai/mistral-large').supportsVision);
  });

  await runner.test('resolveModelCapabilities matches OpenAI gpt-4o/4.1/vision model families', () => {
    runner.assertTrue(resolveModelCapabilities('openai', 'gpt-4o-mini').supportsVision);
    runner.assertTrue(resolveModelCapabilities('openai', 'gpt-4.1').supportsVision);
    runner.assertFalse(resolveModelCapabilities('openai', 'gpt-3.5-turbo').supportsVision);
  });

  await runner.test('resolveModelCapabilities matches legacy google provider gemini/imagen models', () => {
    runner.assertTrue(resolveModelCapabilities('google', 'gemini-2.5-pro').supportsVision);
    runner.assertFalse(resolveModelCapabilities('google', 'text-bison').supportsVision);
  });

  await runner.test('resolveModelCapabilities falls back to a bare "vision" match for unknown providers', () => {
    runner.assertTrue(resolveModelCapabilities('some-custom-provider', 'foo-vision-model').supportsVision);
    runner.assertFalse(resolveModelCapabilities('some-custom-provider', 'foo-model').supportsVision);
  });

  await runner.test('resolveModelCapabilities returns false with no provider', () => {
    runner.assertFalse(resolveModelCapabilities('', 'gpt-4o').supportsVision);
  });

  await runner.test('resolveModelCapabilities prefers an explicit static ModelEntry.supportsVision flag', () => {
    // kimi-k2.5 is statically flagged supportsVision:true in ai/providers/definitions.ts,
    // agreeing with the provider-wide kimi rule.
    runner.assertTrue(resolveModelCapabilities('kimi', 'kimi-k2.5').supportsVision);
  });

  await runner.test('isVisionModelProfile preserves prior behavior for every previously-handled provider', () => {
    runner.assertTrue(isVisionModelProfile({ provider: 'anthropic', model: 'claude-sonnet-4' }));
    runner.assertTrue(isVisionModelProfile({ provider: 'claude-oauth', model: 'claude-sonnet-4' }));
    runner.assertTrue(isVisionModelProfile({ provider: 'kimi', model: 'kimi-k2-turbo-preview' }));
    runner.assertTrue(isVisionModelProfile({ provider: 'glm', model: 'GLM-4.6V' }));
    runner.assertFalse(isVisionModelProfile({ provider: 'glm', model: 'glm-4.6' }));
    runner.assertTrue(isVisionModelProfile({ provider: 'minimax', model: 'minimax-vision' }));
    runner.assertTrue(isVisionModelProfile({ provider: 'codex-oauth', model: 'gpt-4o' }));
    runner.assertTrue(isVisionModelProfile({ provider: 'copilot-oauth', model: 'gpt-4o' }));
    runner.assertTrue(isVisionModelProfile({ provider: 'openrouter', model: 'google/gemini-2.5-pro' }));
    runner.assertTrue(isVisionModelProfile({ provider: 'parchi', model: 'anthropic/claude-sonnet-4.6' }));
    runner.assertTrue(isVisionModelProfile({ provider: 'openai', model: 'gpt-4-vision-preview' }));
    runner.assertFalse(isVisionModelProfile({ provider: 'openai', model: 'gpt-3.5-turbo' }));
    runner.assertTrue(isVisionModelProfile({ provider: 'google', model: 'imagen-3' }));
    runner.assertFalse(isVisionModelProfile({ provider: '' }));
    runner.assertTrue(isVisionModelProfile({ provider: 'some-other-provider', model: 'vision-model' }));
  });

  await runner.test(
    'extractModelEntries backfills supportsVision via capability rules when given a provider key',
    () => {
      const entries = extractModelEntries({ data: [{ id: 'gpt-4o' }, { id: 'gpt-3.5-turbo' }, 'gpt-4.1'] }, 'openai');
      runner.assertEqual(
        entries.map((e) => ({ id: e.id, supportsVision: e.supportsVision === true })),
        [
          { id: 'gpt-4o', supportsVision: true },
          { id: 'gpt-3.5-turbo', supportsVision: false },
          { id: 'gpt-4.1', supportsVision: true },
        ],
      );
    },
  );

  await runner.test('extractModelEntries does not compute supportsVision when no provider key is given', () => {
    const entries = extractModelEntries({ data: [{ id: 'gpt-4o' }] });
    runner.assertEqual(entries, [{ id: 'gpt-4o', label: 'gpt-4o' }]);
  });
}
