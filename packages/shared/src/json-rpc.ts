export type JsonRpcId = string | number;

export type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcNotification = {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
};

export type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId; result: unknown }
  | { jsonrpc: '2.0'; id: JsonRpcId; error: JsonRpcError };

/** Tool definition for AI SDK tool calling */
export type ToolDefinition = {
  name: string;
  description?: string;
  input_schema?: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (!isObject(value)) return false;
  return (
    value.jsonrpc === '2.0' &&
    (typeof value.id === 'string' || typeof value.id === 'number') &&
    typeof value.method === 'string'
  );
}

export function isJsonRpcNotification(value: unknown): value is JsonRpcNotification {
  if (!isObject(value)) return false;
  return value.jsonrpc === '2.0' && !('id' in value) && typeof value.method === 'string';
}

export function isJsonRpcResponse(value: unknown): value is JsonRpcResponse {
  if (!isObject(value)) return false;
  if (value.jsonrpc !== '2.0') return false;
  if (!('id' in value)) return false;
  const id = value.id;
  if (!(typeof id === 'string' || typeof id === 'number')) return false;
  return 'result' in value || 'error' in value;
}
