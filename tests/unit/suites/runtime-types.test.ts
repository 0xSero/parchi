/**
 * Tests for extracted runtime helper types.
 * Tests TokenUsage, ContextUsageSnapshot, TokenTraceSnapshot, etc.
 */
import {
  type ContextUsageSnapshot,
  type RetryCounts,
  type RuntimeBenchmarkContext,
  type RuntimeLatencyMetrics,
  type TokenTraceSnapshot,
  type TokenUsage,
  runStatusPhases,
} from '@parchi/shared';
import { type TestRunner, log } from '../shared/runner.js';

export function runRuntimeTypesSuite(runner: TestRunner) {
  log('\n=== Testing Runtime Message Types ===', 'info');

  runner.test('TokenUsage type allows optional token counts', () => {
    const minimal: TokenUsage = {};
    const partial: TokenUsage = { inputTokens: 100, outputTokens: 50 };
    const full: TokenUsage = { inputTokens: 100, outputTokens: 50, totalTokens: 150 };
    runner.assertEqual(minimal.inputTokens, undefined);
    runner.assertEqual(partial.inputTokens, 100);
    runner.assertEqual(full.totalTokens, 150);
  });

  runner.test('ContextUsageSnapshot type tracks context utilization', () => {
    const minimal: ContextUsageSnapshot = {};
    const partial: ContextUsageSnapshot = { approxTokens: 50000, contextLimit: 200000 };
    const full: ContextUsageSnapshot = { approxTokens: 100000, contextLimit: 200000, percent: 50 };
    runner.assertEqual(minimal.approxTokens, undefined);
    runner.assertEqual(partial.percent, undefined);
    runner.assertEqual(full.percent, 50);
  });

  runner.test('TokenTraceSnapshot type captures token state for tracing', () => {
    const snapshot: TokenTraceSnapshot = {
      providerInputTokens: 1000,
      providerOutputTokens: 500,
      contextApproxTokens: 1500,
      contextLimit: 200000,
      contextPercent: 0.75,
      sessionInputTokens: 1500,
      sessionOutputTokens: 800,
      sessionTotalTokens: 2300,
    };
    runner.assertEqual(snapshot.providerInputTokens, 1000);
    runner.assertEqual(snapshot.sessionTotalTokens, 2300);
    // Nullable fields should work
    const nullable: TokenTraceSnapshot = { providerInputTokens: null, contextApproxTokens: null };
    runner.assertEqual(nullable.providerInputTokens, null);
  });

  runner.test('RuntimeLatencyMetrics type tracks run timing', () => {
    const metrics: RuntimeLatencyMetrics = {
      runStartAt: 1000,
      completedAt: 5000,
      totalMs: 4000,
      stream: true,
    };
    runner.assertEqual(metrics.totalMs, 4000);
    runner.assertEqual(metrics.ttfbMs, undefined);
    const withOptional: RuntimeLatencyMetrics = {
      runStartAt: 1000,
      completedAt: 5000,
      totalMs: 4000,
      ttfbMs: 500,
      firstTokenMs: 600,
      stream: true,
      modelAttempts: 3,
    };
    runner.assertEqual(withOptional.modelAttempts, 3);
  });

  runner.test('RuntimeBenchmarkContext type captures benchmark data', () => {
    const success: RuntimeBenchmarkContext = { success: true, provider: 'openai', model: 'gpt-4' };
    const failure: RuntimeBenchmarkContext = { success: false, errorCategory: 'rate_limit' };
    runner.assertTrue(success.success);
    runner.assertEqual(failure.provider, undefined);
    runner.assertEqual(failure.errorCategory, 'rate_limit');
  });

  runner.test('RetryCounts type tracks retry attempts', () => {
    const counts: RetryCounts = { api: 0, tool: 1, finalize: 0 };
    runner.assertEqual(counts.api, 0);
    runner.assertEqual(counts.tool, 1);
    runner.assertEqual(counts.finalize, 0);
  });

  runner.test('runStatusPhases contains all expected phases', () => {
    runner.assertEqual(runStatusPhases.length, 6);
    runner.assertTrue(runStatusPhases.includes('planning'));
    runner.assertTrue(runStatusPhases.includes('executing'));
    runner.assertTrue(runStatusPhases.includes('finalizing'));
    runner.assertTrue(runStatusPhases.includes('completed'));
    runner.assertTrue(runStatusPhases.includes('stopped'));
    runner.assertTrue(runStatusPhases.includes('failed'));
  });
}
