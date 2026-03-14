import {
  createMessage,
  normalizeConversationHistory,
  toProviderMessages,
} from '../../../packages/extension/ai/messages/schema.js';
import type { Message } from '../../../packages/extension/ai/messages/schema.js';
import { type TestRunner, log } from '../shared/runner.js';

export function runMessageSchemaSuite(runner: TestRunner) {
  log('\n=== Testing Message Schema ===', 'info');

  runner.test('createMessage builds canonical message', () => {
    const msg = createMessage({ role: 'user', content: 'hello' });
    if (!msg) {
      throw new Error('Message should not be null');
    }
    runner.assertTrue(typeof msg.id === 'string', 'Message should have id');
    runner.assertTrue(typeof msg.createdAt === 'string', 'Message should have createdAt');
    runner.assertEqual(msg.role, 'user');
    runner.assertEqual(msg.content, 'hello');
  });

  runner.test('normalizeConversationHistory filters invalid messages', () => {
    const normalized = normalizeConversationHistory([
      { role: 'user', content: 'ok' },
      { role: 'invalid', content: 'skip' },
      null,
    ] as unknown as Message[]);
    runner.assertEqual(normalized.length, 1);
    runner.assertEqual(normalized[0].role, 'user');
  });

  runner.test('toProviderMessages serializes tool calls and results', () => {
    const history: Message[] = [
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call_1', name: 'click', args: { selector: '#a' } }],
      },
      {
        role: 'tool',
        content: { success: true },
        toolCallId: 'call_1',
      },
    ];
    const provider = toProviderMessages(history);
    runner.assertTrue(Array.isArray(provider[0].tool_calls), 'tool_calls should be an array');
    runner.assertTrue(typeof provider[0].tool_calls?.[0]?.function?.arguments === 'string', 'tool args serialized');
    runner.assertEqual(provider[1].role, 'tool');
    const toolContent =
      typeof provider[1].content === 'string' ? provider[1].content : JSON.stringify(provider[1].content);
    runner.assertTrue(toolContent.includes('success'));
  });

  runner.test('thinking metadata is preserved and not sent to provider', () => {
    const history: Message[] = [{ role: 'assistant', content: 'Hello', thinking: 'Drafting response' }];
    const normalized = normalizeConversationHistory(history);
    runner.assertEqual(normalized[0]?.thinking, 'Drafting response');
    const provider = toProviderMessages(normalized);
    runner.assertFalse('thinking' in provider[0], 'Provider messages should not include thinking');
  });

  runner.test('normalizeConversationHistory hydrates tool metadata and respects addIds/addTimestamps flags', () => {
    const normalized = normalizeConversationHistory(
      [
        {
          role: 'assistant',
          content: { ok: true } as any,
          tool_calls: [{ id: 'call-1', function: { name: 'click', arguments: '{"selector":"#go"}' } }],
        },
        {
          role: 'tool',
          content: { success: true } as any,
          tool_call_id: 'call-1',
          name: 'click',
          toolName: 'click',
        },
      ],
      { addIds: false, addTimestamps: false },
    );

    runner.assertFalse('id' in normalized[0], 'addIds=false should omit generated ids');
    runner.assertFalse('createdAt' in normalized[0], 'addTimestamps=false should omit timestamps');
    runner.assertEqual(normalized[0]?.toolCalls?.[0], { id: 'call-1', name: 'click', args: { selector: '#go' } });
    runner.assertEqual(normalized[1]?.toolCallId, 'call-1');
    runner.assertEqual(normalized[1]?.name, 'click');
  });

  runner.test('toProviderMessages normalizes array content and serializes tool payloads', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const provider = toProviderMessages([
      {
        role: 'system',
        content: ['Rule one', { text: 'Rule two' }, { invalid: true } as any],
      },
      {
        role: 'user',
        content: [
          'Question',
          { text: ' with details' },
          { image_url: { url: 'https://example.com/image.png' } } as any,
        ],
      },
      {
        role: 'tool',
        toolCallId: 'tool-1',
        content: circular as any,
      },
    ]);

    runner.assertTrue(Array.isArray(provider[0]?.content), 'System array content should stay structured');
    runner.assertTrue(Array.isArray(provider[1]?.content), 'User array content should stay structured');
    const toolContent = typeof provider[2]?.content === 'string' ? provider[2].content : '';
    runner.assertIncludes(toolContent, '[object Object]');
  });
}
