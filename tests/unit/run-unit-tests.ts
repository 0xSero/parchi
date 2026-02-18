#!/usr/bin/env node

/**
 * Unit Test Runner
 * Tests individual components without Chrome APIs
 */

import {
  DEFAULT_COMPACTION_SETTINGS,
  applyCompaction,
  buildCompactionSummaryMessage,
  estimateContextTokens,
  shouldCompact,
} from '../../packages/extension/ai/compaction.js';
import {
  createMessage,
  normalizeConversationHistory,
  toProviderMessages,
} from '../../packages/extension/ai/message-schema.js';
import type { Message } from '../../packages/extension/ai/message-schema.js';
import { extractThinking } from '../../packages/extension/ai/message-utils.js';
import { createExponentialBackoff, isValidFinalResponse } from '../../packages/extension/ai/retry-engine.js';

import { buildRunPlan, normalizePlanStatus, normalizePlanSteps } from '../../packages/shared/src/plan.js';
import type { RunPlan } from '../../packages/shared/src/plan.js';
import { RUNTIME_MESSAGE_SCHEMA_VERSION, isRuntimeMessage } from '../../packages/shared/src/runtime-messages.js';
import type { RuntimeMessage } from '../../packages/shared/src/runtime-messages.js';

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

type ToolSchema = {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
};

type ToolDefinition = {
  name: string;
  description: string;
  input_schema: ToolSchema;
};

type ProviderConfig = {
  provider: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  customEndpoint?: string;
};

class TestRunner {
  passed: number;
  failed: number;
  errors: Array<{ test: string; error: string }>;

  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }

  test(description: string, fn: () => void) {
    try {
      fn();
      this.passed++;
      log(`✓ ${description}`, 'success');
      return true;
    } catch (error) {
      const err = error as Error;
      this.failed++;
      this.errors.push({ test: description, error: err.message });
      log(`✗ ${description}: ${err.message}`, 'error');
      return false;
    }
  }

  assertEqual(actual: unknown, expected: unknown, message = '') {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
    }
  }

  assertTrue(condition: unknown, message = 'Assertion failed') {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertFalse(condition: unknown, message = 'Assertion failed') {
    if (condition) {
      throw new Error(message);
    }
  }

  assertThrows(fn: () => void, message = 'Should have thrown an error') {
    try {
      fn();
      throw new Error(message);
    } catch (error) {
      const err = error as Error;
      if (err.message === message) {
        throw err;
      }
      // Expected error
    }
  }

  printSummary() {
    log('\n=== Unit Test Summary ===', 'info');
    log(`Tests Passed: ${this.passed}`, 'success');

    if (this.failed > 0) {
      log(`Tests Failed: ${this.failed}`, 'error');
      log('\nFailed Tests:', 'error');
      this.errors.forEach((e) => {
        log(`  ${e.test}:`, 'error');
        log(`    ${e.error}`, 'error');
      });
    }

    if (this.failed === 0) {
      log('\n✓ All unit tests passed!', 'success');
      return true;
    } else {
      log('\n✗ Some unit tests failed!', 'error');
      return false;
    }
  }
}

// Test Tool Definitions Structure
function testToolDefinitions(runner: TestRunner) {
  log('\n=== Testing Tool Definitions ===', 'info');

  // Mock BrowserTools without Chrome APIs
  const mockToolDefinitions: ToolDefinition[] = [
    {
      name: 'navigate',
      description: 'Navigate to a URL',
      input_schema: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          tabId: { type: 'number' },
        },
        required: ['url'],
      },
    },
  ];

  runner.test('Tool definitions have required fields', () => {
    mockToolDefinitions.forEach((tool) => {
      runner.assertTrue(tool.name, 'Tool must have name');
      runner.assertTrue(tool.description, 'Tool must have description');
      runner.assertTrue(tool.input_schema, 'Tool must have input_schema');
      runner.assertTrue(tool.input_schema.type === 'object', 'Schema type must be object');
      runner.assertTrue(tool.input_schema.properties, 'Schema must have properties');
    });
  });

  runner.test('Required parameters are properly marked', () => {
    const navTool = mockToolDefinitions.find((t) => t.name === 'navigate');
    runner.assertTrue(navTool?.input_schema.required?.includes('url'), 'Navigate requires url');
  });
}

