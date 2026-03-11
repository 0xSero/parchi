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
} from './message-types.js';
export { ROLE_SET } from './message-types.js';
export {
  createMessage,
  normalizeConversationHistory,
  normalizeUsage,
  toProviderMessages,
} from './message-factory.js';
