import { isJsonRpcNotification, isJsonRpcRequest, isJsonRpcResponse } from '@parchi/shared';
import type { TestRunner } from '../../shared/runner.js';
import { log } from '../../shared/runner.js';

export function runJsonRpcMutualExclusivitySuite(runner: TestRunner) {
  log('\n=== Testing JSON-RPC Type Guard Mutual Exclusivity ===', 'info');

  runner.test('Type guards are mutually exclusive where expected', () => {
    const request = { jsonrpc: '2.0' as const, id: '1', method: 'test' };
    runner.assertTrue(isJsonRpcRequest(request), 'Valid request');
    runner.assertFalse(isJsonRpcNotification(request), 'Request with id is not a notification');
    runner.assertFalse(isJsonRpcResponse(request), 'Request is not a response');

    const notification = { jsonrpc: '2.0' as const, method: 'test' };
    runner.assertFalse(isJsonRpcRequest(notification), 'Notification without id is not a request');
    runner.assertTrue(isJsonRpcNotification(notification), 'Valid notification');
    runner.assertFalse(isJsonRpcResponse(notification), 'Notification is not a response');

    const response = { jsonrpc: '2.0' as const, id: '1', result: 'ok' };
    runner.assertFalse(isJsonRpcRequest(response), 'Response is not a request');
    runner.assertFalse(isJsonRpcNotification(response), 'Response is not a notification');
    runner.assertTrue(isJsonRpcResponse(response), 'Valid response');

    const errorResponse = { jsonrpc: '2.0' as const, id: '1', error: { code: -1, message: 'err' } };
    runner.assertFalse(isJsonRpcRequest(errorResponse), 'Error response is not a request');
    runner.assertFalse(isJsonRpcNotification(errorResponse), 'Error response is not a notification');
    runner.assertTrue(isJsonRpcResponse(errorResponse), 'Valid error response');
  });
}
