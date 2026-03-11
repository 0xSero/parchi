import { RUNTIME_MESSAGE_SCHEMA_VERSION, isRuntimeMessage } from '@parchi/shared';
import type { RunPlan, RuntimeMessage } from '@parchi/shared';
import { type TestRunner, log } from '../shared/runner.js';

export function runRuntimeMessagesSuite(runner: TestRunner) {
  log('\n=== Testing Runtime Message Schema ===', 'info');

  runner.test('Runtime messages are discriminated and serializable', () => {
    const base = {
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      runId: 'run-test',
      turnId: 'turn-1',
      sessionId: 'session-test',
      timestamp: Date.now(),
    };
    const plan: RunPlan = {
      steps: [{ id: 'step-1', title: 'Do something', status: 'pending' }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const samples: RuntimeMessage[] = [
      { ...base, type: 'user_run_start', message: 'hello' },
      { ...base, type: 'assistant_stream_start' },
      { ...base, type: 'assistant_stream_delta', content: 'partial' },
      { ...base, type: 'assistant_stream_stop' },
      {
        ...base,
        type: 'tool_execution_start',
        tool: 'click',
        id: 'tool-1',
        args: { selector: '#id' },
      },
      {
        ...base,
        type: 'tool_execution_result',
        tool: 'click',
        id: 'tool-1',
        args: { selector: '#id' },
        result: { success: true },
      },
      { ...base, type: 'plan_update', plan },
      {
        ...base,
        type: 'manual_plan_update',
        steps: [{ title: 'Review plan', status: 'pending' }],
      },
      {
        ...base,
        type: 'run_status',
        phase: 'executing',
        attempts: { api: 0, tool: 1, finalize: 0 },
        maxRetries: { api: 2, tool: 2, finalize: 1 },
        lastError: 'Tool failed',
      },
      {
        ...base,
        type: 'run_status',
        phase: 'stopped',
        attempts: { api: 0, tool: 0, finalize: 0 },
        maxRetries: { api: 1, tool: 1, finalize: 1 },
        note: 'Stopped by user',
      },
      {
        ...base,
        type: 'assistant_final',
        content: 'Done',
        thinking: 'Thoughts',
        usage: { inputTokens: 10 },
      },
      {
        ...base,
        type: 'subagent_start',
        id: 'subagent-1',
        name: 'Researcher',
        tasks: ['Inspect pricing'],
        agentId: 'subagent-1',
        agentName: 'Researcher',
        agentKind: 'subagent',
        agentSessionId: 'session-test::subagent-1',
        parentSessionId: 'session-test',
      },
      {
        ...base,
        type: 'subagent_tab_assigned',
        id: 'subagent-1',
        name: 'Researcher',
        tabId: 12,
        url: 'https://example.com',
        agentId: 'subagent-1',
        agentName: 'Researcher',
        agentKind: 'subagent',
        agentSessionId: 'session-test::subagent-1',
        parentSessionId: 'session-test',
        colorIndex: 2,
      },
      {
        ...base,
        type: 'subagent_complete',
        id: 'subagent-1',
        success: true,
        summary: 'Done',
        agentId: 'subagent-1',
        agentName: 'Researcher',
        agentKind: 'subagent',
        agentSessionId: 'session-test::subagent-1',
        parentSessionId: 'session-test',
      },
      {
        ...base,
        type: 'compaction_event',
        stage: 'applied',
        source: 'auto',
        note: 'Compaction applied.',
        details: { trimmedCount: 10, preservedCount: 5 },
      },
      {
        ...base,
        type: 'context_compacted',
        source: 'auto',
        startFreshSession: true,
        summary: 'Compaction result summary',
        trimmedCount: 10,
        preservedCount: 5,
        newSessionId: 'session-next',
        contextMessages: [{ role: 'system', content: 'Summary' }],
        beforeContextUsage: { approxTokens: 120000, contextLimit: 200000, percent: 60 },
        contextUsage: { approxTokens: 22000, contextLimit: 200000, percent: 11 },
        compactionMetrics: {
          reason: 'compacted',
          decision: { shouldCompact: true, percent: 60 },
          compaction: { removedApproxTokensLowerBound: 98000 },
        },
      },
      { ...base, type: 'run_error', message: 'Boom' },
      { ...base, type: 'run_warning', message: 'Heads up' },
      {
        ...base,
        type: 'token_trace',
        action: 'assistant_final',
        reason: 'new_assistant_usage',
        before: { providerInputTokens: 1000, contextApproxTokens: 1000, contextLimit: 200000, contextPercent: 1 },
        after: {
          providerInputTokens: 1500,
          providerOutputTokens: 800,
          contextApproxTokens: 1500,
          contextLimit: 200000,
          contextPercent: 1,
          sessionInputTokens: 1500,
          sessionOutputTokens: 800,
          sessionTotalTokens: 2300,
        },
      },
    ];

    samples.forEach((sample) => {
      const json = JSON.stringify(sample);
      const parsed = JSON.parse(json);
      runner.assertTrue(isRuntimeMessage(parsed), `Runtime message ${sample.type} should validate`);
    });
  });

  runner.test('Runtime messages reject invalid schema versions or types', () => {
    runner.assertFalse(isRuntimeMessage(null), 'Should reject non-objects');
    const badVersion = {
      type: 'assistant_final',
      schemaVersion: 999,
      runId: 'run-test',
      timestamp: Date.now(),
      content: 'Hi',
    };
    const badType = {
      type: 'unknown_type',
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      runId: 'run-test',
      timestamp: Date.now(),
    };
    const missingRunId = {
      type: 'assistant_final',
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      timestamp: Date.now(),
      content: 'Hi',
    };
    runner.assertFalse(isRuntimeMessage(badVersion), 'Should reject mismatched schema versions');
    runner.assertFalse(isRuntimeMessage(badType), 'Should reject unknown message types');
    runner.assertFalse(isRuntimeMessage(missingRunId), 'Should reject missing runId');
    runner.assertFalse(
      isRuntimeMessage({
        type: 'assistant_final',
        schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
        runId: 'run-test',
        sessionId: '',
        timestamp: Date.now(),
      }),
      'Should reject blank sessionId',
    );
    runner.assertFalse(
      isRuntimeMessage({
        type: 'assistant_final',
        schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
        runId: 'run-test',
        sessionId: 'session-test',
        timestamp: 'bad',
      }),
      'Should reject non-numeric timestamps',
    );
  });

  runner.test('assistant_response message serializes and deserializes correctly', () => {
    const message = {
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      type: 'assistant_response' as const,
      runId: 'run-test',
      sessionId: 'session-test',
      turnId: 'turn-1',
      timestamp: Date.now(),
      content: 'This is the assistant response content',
      thinking: 'I should respond thoughtfully',
      model: 'claude-3-5-sonnet',
    };
    const json = JSON.stringify(message);
    const parsed = JSON.parse(json);
    runner.assertTrue(isRuntimeMessage(parsed), 'assistant_response should validate');
    runner.assertEqual(parsed.type, 'assistant_response', 'Type should be preserved');
    runner.assertEqual(parsed.content, message.content, 'Content should be preserved');
    runner.assertEqual(parsed.thinking, message.thinking, 'Thinking should be preserved');
    runner.assertEqual(parsed.model, message.model, 'Model should be preserved');
  });

  runner.test('assistant_response message handles minimal variant', () => {
    const message = {
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      type: 'assistant_response' as const,
      runId: 'run-test',
      sessionId: 'session-test',
      timestamp: Date.now(),
      content: 'Simple response',
    };
    const json = JSON.stringify(message);
    const parsed = JSON.parse(json);
    runner.assertTrue(isRuntimeMessage(parsed), 'Minimal assistant_response should validate');
    runner.assertEqual(parsed.content, 'Simple response', 'Content should be preserved');
  });

  runner.test('report_image_captured message serializes and deserializes correctly', () => {
    const message = {
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      type: 'report_image_captured' as const,
      runId: 'run-test',
      sessionId: 'session-test',
      timestamp: Date.now(),
      image: {
        id: 'img-123',
        dataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        capturedAt: Date.now(),
        toolCallId: 'tool-456',
        tabId: 42,
        url: 'https://example.com/page',
        title: 'Example Page',
        visionDescription: 'A screenshot of the example page',
        selected: true,
      },
      images: [
        {
          id: 'img-123',
          capturedAt: Date.now(),
          url: 'https://example.com/page',
          title: 'Example Page',
          tabId: 42,
          visionDescription: 'A screenshot of the example page',
          selected: true,
        },
      ],
      selectedImageIds: ['img-123'],
    };
    const json = JSON.stringify(message);
    const parsed = JSON.parse(json);
    runner.assertTrue(isRuntimeMessage(parsed), 'report_image_captured should validate');
    runner.assertEqual(parsed.type, 'report_image_captured', 'Type should be preserved');
    runner.assertEqual(parsed.image.id, 'img-123', 'Image ID should be preserved');
    runner.assertEqual(parsed.image.selected, true, 'Selected flag should be preserved');
    runner.assertEqual(parsed.selectedImageIds.length, 1, 'Selected image IDs should be preserved');
  });

  runner.test('report_images_selection message serializes and deserializes correctly', () => {
    const message = {
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      type: 'report_images_selection' as const,
      runId: 'run-test',
      sessionId: 'session-test',
      timestamp: Date.now(),
      images: [
        {
          id: 'img-1',
          capturedAt: Date.now() - 1000,
          url: 'https://example.com/page1',
          title: 'Page 1',
          tabId: 1,
          visionDescription: 'First screenshot',
          selected: false,
        },
        {
          id: 'img-2',
          capturedAt: Date.now(),
          url: 'https://example.com/page2',
          title: 'Page 2',
          tabId: 2,
          visionDescription: 'Second screenshot',
          selected: true,
        },
      ],
      selectedImageIds: ['img-2'],
    };
    const json = JSON.stringify(message);
    const parsed = JSON.parse(json);
    runner.assertTrue(isRuntimeMessage(parsed), 'report_images_selection should validate');
    runner.assertEqual(parsed.type, 'report_images_selection', 'Type should be preserved');
    runner.assertEqual(parsed.images.length, 2, 'Images array should be preserved');
    runner.assertEqual(parsed.selectedImageIds[0], 'img-2', 'Selected image IDs should be preserved');
    runner.assertEqual(parsed.images[0].selected, false, 'First image should be unselected');
    runner.assertEqual(parsed.images[1].selected, true, 'Second image should be selected');
  });

  runner.test('session_tabs_update message serializes and deserializes correctly', () => {
    const message = {
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      type: 'session_tabs_update' as const,
      runId: 'run-test',
      sessionId: 'session-test',
      timestamp: Date.now(),
      tabs: [
        { id: 1, title: 'Tab One', url: 'https://example.com/one' },
        { id: 2, title: 'Tab Two', url: 'https://example.com/two' },
        { id: 3, title: 'Tab Three', url: 'https://example.com/three' },
      ],
      activeTabId: 2,
      maxTabs: 10,
      groupTitle: 'My Tab Group',
    };
    const json = JSON.stringify(message);
    const parsed = JSON.parse(json);
    runner.assertTrue(isRuntimeMessage(parsed), 'session_tabs_update should validate');
    runner.assertEqual(parsed.type, 'session_tabs_update', 'Type should be preserved');
    runner.assertEqual(parsed.tabs.length, 3, 'Tabs array should be preserved');
    runner.assertEqual(parsed.activeTabId, 2, 'Active tab ID should be preserved');
    runner.assertEqual(parsed.maxTabs, 10, 'Max tabs should be preserved');
    runner.assertEqual(parsed.groupTitle, 'My Tab Group', 'Group title should be preserved');
    runner.assertEqual(parsed.tabs[0].title, 'Tab One', 'Tab title should be preserved');
    runner.assertEqual(parsed.tabs[0].url, 'https://example.com/one', 'Tab URL should be preserved');
  });

  runner.test('session_tabs_update message handles minimal variant', () => {
    const message = {
      schemaVersion: RUNTIME_MESSAGE_SCHEMA_VERSION,
      type: 'session_tabs_update' as const,
      runId: 'run-test',
      sessionId: 'session-test',
      timestamp: Date.now(),
      tabs: [],
      activeTabId: null,
      maxTabs: 5,
    };
    const json = JSON.stringify(message);
    const parsed = JSON.parse(json);
    runner.assertTrue(isRuntimeMessage(parsed), 'Minimal session_tabs_update should validate');
    runner.assertEqual(parsed.tabs.length, 0, 'Empty tabs array should be preserved');
    runner.assertEqual(parsed.activeTabId, null, 'Null activeTabId should be preserved');
  });
}
