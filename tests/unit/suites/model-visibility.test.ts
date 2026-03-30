import {
  getEffectiveVisibleModelKeys,
  isDefaultVisibleModel,
} from '../../../packages/extension/sidepanel/ui/status/model-visibility.js';
import { type TestRunner, log } from '../shared/runner.js';

export function runModelVisibilitySuite(runner: TestRunner) {
  log('\n=== Testing Model Visibility Defaults ===', 'info');

  runner.test('default visibility trims OpenAI and Anthropic to latest-generation models', () => {
    const visible = getEffectiveVisibleModelKeys(
      [
        {
          id: 'openai-provider',
          provider: 'openai',
          models: [
            { id: 'gpt-5.3', label: 'GPT-5.3' },
            { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
            { id: 'gpt-5.2', label: 'GPT-5.2' },
          ],
        },
        {
          id: 'anthropic-provider',
          provider: 'anthropic',
          models: [
            { id: 'claude-sonnet-4-6-20260220', label: 'Claude Sonnet 4.6' },
            { id: 'claude-opus-4-6-20260204', label: 'Claude Opus 4.6' },
            { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
          ],
        },
      ],
      [],
    );

    runner.assertEqual(visible, [
      'openai-provider::gpt-5.3',
      'openai-provider::gpt-5.3-codex',
      'anthropic-provider::claude-sonnet-4-6-20260220',
      'anthropic-provider::claude-opus-4-6-20260204',
    ]);
  });

  runner.test('explicit visible models override the default curated list', () => {
    const visible = getEffectiveVisibleModelKeys(
      [{ id: 'openai-provider', provider: 'openai', models: [{ id: 'gpt-5.3' }, { id: 'gpt-5.2' }] }],
      ['openai-provider::gpt-5.2'],
    );

    runner.assertEqual(visible, ['openai-provider::gpt-5.2']);
  });

  runner.test('providers without curated defaults fall back to showing all models', () => {
    const visible = getEffectiveVisibleModelKeys(
      [{ id: 'qwen-provider', provider: 'qwen-oauth', models: [{ id: 'qwen-max' }, { id: 'qwen-plus' }] }],
      [],
    );

    runner.assertEqual(visible, ['qwen-provider::qwen-max', 'qwen-provider::qwen-plus']);
    runner.assertEqual(isDefaultVisibleModel('qwen-oauth', 'qwen-max'), false);
  });
}
