import {
  isLikelyTextGenerationModelId,
  prioritizeOAuthModelCandidates,
} from '../../../packages/extension/oauth/model-candidates.js';
import { OAUTH_PROVIDERS } from '../../../packages/extension/oauth/providers.js';
import { type TestRunner, log } from '../shared/runner.js';

export async function runOauthCandidatesSuite(runner: TestRunner) {
  log('\n=== Testing OAuth Model Candidate Prioritization ===', 'info');

  await runner.test('Non-text model IDs are filtered out', () => {
    runner.assertFalse(isLikelyTextGenerationModelId('codex', 'text-embedding-3-large'));
    runner.assertFalse(isLikelyTextGenerationModelId('codex', 'gpt-image-1'));
    runner.assertTrue(isLikelyTextGenerationModelId('codex', 'gpt-4o'));
    runner.assertTrue(isLikelyTextGenerationModelId('copilot', 'claude-sonnet-4'));
  });

  await runner.test('Known supported OAuth models are prioritized when discovered list is noisy', () => {
    const prioritized = prioritizeOAuthModelCandidates(
      'codex',
      ['babbage-002', 'text-embedding-3-small', 'gpt-4o-mini', 'gpt-4o'],
      ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    );
    runner.assertEqual(prioritized[0], 'gpt-4o');
    runner.assertTrue(prioritized.includes('gpt-4o-mini'));
    runner.assertFalse(prioritized.includes('text-embedding-3-small'));
  });

  await runner.test('Copilot static OAuth catalog includes Sonnet 4.5 and Gemini 3 Pro preview IDs', () => {
    const copilotModels = OAUTH_PROVIDERS.copilot.models.map((model) => model.id);
    runner.assertTrue(copilotModels.includes('claude-sonnet-4.5'));
    runner.assertTrue(copilotModels.includes('gemini-3-pro-preview'));
    runner.assertTrue(copilotModels.includes('gemini-3.1-pro-preview'));
  });

  await runner.test('Provider-specific text heuristics and dedupe behavior cover fallback branches', () => {
    runner.assertTrue(isLikelyTextGenerationModelId('claude-oauth', 'claude-3-haiku'));
    runner.assertTrue(isLikelyTextGenerationModelId('qwen-oauth', 'my-qwen-model'));
    runner.assertTrue(isLikelyTextGenerationModelId('copilot-oauth', 'mistral-large'));
    runner.assertFalse(isLikelyTextGenerationModelId('copilot-oauth', 'audio-preview'));
    runner.assertFalse(isLikelyTextGenerationModelId('codex-oauth', ''));
    runner.assertTrue(isLikelyTextGenerationModelId('unknown-oauth', 'custom-chat-model'));

    runner.assertEqual(prioritizeOAuthModelCandidates('claude', [], ['claude-sonnet-4.5', 'claude-sonnet-4.5']), [
      'claude-sonnet-4.5',
    ]);
  });
}
