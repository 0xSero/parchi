import type { JsonRpcId } from './json-rpc.js';

/**
 * Relay service types for agent connection and run management.
 * These types are shared between the CLI daemon and any relay clients.
 */

/** Agent capabilities reported during hello */
export type AgentCapabilities = {
  tools?: boolean;
  agentRun?: boolean;
};

/** Initial handshake message from connecting agent */
export type AgentHello = {
  agentId: string;
  name?: string;
  version?: string;
  browser?: string;
  userAgent?: string;
  capabilities?: AgentCapabilities;
};

/** WebSocket connection state for an agent */
export type AgentConnection = {
  agentId: string;
  // WebSocket is not imported here to avoid node-specific dependencies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ws: any;
  hello: AgentHello;
  connectedAt: number;
  lastSeenAt: number;
  pending: Map<
    JsonRpcId,
    {
      resolve: (value: unknown) => void;
      reject: (err: Error) => void;
      timeoutId: ReturnType<typeof setTimeout>;
    }
  >;
};

/** Status of a completed run */
export type RunCompleteStatus = 'completed' | 'failed' | 'stopped';

/** Record of a run's events and completion status */
export type RunRecord = {
  runId: string;
  agentId: string;
  createdAt: number;
  updatedAt: number;
  events: unknown[];
  done: null | {
    status: RunCompleteStatus;
    final?: unknown;
    error?: unknown;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  waiters: Array<(value: RunRecord) => void>;
};
