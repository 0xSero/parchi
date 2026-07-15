import { type TestRunner, log } from '../shared/runner.js';

export async function runToolSchemaConversionSuite(runner: TestRunner) {
  log('\n=== Testing Tool Schema Conversion ===', 'info');

  await runner.test('Convert to OpenAI format', () => {
    const tool = {
      name: 'test_tool',
      description: 'Test description',
      input_schema: {
        type: 'object',
        properties: {
          param1: { type: 'string' },
        },
        required: ['param1'],
      },
    };

    const openaiFormat = {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    };

    runner.assertEqual(openaiFormat.type, 'function');
    runner.assertEqual(openaiFormat.function.name, 'test_tool');
  });

  await runner.test('Convert to Anthropic format', () => {
    const tool = {
      name: 'test_tool',
      description: 'Test description',
      input_schema: {
        type: 'object',
        properties: {
          param1: { type: 'string' },
        },
        required: ['param1'],
      },
    };

    const anthropicFormat = {
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    };

    runner.assertEqual(anthropicFormat.name, 'test_tool');
    runner.assertTrue(anthropicFormat.input_schema.properties.param1);
  });
}
