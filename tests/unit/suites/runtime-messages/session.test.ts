import { RUNTIME_MESSAGE_SCHEMA_VERSION, isRuntimeMessage } from '@parchi/shared';
import { type TestRunner, log } from '../../shared/runner.js';

export function runRuntimeMessagesSessionSuite(runner: TestRunner) {
  log('\n=== Testing Runtime Message Session ===', 'info');

  runner.test('session_tabs_update message serializes and deserializes correctly', () => {
    const message = {
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      type: 'session_tabs_update' as const,
      runId: 'run-test',
      sessionId: 'session-test',
      timestamp: Date.now(),
      tabs: [
        { id: 1, title: 'Tab One', url: 'https://example.com/one' },
        { id: 2, title: 'Tab Two', url: 'https://example.com/two' },
        { id: 3, title: 'Tab Three', url: 'https://example.com/three' },
      ],
      activeTabId: 2,
      maxTabs: 10,
      groupTitle: 'My Tab Group',
    };
    const json = JSON.stringify(message);
    const parsed = JSON.parse(json);
    runner.assertTrue(isRuntimeMessage(parsed), 'session_tabs_update should validate');
    runner.assertEqual(parsed.type, 'session_tabs_update', 'Type should be preserved');
    runner.assertEqual(parsed.tabs.length, 3, 'Tabs array should be preserved');
    runner.assertEqual(parsed.activeTabId, 2, 'Active tab ID should be preserved');
    runner.assertEqual(parsed.maxTabs, 10, 'Max tabs should be preserved');
    runner.assertEqual(parsed.groupTitle, 'My Tab Group', 'Group title should be preserved');
    runner.assertEqual(parsed.tabs[0].title, 'Tab One', 'Tab title should be preserved');
    runner.assertEqual(parsed.tabs[0].url, 'https://example.com/one', 'Tab URL should be preserved');
  });

  runner.test('session_tabs_update message handles minimal variant', () => {
    const message = {
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      type: 'session_tabs_update' as const,
      runId: 'run-test',
      sessionId: 'session-test',
      timestamp: Date.now(),
      tabs: [],
      activeTabId: null,
      maxTabs: 5,
    };
    const json = JSON.stringify(message);
    const parsed = JSON.parse(json);
    runner.assertTrue(isRuntimeMessage(parsed), 'Minimal session_tabs_update should validate');
    runner.assertEqual(parsed.tabs.length, 0, 'Empty tabs array should be preserved');
    runner.assertEqual(parsed.activeTabId, null, 'Null activeTabId should be preserved');
  });
}
