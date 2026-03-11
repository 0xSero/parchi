import { isJsonRpcNotification } from '@parchi/shared';
import type { TestRunner } from '../../shared/runner.js';
import { log } from '../../shared/runner.js';

export function runJsonRpcNotificationSuite(runner: TestRunner) {
  log('\n=== Testing isJsonRpcNotification ===', 'info');

  runner.test('isJsonRpcNotification accepts valid JSON-RPC notifications', () => {
    const validNotifications = [
      { jsonrpc: '2.0' as const, method: 'notify' },
      { jsonrpc: '2.0' as const, method: 'statusUpdate', params: { status: 'ok' } },
      { jsonrpc: '2.0' as const, method: 'ping' },
      { jsonrpc: '2.0' as const, method: 'event', params: null },
    ];

    validNotifications.forEach((notif) => {
      runner.assertTrue(isJsonRpcNotification(notif), `Should accept valid notification: ${JSON.stringify(notif)}`);
    });
  });

  runner.test('isJsonRpcNotification rejects non-objects', () => {
    runner.assertFalse(isJsonRpcNotification(null), 'Should reject null');
    runner.assertFalse(isJsonRpcNotification(undefined), 'Should reject undefined');
    runner.assertFalse(isJsonRpcNotification('notification'), 'Should reject string');
    runner.assertFalse(isJsonRpcNotification(456), 'Should reject number');
    runner.assertFalse(isJsonRpcNotification([]), 'Should reject array');
  });

  runner.test('isJsonRpcNotification rejects notifications with id', () => {
    runner.assertFalse(
      isJsonRpcNotification({ jsonrpc: '2.0', id: '1', method: 'test' }),
      'Should reject notifications with id',
    );
    runner.assertFalse(
      isJsonRpcNotification({ jsonrpc: '2.0', id: null, method: 'test' }),
      'Should reject with null id',
    );
    runner.assertFalse(isJsonRpcNotification({ jsonrpc: '2.0', id: 0, method: 'test' }), 'Should reject with zero id');
    runner.assertFalse(
      isJsonRpcNotification({ jsonrpc: '2.0', id: '', method: 'test' }),
      'Should reject with empty string id',
    );
  });

  runner.test('isJsonRpcNotification rejects wrong jsonrpc version', () => {
    runner.assertFalse(
      isJsonRpcNotification({ jsonrpc: '1.0', method: 'test' }),
      'Should reject wrong jsonrpc version',
    );
    runner.assertFalse(isJsonRpcNotification({ method: 'test' }), 'Should reject missing jsonrpc');
  });

  runner.test('isJsonRpcNotification rejects invalid method', () => {
    runner.assertFalse(isJsonRpcNotification({ jsonrpc: '2.0' }), 'Should reject missing method');
    runner.assertFalse(isJsonRpcNotification({ jsonrpc: '2.0', method: null }), 'Should reject null method');
    runner.assertFalse(isJsonRpcNotification({ jsonrpc: '2.0', method: 123 }), 'Should reject number method');
    runner.assertFalse(isJsonRpcNotification({ jsonrpc: '2.0', method: {} }), 'Should reject object method');
  });

  runner.test('isJsonRpcNotification accepts empty string method', () => {
    runner.assertTrue(isJsonRpcNotification({ jsonrpc: '2.0', method: '' }), 'Should accept empty string method');
  });

  runner.test('isJsonRpcNotification handles edge cases', () => {
    runner.assertFalse(isJsonRpcNotification({}), 'Should reject empty object');

    runner.assertTrue(
      isJsonRpcNotification({ jsonrpc: '2.0', method: 'test', timestamp: Date.now() }),
      'Should accept notification with extra properties',
    );

    runner.assertTrue(
      isJsonRpcNotification({ jsonrpc: '2.0', method: '🚀.notify' }),
      'Should accept unicode and emoji in method',
    );
  });
}
