import { isJsonRpcNotification, isJsonRpcRequest, isJsonRpcResponse } from '@parchi/shared';
import type { TestRunner } from '../shared/runner.js';
import { log } from '../shared/runner.js';

export function runJsonRpcTypeGuardsSuite(runner: TestRunner) {
  log('\n=== Testing JSON-RPC Type Guards ===', 'info');

  // ===== isJsonRpcRequest Tests =====
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

  runner.test('isJsonRpcRequest rejects invalid inputs', () => {
    // Non-objects
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

    // Missing or wrong jsonrpc version
    runner.assertFalse(isJsonRpcRequest({ id: '1', method: 'test' }), 'Should reject missing jsonrpc');
    runner.assertFalse(
      isJsonRpcRequest({ jsonrpc: '1.0', id: '1', method: 'test' }),
      'Should reject wrong jsonrpc version',
    );
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: 2.0, id: '1', method: 'test' }), 'Should reject non-string jsonrpc');

    // Missing or invalid id
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', method: 'test' }), 'Should reject missing id');
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: null, method: 'test' }), 'Should reject null id');
    runner.assertFalse(
      isJsonRpcRequest({ jsonrpc: '2.0', id: undefined, method: 'test' }),
      'Should reject undefined id',
    );
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: {}, method: 'test' }), 'Should reject object id');
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: [], method: 'test' }), 'Should reject array id');
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: true, method: 'test' }), 'Should reject boolean id');

    // Missing or invalid method
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: '1' }), 'Should reject missing method');
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: '1', method: null }), 'Should reject null method');
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: '1', method: 123 }), 'Should reject number method');
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: '1', method: {} }), 'Should reject object method');
    runner.assertFalse(isJsonRpcRequest({ jsonrpc: '2.0', id: '1', method: [] }), 'Should reject array method');

    // Empty string method
    runner.assertTrue(isJsonRpcRequest({ jsonrpc: '2.0', id: '1', method: '' }), 'Should accept empty string method');
  });

  // ===== isJsonRpcNotification Tests =====
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

  runner.test('isJsonRpcNotification rejects invalid inputs', () => {
    // Non-objects
    runner.assertFalse(isJsonRpcNotification(null), 'Should reject null');
    runner.assertFalse(isJsonRpcNotification(undefined), 'Should reject undefined');
    runner.assertFalse(isJsonRpcNotification('notification'), 'Should reject string');
    runner.assertFalse(isJsonRpcNotification(456), 'Should reject number');
    runner.assertFalse(isJsonRpcNotification([]), 'Should reject array');

    // Has id (requests are not notifications)
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

    // Wrong jsonrpc version
    runner.assertFalse(
      isJsonRpcNotification({ jsonrpc: '1.0', method: 'test' }),
      'Should reject wrong jsonrpc version',
    );
    runner.assertFalse(isJsonRpcNotification({ method: 'test' }), 'Should reject missing jsonrpc');

    // Invalid method
    runner.assertFalse(isJsonRpcNotification({ jsonrpc: '2.0' }), 'Should reject missing method');
    runner.assertFalse(isJsonRpcNotification({ jsonrpc: '2.0', method: null }), 'Should reject null method');
    runner.assertFalse(isJsonRpcNotification({ jsonrpc: '2.0', method: 123 }), 'Should reject number method');
    runner.assertFalse(isJsonRpcNotification({ jsonrpc: '2.0', method: {} }), 'Should reject object method');

    // Empty string method
    runner.assertTrue(isJsonRpcNotification({ jsonrpc: '2.0', method: '' }), 'Should accept empty string method');
  });

  // ===== isJsonRpcResponse Tests =====
  runner.test('isJsonRpcResponse accepts valid JSON-RPC responses', () => {
    const validResponses = [
      // Success responses
      { jsonrpc: '2.0' as const, id: 'resp-1', result: { data: 'value' } },
      { jsonrpc: '2.0' as const, id: 456, result: 'simple string result' },
      { jsonrpc: '2.0' as const, id: 0, result: null },
      { jsonrpc: '2.0' as const, id: 'abc', result: [1, 2, 3] },
      // Error responses
      { jsonrpc: '2.0' as const, id: 'err-1', error: { code: -32600, message: 'Invalid Request' } },
      {
        jsonrpc: '2.0' as const,
        id: 789,
        error: { code: -32601, message: 'Method not found', data: { method: 'unknown' } },
      },
      { jsonrpc: '2.0' as const, id: 'batch-1', error: { code: -32700, message: 'Parse error' } },
    ];

    validResponses.forEach((resp) => {
      runner.assertTrue(isJsonRpcResponse(resp), `Should accept valid response: ${JSON.stringify(resp)}`);
    });
  });

  runner.test('isJsonRpcResponse rejects invalid inputs', () => {
    // Non-objects
    runner.assertFalse(isJsonRpcResponse(null), 'Should reject null');
    runner.assertFalse(isJsonRpcResponse(undefined), 'Should reject undefined');
    runner.assertFalse(isJsonRpcResponse('response'), 'Should reject string');
    runner.assertFalse(isJsonRpcResponse(789), 'Should reject number');
    runner.assertFalse(isJsonRpcResponse([]), 'Should reject array');

    // Missing or wrong jsonrpc version
    runner.assertFalse(isJsonRpcResponse({ id: '1', result: 'ok' }), 'Should reject missing jsonrpc');
    runner.assertFalse(
      isJsonRpcResponse({ jsonrpc: '1.0', id: '1', result: 'ok' }),
      'Should reject wrong jsonrpc version',
    );
    runner.assertFalse(isJsonRpcResponse({ jsonrpc: 2.0, id: '1', result: 'ok' }), 'Should reject non-string jsonrpc');

    // Missing id
    runner.assertFalse(isJsonRpcResponse({ jsonrpc: '2.0', result: 'ok' }), 'Should reject missing id');
    runner.assertFalse(
      isJsonRpcResponse({ jsonrpc: '2.0', error: { code: -1, message: 'err' } }),
      'Should reject missing id in error',
    );

    // Invalid id types
    runner.assertFalse(isJsonRpcResponse({ jsonrpc: '2.0', id: null, result: 'ok' }), 'Should reject null id');
    runner.assertFalse(
      isJsonRpcResponse({ jsonrpc: '2.0', id: undefined, result: 'ok' }),
      'Should reject undefined id',
    );
    runner.assertFalse(isJsonRpcResponse({ jsonrpc: '2.0', id: {}, result: 'ok' }), 'Should reject object id');
    runner.assertFalse(isJsonRpcResponse({ jsonrpc: '2.0', id: [], result: 'ok' }), 'Should reject array id');
    runner.assertFalse(isJsonRpcResponse({ jsonrpc: '2.0', id: true, result: 'ok' }), 'Should reject boolean id');

    // Missing both result and error
    runner.assertFalse(isJsonRpcResponse({ jsonrpc: '2.0', id: '1' }), 'Should reject missing result/error');

    // Has both result and error (protocol violation, but we accept it since we check OR)
    runner.assertTrue(
      isJsonRpcResponse({ jsonrpc: '2.0', id: '1', result: 'ok', error: { code: -1, message: 'err' } }),
      'Should accept response with both result and error (treated as response)',
    );

    // Invalid error structure (still has error key)
    runner.assertTrue(
      isJsonRpcResponse({ jsonrpc: '2.0', id: '1', error: null }),
      'Should accept response with null error (has error key)',
    );
    runner.assertTrue(
      isJsonRpcResponse({ jsonrpc: '2.0', id: '1', error: 'string error' }),
      'Should accept response with string error (has error key)',
    );
    runner.assertTrue(
      isJsonRpcResponse({ jsonrpc: '2.0', id: '1', error: 123 }),
      'Should accept response with number error (has error key)',
    );
  });

  // ===== Edge Case Tests =====
  runner.test('Type guards handle edge cases correctly', () => {
    // Empty object
    runner.assertFalse(isJsonRpcRequest({}), 'Should reject empty object as request');
    runner.assertFalse(isJsonRpcNotification({}), 'Should reject empty object as notification');
    runner.assertFalse(isJsonRpcResponse({}), 'Should reject empty object as response');

    // Objects with extra properties
    runner.assertTrue(
      isJsonRpcRequest({ jsonrpc: '2.0', id: '1', method: 'test', extra: 'field', nested: { data: true } }),
      'Should accept request with extra properties',
    );
    runner.assertTrue(
      isJsonRpcNotification({ jsonrpc: '2.0', method: 'test', timestamp: Date.now() }),
      'Should accept notification with extra properties',
    );
    runner.assertTrue(
      isJsonRpcResponse({ jsonrpc: '2.0', id: '1', result: 'ok', metadata: { server: 'test' } }),
      'Should accept response with extra properties',
    );

    // Nested JSON-RPC objects - outer is valid, nested params object is also valid since it has required fields
    const nestedRequest = {
      jsonrpc: '2.0',
      id: 'outer',
      method: 'wrap',
      params: { jsonrpc: '2.0', id: 'inner', method: 'nested' },
    };
    runner.assertTrue(isJsonRpcRequest(nestedRequest), 'Should accept request with nested object params');
    // The params object happens to be a valid JSON-RPC request itself since it has all required fields
    runner.assertTrue(isJsonRpcRequest(nestedRequest.params), 'Inner object with jsonrpc/id/method is a valid request');
    // But a params object missing required fields should be rejected
    const invalidNested = { jsonrpc: '2.0', id: 'outer', method: 'wrap', params: { method: 'nested' } };
    runner.assertFalse(
      isJsonRpcRequest(invalidNested.params),
      'Inner object missing required fields is not a valid request',
    );

    // Very large ids
    runner.assertTrue(
      isJsonRpcRequest({ jsonrpc: '2.0', id: Number.MAX_SAFE_INTEGER, method: 'test' }),
      'Should accept max safe integer id',
    );
    runner.assertTrue(
      isJsonRpcResponse({ jsonrpc: '2.0', id: Number.MAX_SAFE_INTEGER, result: 'ok' }),
      'Should accept max safe integer id in response',
    );

    // Unicode in method names and ids
    runner.assertTrue(
      isJsonRpcRequest({ jsonrpc: '2.0', id: '日本語-id', method: '方法' }),
      'Should accept unicode in id and method',
    );
    runner.assertTrue(
      isJsonRpcNotification({ jsonrpc: '2.0', method: '🚀.notify' }),
      'Should accept unicode and emoji in method',
    );
  });

  // ===== Mutual Exclusivity Tests =====
  runner.test('Type guards are mutually exclusive where expected', () => {
    // A request with id should not be a notification
    const request = { jsonrpc: '2.0' as const, id: '1', method: 'test' };
    runner.assertTrue(isJsonRpcRequest(request), 'Valid request');
    runner.assertFalse(isJsonRpcNotification(request), 'Request with id is not a notification');
    runner.assertFalse(isJsonRpcResponse(request), 'Request is not a response');

    // A notification without id should not be a request
    const notification = { jsonrpc: '2.0' as const, method: 'test' };
    runner.assertFalse(isJsonRpcRequest(notification), 'Notification without id is not a request');
    runner.assertTrue(isJsonRpcNotification(notification), 'Valid notification');
    runner.assertFalse(isJsonRpcResponse(notification), 'Notification is not a response');

    // A response should not be a request or notification
    const response = { jsonrpc: '2.0' as const, id: '1', result: 'ok' };
    runner.assertFalse(isJsonRpcRequest(response), 'Response is not a request');
    runner.assertFalse(isJsonRpcNotification(response), 'Response is not a notification');
    runner.assertTrue(isJsonRpcResponse(response), 'Valid response');

    // An error response should not be a request or notification
    const errorResponse = { jsonrpc: '2.0' as const, id: '1', error: { code: -1, message: 'err' } };
    runner.assertFalse(isJsonRpcRequest(errorResponse), 'Error response is not a request');
    runner.assertFalse(isJsonRpcNotification(errorResponse), 'Error response is not a notification');
    runner.assertTrue(isJsonRpcResponse(errorResponse), 'Valid error response');
  });
}
