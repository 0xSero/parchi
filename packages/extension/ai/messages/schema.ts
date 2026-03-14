// Barrel export for message types and factory functions
export type {
  ContentPart,
  Message,
  MessageContent,
  MessageMeta,
  ProviderMessage,
  Role,
  ToolCall,
  Usage,
} from './types.js';
export { ROLE_SET } from './types.js';
export {
  createMessage,
  normalizeConversationHistory,
  normalizeUsage,
  toProviderMessages,
} from './factory.js';