// Test AI Provider Configuration
function testAIProviderConfig(runner: TestRunner) {
  log('\n=== Testing AI Provider Configuration ===', 'info');

  runner.test('OpenAI provider config is valid', () => {
    const config: ProviderConfig = {
      provider: 'openai',
      apiKey: 'sk-test123',
      model: 'gpt-4o',
      systemPrompt: 'Test prompt',
    };

    runner.assertEqual(config.provider, 'openai');
    runner.assertTrue(config.apiKey.startsWith('sk-'), 'OpenAI keys should start with sk-');
  });

  runner.test('Anthropic provider config is valid', () => {
    const config: ProviderConfig = {
      provider: 'anthropic',
      apiKey: 'test-key',
      model: 'claude-3-5-sonnet-20241022',
      systemPrompt: 'Test prompt',
    };

    runner.assertEqual(config.provider, 'anthropic');
    runner.assertTrue(config.model.includes('claude'), 'Anthropic model should contain "claude"');
  });

  runner.test('Custom provider config is valid', () => {
    const config: ProviderConfig = {
      provider: 'custom',
      apiKey: 'custom-key',
      model: 'custom-model',
      customEndpoint: 'https://api.example.com/v1',
      systemPrompt: 'Test prompt',
    };

    runner.assertEqual(config.provider, 'custom');
    runner.assertTrue((config.customEndpoint ?? '').startsWith('https://'), 'Custom endpoint should use HTTPS');
  });
}

