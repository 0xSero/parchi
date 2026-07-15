import { createStore } from '../../../packages/extension/state/core/store.js';
import {
  normalizeStoredSessions,
  trimChatSessions,
} from '../../../packages/extension/state/persistence/session-history-repository.js';
import {
  mergeSettingsSnapshot,
  pickSettingsSnapshot,
  sanitizeImportedSettings,
} from '../../../packages/extension/state/persistence/settings-repository.js';
import { type TestRunner, log } from '../shared/runner.js';

export async function runStatePersistenceSuite(runner: TestRunner) {
  log('\n=== Testing State Store + Persistence Helpers ===', 'info');

  await runner.test('createStore publishes updates to subscribers', () => {
    const store = createStore({ count: 0 });
    const seen: number[] = [];
    const unsubscribe = store.subscribe((state) => seen.push(state.count));

    store.setState((current) => ({ count: current.count + 1 }));
    unsubscribe();
    store.setState({ count: 2 });

    runner.assertEqual(store.getState().count, 2);
    runner.assertEqual(seen, [1]);
  });

  await runner.test('pickSettingsSnapshot only keeps known settings keys', () => {
    const snapshot = pickSettingsSnapshot({ provider: 'openai', model: 'gpt-4o', extra: 'drop-me' });
    runner.assertEqual(snapshot, { provider: 'openai', model: 'gpt-4o' });
  });

  await runner.test('mergeSettingsSnapshot applies patches without losing existing keys', () => {
    const merged = mergeSettingsSnapshot({ provider: 'openai', model: 'gpt-4o' }, { theme: 'charcoal' });
    runner.assertEqual(merged, { provider: 'openai', model: 'gpt-4o', theme: 'charcoal' });
  });

  await runner.test('sanitizeImportedSettings rejects invalid configs payloads', () => {
    runner.assertThrows(() => sanitizeImportedSettings({ configs: 'broken' }), 'should reject invalid configs');
  });

  await runner.test('normalizeStoredSessions accepts arrays and objects', () => {
    const fromArray = normalizeStoredSessions([{ id: 'a' } as any, null as any]);
    const fromObject = normalizeStoredSessions({ a: { id: 'a' }, b: null });
    runner.assertEqual(fromArray, [{ id: 'a' }]);
    runner.assertEqual(fromObject, [{ id: 'a' }]);
  });

  await runner.test('trimChatSessions keeps the most recent entries within the cap', () => {
    const entries = Array.from({ length: 4 }, (_, index) => ({ id: `session-${index}` })) as any;
    runner.assertEqual(trimChatSessions(entries, 2), [{ id: 'session-0' }, { id: 'session-1' }]);
  });
}
