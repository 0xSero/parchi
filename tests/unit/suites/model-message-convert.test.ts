import type { Message } from '../../../packages/extension/ai/messages/schema.js';
import { toModelMessages } from '../../../packages/extension/ai/models/convert.js';
import { type TestRunner, log } from '../shared/runner.js';

export function runModelMessageConvertSuite(runner: TestRunner) {
  log('\n=== Testing Model Message Conversion ===', 'info');

  runner.test('Tool results without top-level toolCallId are recovered from content entries', () => {
    const history: Message[] = [
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'set_plan:0', name: 'set_plan', args: {} },
          { id: 'navigate:1', name: 'navigate', args: { url: 'https://example.com' } },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'set_plan:0',
            toolName: 'set_plan',
            output: { success: true },
          },
          {
            type: 'tool-result',
            toolCallId: 'navigate:1',
            toolName: 'navigate',
            output: { success: true },
          },
        ],
      },
    ];

    const messages = toModelMessages(history);
    const toolMessages = messages.filter((msg) => msg.role === 'tool');

    runner.assertEqual(toolMessages.length, 2, 'Expected one model tool message per tool call');
    runner.assertTrue(
      JSON.stringify(toolMessages).includes('set_plan:0') && JSON.stringify(toolMessages).includes('navigate:1'),
      'Recovered tool messages should preserve toolCallId values',
    );
  });

  runner.test('Tool results with unknown toolCallId are filtered out', () => {
    const history: Message[] = [
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'known:1', name: 'getContent', args: {} }],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'unknown:9',
            toolName: 'getContent',
            output: { success: true },
          },
        ],
      },
    ];

    const messages = toModelMessages(history);
    const toolMessages = messages.filter((msg) => msg.role === 'tool');
    runner.assertEqual(toolMessages.length, 0, 'Unknown tool_call_id entries should be dropped');
  });

  runner.test('Assistant tool call groups are dropped unless every tool result stays contiguous', () => {
    const history: Message[] = [
      {
        role: 'assistant',
        content: 'Calling tools',
        toolCalls: [
          { id: 'present:1', name: 'getContent', args: {} },
          { id: 'missing:2', name: 'scroll', args: { direction: 'down' } },
        ],
      },
      {
        role: 'tool',
        toolCallId: 'present:1',
        toolName: 'getContent',
        content: { success: true },
      },
    ];

    const messages = toModelMessages(history);
    const assistant = messages.find((msg) => msg.role === 'assistant') as any;
    const assistantContent = Array.isArray(assistant?.content) ? assistant.content : [];
    const toolCallIds = assistantContent
      .filter((part: any) => part?.type === 'tool-call')
      .map((part: any) => String(part.toolCallId || ''));

    runner.assertFalse(
      toolCallIds.includes('present:1'),
      'Partial tool-call groups should be removed to avoid invalid assistant/tool ordering',
    );
    runner.assertFalse(toolCallIds.includes('missing:2'), 'Expected orphan tool call to be removed');
  });

  runner.test('Non-adjacent tool results are stripped to avoid invalid assistant/tool ordering', () => {
    const history: Message[] = [
      {
        role: 'assistant',
        content: 'Calling tool',
        toolCalls: [{ id: 'tool-1', name: 'click', args: { selector: '#go' } }],
      },
      {
        role: 'system',
        content: 'Compaction checkpoint',
      },
      {
        role: 'tool',
        toolCallId: 'tool-1',
        toolName: 'click',
        content: { success: true },
      },
    ];

    const messages = toModelMessages(history);
    const assistant = messages.find((msg) => msg.role === 'assistant') as any;
    const assistantContent = Array.isArray(assistant?.content) ? assistant.content : [];

    runner.assertEqual(messages.filter((msg) => msg.role === 'tool').length, 0);
    runner.assertEqual(
      assistantContent.filter((part: any) => part?.type === 'tool-call').length,
      0,
      'Tool calls should be removed when tool results are no longer adjacent',
    );
  });

  runner.test('toModelMessages normalizes user/system payloads and direct tool messages', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const messages = toModelMessages([
      {
        role: 'system',
        content: ['Rule one', { text: 'Rule two' }, { invalid: true } as any],
      },
      {
        role: 'user',
        content: ['hello', { text: 'world' }, { image_url: { url: 'https://example.com/image.png' } } as any],
      },
      {
        role: 'assistant',
        content: { structured: true } as any,
      },
      {
        role: 'assistant',
        content: 'Calling tool',
        toolCalls: [{ id: 'tool-1', name: 'click', args: { selector: '#go' } }],
      },
      {
        role: 'tool',
        toolCallId: 'tool-1',
        toolName: 'click',
        content: circular as any,
      },
    ] as Message[]);

    runner.assertEqual(messages[0]?.role, 'system');
    runner.assertEqual(messages[0]?.content, 'Rule one\nRule two\n');
    runner.assertTrue(Array.isArray(messages[1]?.content), 'User content should be structured array');
    runner.assertEqual(messages[2]?.content, JSON.stringify({ structured: true }));

    const toolMessage = messages.find((message) => message.role === 'tool') as any;
    runner.assertEqual(toolMessage.content?.[0]?.toolCallId, 'tool-1');
    runner.assertEqual(toolMessage.content?.[0]?.output?.type, 'json');
  });
}
