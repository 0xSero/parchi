// Type definitions for messages and message parts
import type { Usage as SharedUsage } from '@parchi/shared';

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export type ContentPart =
  | string
  | {
      type?: string;
      text?: string;
      content?: unknown;
      image_url?: { url?: string };
      source?: { type?: string; media_type?: string; data?: string };
      tool_use_id?: string;
      id?: string;
      name?: string;
      input?: unknown;
      [key: string]: unknown;
    };

export type MessageContent = string | ContentPart[] | Record<string, unknown>;

export type ToolCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

export type Usage = SharedUsage;

type OpenAIFunctionCall = {
  name?: string;
  arguments?: string;
};

type OpenAIToolCall = {
  id?: string;
  type?: string;
  function?: OpenAIFunctionCall;
  func?: OpenAIFunctionCall;
  tool?: OpenAIFunctionCall;
  name?: string;
  arguments?: string;
  index?: number;
};

export type MessageMeta = {
  kind?: 'summary' | 'compaction' | 'context' | 'tool';
  summaryOfCount?: number;
  source?: string;
};

export type Message = {
  id?: string;
  createdAt?: string;
  role: Role;
  content: MessageContent;
  thinking?: string | null;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  function_call?: OpenAIFunctionCall;
  name?: string;
  usage?: Usage;
  meta?: MessageMeta;
};

export type ProviderMessage = {
  role: Role;
  content: MessageContent;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
  name?: string;
};

export const ROLE_SET = new Set<Role>(['system', 'user', 'assistant', 'tool']);
