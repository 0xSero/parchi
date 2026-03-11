import { RUNTIME_MESSAGE_SCHEMA_VERSION, isRuntimeMessage } from '@parchi/shared';
import { type TestRunner, log } from '../../shared/runner.js';

export function runRuntimeMessagesStreamingSuite(runner: TestRunner) {
  log('\n=== Testing Runtime Message Streaming ===', 'info');

  runner.test('assistant_response message serializes and deserializes correctly', () => {
    const message = {
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      type: 'assistant_response' as const,
      runId: 'run-test',
      sessionId: 'session-test',
      turnId: 'turn-1',
      timestamp: Date.now(),
      content: 'This is the assistant response content',
      thinking: 'I should respond thoughtfully',
      model: 'claude-3-5-sonnet',
    };
    const json = JSON.stringify(message);
    const parsed = JSON.parse(json);
    runner.assertTrue(isRuntimeMessage(parsed), 'assistant_response should validate');
    runner.assertEqual(parsed.type, 'assistant_response', 'Type should be preserved');
    runner.assertEqual(parsed.content, message.content, 'Content should be preserved');
    runner.assertEqual(parsed.thinking, message.thinking, 'Thinking should be preserved');
    runner.assertEqual(parsed.model, message.model, 'Model should be preserved');
  });

  runner.test('assistant_response message handles minimal variant', () => {
    const message = {
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      type: 'assistant_response' as const,
      runId: 'run-test',
      sessionId: 'session-test',
      timestamp: Date.now(),
      content: 'Simple response',
    };
    const json = JSON.stringify(message);
    const parsed = JSON.parse(json);
    runner.assertTrue(isRuntimeMessage(parsed), 'Minimal assistant_response should validate');
    runner.assertEqual(parsed.content, 'Simple response', 'Content should be preserved');
  });
}
