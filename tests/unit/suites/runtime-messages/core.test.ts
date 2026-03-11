import { RUNTIME_MESSAGE_SCHEMA_VERSION, isRuntimeMessage } from '@parchi/shared';
import type { RunPlan, RuntimeMessage } from '@parchi/shared';
import { type TestRunner, log } from '../../shared/runner.js';

export function runRuntimeMessagesCoreSuite(runner: TestRunner) {
  log('\n=== Testing Runtime Message Core ===', 'info');

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
}