// Test Tool Schema Conversion
function testToolSchemaConversion(runner: TestRunner) {
  log('\n=== Testing Tool Schema Conversion ===', 'info');

  runner.test('Convert to OpenAI format', () => {
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

  runner.test('Convert to Anthropic format', () => {
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

// Test Input Validation
function testInputValidation(runner: TestRunner) {
  log('\n=== Testing Input Validation ===', 'info');

  runner.test('Validate URL format', () => {
    const validUrls = ['https://google.com', 'http://example.com', 'https://sub.domain.com/path'];

    validUrls.forEach((url) => {
      runner.assertTrue(url.startsWith('http://') || url.startsWith('https://'), `${url} should be valid`);
    });
  });

  runner.test('Validate CSS selectors', () => {
    const validSelectors = ['#id', '.class', 'div', 'input[name="test"]', '.class > div', 'div:nth-child(2)'];

    validSelectors.forEach((selector) => {
      runner.assertTrue(selector.length > 0, 'Selector should not be empty');
      runner.assertFalse(selector.includes('  '), 'Selector should not have double spaces');
    });
  });

  runner.test('Validate tab group colors', () => {
    const validColors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
    const testColor = 'blue';

    runner.assertTrue(validColors.includes(testColor), `${testColor} should be a valid color`);
  });
}

// Test Error Handling
function testErrorHandling(runner: TestRunner) {
  log('\n=== Testing Error Handling ===', 'info');

  runner.test('Missing required parameters throw error', () => {
    runner.assertThrows(() => {
      const params: { url?: string } = {}; // Missing required 'url'
      if (!params.url) {
        throw new Error('Missing required parameter: url');
      }
    }, 'Should not execute without required params');
  });

  runner.test('Invalid selector format detected', () => {
    const invalidSelectors: Array<string | null | undefined> = ['', '  ', null, undefined];

    invalidSelectors.forEach((selector) => {
      if (!selector || selector.trim() === '') {
        // This is correct behavior
        runner.assertTrue(true);
      }
    });
  });
}

// Test Message Schema
function testMessageSchema(runner: TestRunner) {
  log('\n=== Testing Message Schema ===', 'info');

  runner.test('createMessage builds canonical message', () => {
    const msg = createMessage({ role: 'user', content: 'hello' });
    if (!msg) {
      throw new Error('Message should not be null');
    }
    runner.assertTrue(typeof msg.id === 'string', 'Message should have id');
    runner.assertTrue(typeof msg.createdAt === 'string', 'Message should have createdAt');
    runner.assertEqual(msg.role, 'user');
    runner.assertEqual(msg.content, 'hello');
  });

  runner.test('normalizeConversationHistory filters invalid messages', () => {
    const normalized = normalizeConversationHistory([
      { role: 'user', content: 'ok' },
      { role: 'invalid' as any, content: 'skip' },
      null as any,
    ] as any);
    runner.assertEqual(normalized.length, 1);
    runner.assertEqual(normalized[0].role, 'user');
  });

  runner.test('toProviderMessages serializes tool calls and results', () => {
    const history: Message[] = [
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call_1', name: 'click', args: { selector: '#a' } }],
      },
      {
        role: 'tool',
        content: { success: true },
        toolCallId: 'call_1',
      },
    ];
    const provider = toProviderMessages(history);
    runner.assertTrue(Array.isArray(provider[0].tool_calls), 'tool_calls should be an array');
    runner.assertTrue(typeof provider[0].tool_calls?.[0]?.function?.arguments === 'string', 'tool args serialized');
    runner.assertEqual(provider[1].role, 'tool');
    const toolContent =
      typeof provider[1].content === 'string' ? provider[1].content : JSON.stringify(provider[1].content);
    runner.assertTrue(toolContent.includes('success'));
  });

  runner.test('thinking metadata is preserved and not sent to provider', () => {
    const history: Message[] = [{ role: 'assistant', content: 'Hello', thinking: 'Drafting response' }];
    const normalized = normalizeConversationHistory(history);
    runner.assertEqual(normalized[0]?.thinking, 'Drafting response');
    const provider = toProviderMessages(normalized);
    runner.assertFalse('thinking' in provider[0], 'Provider messages should not include thinking');
  });
}

// Test Conversation Compaction
function testConversationCompaction(runner: TestRunner) {
  log('\n=== Testing Conversation Compaction ===', 'info');

  runner.test('compaction utilities preserve summaries + recent messages', () => {
    const history: Message[] = Array.from({ length: 20 }, (_, idx) => ({
      role: 'user',
      content: `Message ${idx} ${'x'.repeat(200)}`,
    }));
    const usage = estimateContextTokens(history);
    const check = shouldCompact({
      contextTokens: usage.tokens,
      contextLimit: 500,
      settings: DEFAULT_COMPACTION_SETTINGS,
    });
    runner.assertTrue(check.shouldCompact, 'Should trigger compaction');

    const preserved = history.slice(-5);
    const summaryMessage = buildCompactionSummaryMessage(
      'Summary of earlier context.',
      history.length - preserved.length,
    );
    const result = applyCompaction({
      summaryMessage,
      preserved,
      trimmedCount: history.length - preserved.length,
    });
    runner.assertTrue(
      result.compacted.length === preserved.length + 1,
      'Compacted history should include summary + preserved messages',
    );
    runner.assertEqual(result.compacted[0].meta?.kind, 'summary');
  });
}

// Test Thinking Extraction
function testThinkingExtraction(runner: TestRunner) {
  log('\n=== Testing Thinking Extraction ===', 'info');

  runner.test('extractThinking strips <analysis> tags', () => {
    const result = extractThinking('Hello <analysis>secret</analysis> world');
    runner.assertTrue(result.thinking === 'secret', 'Should capture analysis content');
    runner.assertFalse(result.content.includes('<analysis>'), 'Content should not include analysis tags');
  });

  runner.test('extractThinking merges think + analysis with existing notes', () => {
    const result = extractThinking('Start <think>first</think> middle <analysis>second</analysis>', 'seed');
    runner.assertTrue(result.thinking?.includes('seed'), 'Existing notes should be preserved');
    runner.assertTrue(result.thinking?.includes('first'), 'Think tags should be captured');
    runner.assertTrue(result.thinking?.includes('second'), 'Analysis tags should be captured');
    runner.assertFalse(result.content.includes('think'), 'Content should not include think tags');
    runner.assertFalse(result.content.includes('analysis'), 'Content should not include analysis tags');
  });
}

// Test Plan Normalization
function testPlanNormalization(runner: TestRunner) {
  log('\n=== Testing Plan Normalization ===', 'info');

  runner.test('normalizePlanStatus handles invalid values', () => {
    runner.assertEqual(normalizePlanStatus('done'), 'done');
    runner.assertEqual(normalizePlanStatus('RUNNING'), 'running');
    runner.assertEqual(normalizePlanStatus('unknown'), 'pending');
  });

  runner.test('normalizePlanSteps trims, filters, and clamps', () => {
    const steps = normalizePlanSteps([
      { title: '  Step one  ', status: 'done' },
      { title: '', status: 'pending' },
      { title: 'Step two', status: 'blocked', notes: '  Needs access  ' },
    ]);
    runner.assertEqual(steps.length, 2);
    runner.assertEqual(steps[0].id, 'step-1');
    runner.assertEqual(steps[1].status, 'blocked');
    runner.assertEqual(steps[1].notes, 'Needs access');

    const tooMany = normalizePlanSteps(
      Array.from({ length: 12 }, (_, idx) => ({
        title: `Step ${idx + 1}`,
        status: 'pending',
      })),
    );
    runner.assertEqual(tooMany.length, 8);
  });

  runner.test('buildRunPlan preserves createdAt and updates timestamps', () => {
    const now = Date.now();
    const existing = buildRunPlan([{ title: 'Step one', status: 'pending' }], {
      now,
    });
    const updated = buildRunPlan([{ title: 'Step two', status: 'done' }], {
      existingPlan: existing,
      now: now + 5000,
    });
    runner.assertEqual(updated.createdAt, existing.createdAt);
    runner.assertTrue(updated.updatedAt > existing.updatedAt, 'updatedAt should advance');
    runner.assertEqual(updated.steps[1].title, 'Step two');
  });
}

// Test Retry Helpers
function testRetryHelpers(runner: TestRunner) {
  log('\n=== Testing Retry Helpers ===', 'info');

  runner.test('isValidFinalResponse rejects empty and quit phrases', () => {
    runner.assertFalse(isValidFinalResponse(''), 'Empty response should be invalid');
    runner.assertFalse(isValidFinalResponse('Please try again.'), 'Quit phrase should be invalid');
    runner.assertFalse(
      isValidFinalResponse('I could not produce a final response.'),
      'Quit phrase variants should be invalid',
    );
    runner.assertTrue(isValidFinalResponse('Here is the result.'), 'Normal response should be valid');
  });

  runner.test('createExponentialBackoff caps and scales', () => {
    const backoff = createExponentialBackoff({
      baseMs: 100,
      maxMs: 1000,
      jitter: 0,
    });
    runner.assertEqual(backoff(1), 100);
    runner.assertEqual(backoff(2), 200);
    runner.assertEqual(backoff(4), 800);
    runner.assertEqual(backoff(6), 1000);
  });

  runner.test('createExponentialBackoff applies jitter with custom rng', () => {
    const backoff = createExponentialBackoff({
      baseMs: 100,
      maxMs: 1000,
      jitter: 0.5,
      rng: () => 1,
    });
    runner.assertEqual(backoff(1), 150);
    runner.assertEqual(backoff(0), 150, 'Attempt <= 0 should clamp to 1');
  });

  runner.test('isValidFinalResponse supports custom quit phrases', () => {
    runner.assertFalse(isValidFinalResponse('Stop here.', { quitPhrases: ['stop here'] }));
    runner.assertTrue(isValidFinalResponse('Stop here.'), 'Default phrases should not block custom text');
  });
}

// Test Runtime Message Schema
function testRuntimeMessages(runner: TestRunner) {
  log('\n=== Testing Runtime Message Schema ===', 'info');

  runner.test('Runtime messages are discriminated and serializable', () => {
    const base = {
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      runId: 'run-test',
      turnId: 'turn-1',
      sessionId: 'session-test',
      timestamp: Date.now(),
    };
    const plan: RunPlan = {
      steps: [{ id: 'step-1', title: 'Do something', status: 'pending' }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const samples: RuntimeMessage[] = [
      { ...base, type: 'user_run_start', message: 'hello' },
      { ...base, type: 'assistant_stream_start' },
      { ...base, type: 'assistant_stream_delta', content: 'partial' },
      { ...base, type: 'assistant_stream_stop' },
      {
        ...base,
        type: 'tool_execution_start',
        tool: 'click',
        id: 'tool-1',
        args: { selector: '#id' },
      },
      {
        ...base,
        type: 'tool_execution_result',
        tool: 'click',
        id: 'tool-1',
        args: { selector: '#id' },
        result: { success: true },
      },
      { ...base, type: 'plan_update', plan },
      {
        ...base,
        type: 'manual_plan_update',
        steps: [{ title: 'Review plan', status: 'pending' }],
      },
      {
        ...base,
        type: 'run_status',
        phase: 'executing',
        attempts: { api: 0, tool: 1, finalize: 0 },
        maxRetries: { api: 2, tool: 2, finalize: 1 },
        lastError: 'Tool failed',
      },
      {
        ...base,
        type: 'run_status',
        phase: 'stopped',
        attempts: { api: 0, tool: 0, finalize: 0 },
        maxRetries: { api: 1, tool: 1, finalize: 1 },
        note: 'Stopped by user',
      },
      {
        ...base,
        type: 'assistant_final',
        content: 'Done',
        thinking: 'Thoughts',
        usage: { inputTokens: 10 },
      },
      { ...base, type: 'run_error', message: 'Boom' },
      { ...base, type: 'run_warning', message: 'Heads up' },
    ];

    samples.forEach((sample) => {
      const json = JSON.stringify(sample);
      const parsed = JSON.parse(json);
      runner.assertTrue(isRuntimeMessage(parsed), `Runtime message ${sample.type} should validate`);
    });
  });

  runner.test('Runtime messages reject invalid schema versions or types', () => {
    const badVersion = {
      type: 'assistant_final',
      schemaVersion: 999,
      runId: 'run-test',
      timestamp: Date.now(),
      content: 'Hi',
    };
    const badType = {
      type: 'unknown_type',
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      runId: 'run-test',
      timestamp: Date.now(),
    };
    const missingRunId = {
      type: 'assistant_final',
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      timestamp: Date.now(),
      content: 'Hi',
    };
    runner.assertFalse(isRuntimeMessage(badVersion), 'Should reject mismatched schema versions');
    runner.assertFalse(isRuntimeMessage(badType), 'Should reject unknown message types');
    runner.assertFalse(isRuntimeMessage(missingRunId), 'Should reject missing runId');
  });
}

// Main test execution
function main() {
  log('╔════════════════════════════════════════╗', 'info');
  log('║       Unit Tests - Browser Tools       ║', 'info');
  log('╚════════════════════════════════════════╝', 'info');

  const runner = new TestRunner();

  testToolDefinitions(runner);
  testAIProviderConfig(runner);
  testToolSchemaConversion(runner);
  testInputValidation(runner);
  testErrorHandling(runner);
  testMessageSchema(runner);

  testConversationCompaction(runner);
  testThinkingExtraction(runner);
  testPlanNormalization(runner);
  testRetryHelpers(runner);
  testRuntimeMessages(runner);

  const success = runner.printSummary();
  process.exit(success ? 0 : 1);
}

main();
