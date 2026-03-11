import { isJsonRpcResponse } from '@parchi/shared';
import type { TestRunner } from '../../shared/runner.js';
import { log } from '../../shared/runner.js';

export function runJsonRpcResponseSuite(runner: TestRunner) {
  log('\n=== Testing isJsonRpcResponse ===', 'info');

  runner.test('isJsonRpcResponse accepts valid JSON-RPC responses', () => {
    const validResponses = [
      { jsonrpc: '2.0' as const, id: 'resp-1', result: { data: 'value' } },
      { jsonrpc: '2.0' as const, id: 456, result: 'simple string result' },
      { jsonrpc: '2.0' as const, id: 0, result: null },
      { jsonrpc: '2.0' as const, id: 'abc', result: [1, 2, 3] },
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

  runner.test('isJsonRpcResponse rejects non-objects', () => {
    runner.assertFalse(isJsonRpcResponse(null), 'Should reject null');
    runner.assertFalse(isJsonRpcResponse(undefined), 'Should reject undefined');
    runner.assertFalse(isJsonRpcResponse('response'), 'Should reject string');
    runner.assertFalse(isJsonRpcResponse(789), 'Should reject number');
    runner.assertFalse(isJsonRpcResponse([]), 'Should reject array');
  });

  runner.test('isJsonRpcResponse rejects missing or wrong jsonrpc version', () => {
    runner.assertFalse(isJsonRpcResponse({ id: '1', result: 'ok' }), 'Should reject missing jsonrpc');
    runner.assertFalse(
      isJsonRpcResponse({ jsonrpc: '1.0', id: '1', result: 'ok' }),
      'Should reject wrong jsonrpc version',
    );
    runner.assertFalse(isJsonRpcResponse({ jsonrpc: 2.0, id: '1', result: 'ok' }), 'Should reject non-string jsonrpc');
  });

  runner.test('isJsonRpcResponse rejects missing or invalid id', () => {
    runner.assertFalse(isJsonRpcResponse({ jsonrpc: '2.0', result: 'ok' }), 'Should reject missing id');
    runner.assertFalse(
      isJsonRpcResponse({ jsonrpc: '2.0', error: { code: -1, message: 'err' } }),
      'Should reject missing id in error',
    );
    runner.assertFalse(isJsonRpcResponse({ jsonrpc: '2.0', id: null, result: 'ok' }), 'Should reject null id');
    runner.assertFalse(
      isJsonRpcResponse({ jsonrpc: '2.0', id: undefined, result: 'ok' }),
      'Should reject undefined id',
    );
    runner.assertFalse(isJsonRpcResponse({ jsonrpc: '2.0', id: {}, result: 'ok' }), 'Should reject object id');
    runner.assertFalse(isJsonRpcResponse({ jsonrpc: '2.0', id: [], result: 'ok' }), 'Should reject array id');
    runner.assertFalse(isJsonRpcResponse({ jsonrpc: '2.0', id: true, result: 'ok' }), 'Should reject boolean id');
  });

  runner.test('isJsonRpcResponse rejects missing both result and error', () => {
    runner.assertFalse(isJsonRpcResponse({ jsonrpc: '2.0', id: '1' }), 'Should reject missing result/error');
  });

  runner.test('isJsonRpcResponse accepts response with both result and error', () => {
    runner.assertTrue(
      isJsonRpcResponse({ jsonrpc: '2.0', id: '1', result: 'ok', error: { code: -1, message: 'err' } }),
      'Should accept response with both result and error (treated as response)',
    );
  });

  runner.test('isJsonRpcResponse accepts various error structures', () => {
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

  runner.test('isJsonRpcResponse handles edge cases', () => {
    runner.assertFalse(isJsonRpcResponse({}), 'Should reject empty object');

    runner.assertTrue(
      isJsonRpcResponse({ jsonrpc: '2.0', id: '1', result: 'ok', metadata: { server: 'test' } }),
      'Should accept response with extra properties',
    );

    runner.assertTrue(
      isJsonRpcResponse({ jsonrpc: '2.0', id: Number.MAX_SAFE_INTEGER, result: 'ok' }),
      'Should accept max safe integer id in response',
    );
  });
}
