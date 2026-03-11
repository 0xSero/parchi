import { RUNTIME_MESSAGE_SCHEMA_VERSION, isRuntimeMessage } from '@parchi/shared';
import { type TestRunner, log } from '../../shared/runner.js';

export function runRuntimeMessagesValidationSuite(runner: TestRunner) {
  log('\n=== Testing Runtime Message Validation ===', 'info');

  runner.test('Runtime messages reject invalid schema versions or types', () => {
    runner.assertFalse(isRuntimeMessage(null), 'Should reject non-objects');
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
    runner.assertFalse(
      isRuntimeMessage({
        type: 'assistant_final',
        schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
        runId: 'run-test',
        sessionId: '',
        timestamp: Date.now(),
      }),
      'Should reject blank sessionId',
    );
    runner.assertFalse(
      isRuntimeMessage({
        type: 'assistant_final',
        schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
        runId: 'run-test',
        sessionId: 'session-test',
        timestamp: 'bad',
      }),
      'Should reject non-numeric timestamps',
    );
  });
}
