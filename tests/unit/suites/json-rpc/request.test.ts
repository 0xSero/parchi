import { isJsonRpcRequest } from '@parchi/shared';
import type { TestRunner } from '../../shared/runner.js';
import { log } from '../../shared/runner.js';

export function runJsonRpcRequestSuite(runner: TestRunner) {
  log('\n=== Testing isJsonRpcRequest ===', 'info');

  runner.test('isJsonRpcRequest accepts valid JSON-RPC requests', () => {
    const validRequests = [
      { jsonrpc: '2.0' as const, id: 'req-1', method: 'getData' },
      { jsonrpc: '2.0' as const, id: 123, method: 'updateItem', params: { id: 456 } },
      { jsonrpc: '2.0' as const, id: 0, method: 'zeroId' },
      { jsonrpc: '2.0' as const, id: 'abc-def-123', method: 'test', params: null },
      { jsonrpc: '2.0' as const, id: 999999, method: 'largeNumber' },
    ];

    validRequests.forEach((req) => {
      runner.assertTrue(isJsonRpcRequest(req), `Should accept valid request: ${JSON.stringify(req)}`);
    });
  });

  runner.test('isJsonRpcRequest rejects non-objects', () => {
    runner.assertFalse(isJsonRpcRequest(null), 'Should reject null');
    runner.assertFalse(isJsonRpcRequest(undefined), 'Should reject undefined');
    runner.assertFalse(isJsonRpcRequest('string'), 'Should reject string');
    runner.assertFalse(isJsonRpcRequest(123), 'Should reject number');
    runner.assertFalse(isJsonRpcRequest(true), 'Should reject boolean');
    runner.assertFalse(isJsonRpcRequest([]), 'Should reject array');
    runner.assertFalse(
      isJsonRpcRequest(() => {}),
      'Should reject function',
    );
  });

  runner.test('isJsonRpcRequest rejects missing or wrong jsonrpc version', () => {
    runner.assertFalse(isJsonRpcRequest({ id: '1', method: 'test' }), 'Should reject missing jsonrpc');
    runner.assertFalse(
      isJsonRpcRequest({ jsonrpc: '1.0', id: '1', method: 'test' }),
      'Should reject wrong jsonrpc version',
    );
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: 2.0, id: '1', method: 'test' }), 'Should reject non-string jsonrpc');
  });

  runner.test('isJsonRpcRequest rejects invalid id types', () => {
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', method: 'test' }), 'Should reject missing id');
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: null, method: 'test' }), 'Should reject null id');
    runner.assertFalse(
      isJsonRpcRequest({ jsonrpc: '2.0', id: undefined, method: 'test' }),
      'Should reject undefined id',
    );
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: {}, method: 'test' }), 'Should reject object id');
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: [], method: 'test' }), 'Should reject array id');
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: true, method: 'test' }), 'Should reject boolean id');
  });

  runner.test('isJsonRpcRequest rejects invalid method', () => {
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: '1' }), 'Should reject missing method');
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: '1', method: null }), 'Should reject null method');
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: '1', method: 123 }), 'Should reject number method');
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: '1', method: {} }), 'Should reject object method');
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: '1', method: [] }), 'Should reject array method');
  });

  runner.test('isJsonRpcRequest accepts empty string method', () => {
    runner.assertTrue(isJsonRpcRequest({ jsonrpc: '2.0', id: '1', method: '' }), 'Should accept empty string method');
  });

  runner.test('isJsonRpcRequest handles edge cases', () => {
    runner.assertFalse(isJsonRpcRequest({}), 'Should reject empty object');

    runner.assertTrue(
      isJsonRpcRequest({ jsonrpc: '2.0', id: '1', method: 'test', extra: 'field', nested: { data: true } }),
      'Should accept request with extra properties',
    );

    runner.assertTrue(
      isJsonRpcRequest({ jsonrpc: '2.0', id: Number.MAX_SAFE_INTEGER, method: 'test' }),
      'Should accept max safe integer id',
    );

    runner.assertTrue(
      isJsonRpcRequest({ jsonrpc: '2.0', id: '日本語-id', method: '方法' }),
      'Should accept unicode in id and method',
    );

    const nestedRequest = {
      jsonrpc: '2.0',
      id: 'outer',
      method: 'wrap',
      params: { jsonrpc: '2.0', id: 'inner', method: 'nested' },
    };
    runner.assertTrue(isJsonRpcRequest(nestedRequest), 'Should accept request with nested object params');
    runner.assertTrue(isJsonRpcRequest(nestedRequest.params), 'Inner object with jsonrpc/id/method is a valid request');
  });
}
