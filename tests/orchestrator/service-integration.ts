import type { OrchestratorTaskNode } from '@parchi/shared';
import { AsyncTestRunner, log } from '../integration/shared/runner.js';
import {
  type OrchestratorServiceIntegrationArtifact,
  type OrchestratorServiceScenario,
  callBuiltin,
  createHarnessContext,
  createNestedSpawnStub,
  defaultRunMeta,
  getHistory,
  loadFixture,
} from './service-integration-harness.js';

const getTask = (plan: { tasks?: OrchestratorTaskNode[] } | null | undefined, taskId: string) =>
  plan?.tasks?.find((task) => task.id === taskId) || null;

export async function runOrchestratorServiceIntegrationSuite(
  runner = new AsyncTestRunner(),
): Promise<OrchestratorServiceIntegrationArtifact> {
  log('\n=== Orchestrator Service Integration Harness ===', 'info');

  const ctx = createHarnessContext();
  const sessionState = ctx.getSessionState(defaultRunMeta.sessionId);
  const nestedSpawnStub = createNestedSpawnStub(ctx);
  const scenarios: OrchestratorServiceScenario[] = [];
  const crossSiteFixture = loadFixture('cross-site-write-plan.json');

  await runner.test('set_orchestrator_plan materializes a DAG with ready tasks', async () => {
    const result = await callBuiltin(ctx, 'set_orchestrator_plan', crossSiteFixture);
    runner.assertTrue(result.success === true, 'set_orchestrator_plan should succeed');
    runner.assertTrue(Array.isArray(result.readyTaskIds), 'readyTaskIds should be present');
    runner.assertTrue(result.readyTaskIds.includes('airtable_to_notion'), 'airtable_to_notion should be ready');
    runner.assertTrue(result.readyTaskIds.includes('notion_to_airtable'), 'notion_to_airtable should be ready');
    runner.assertTrue(Boolean(sessionState.orchestratorWhiteboard.get('mapping.fields')), 'seeded whiteboard missing');
    scenarios.push({
      id: 'set-plan',
      passed: true,
      details: {
        readyTaskIds: result.readyTaskIds,
        whiteboardKeys: Array.from(sessionState.orchestratorWhiteboard.keys()),
      },
    });
  });

  await runner.test('dispatch_orchestrator_tasks fans ready tasks into subagent runs', async () => {
    const result = await callBuiltin(ctx, 'dispatch_orchestrator_tasks', { maxTasks: 2 }, nestedSpawnStub);
    runner.assertTrue(result.success === true, 'dispatch should succeed');
    runner.assertEqual(result.dispatched.length, 2, 'two tasks should dispatch in wave one');

    const listed = await callBuiltin(ctx, 'list_subagents', {});
    runner.assertEqual(listed.running.length, 2, 'two subagents should be running');
    scenarios.push({
      id: 'dispatch-wave-one',
      passed: true,
      details: { dispatched: result.dispatched, running: listed.running },
    });
  });

  await runner.test('await_subagent finalizes task outputs and unlocks downstream work', async () => {
    const result = await callBuiltin(ctx, 'await_subagent', {});
    runner.assertTrue(result.success === true, 'await_subagent should succeed');
    runner.assertEqual(result.agents.length, 2, 'two subagents should complete in wave one');
    runner.assertTrue(Boolean(result.whiteboard['sync.airtable_to_notion']), 'missing Airtable output');
    runner.assertTrue(Boolean(result.whiteboard['sync.notion_to_airtable']), 'missing Notion output');

    const plan = sessionState.orchestratorPlan;
    runner.assertEqual(getTask(plan, 'airtable_to_notion')?.status, 'completed');
    runner.assertEqual(getTask(plan, 'notion_to_airtable')?.status, 'completed');
    runner.assertEqual(getTask(plan, 'reconcile')?.status, 'ready');
    scenarios.push({
      id: 'await-wave-one',
      passed: true,
      details: {
        completedAgents: result.agents.map((entry: Record<string, unknown>) => entry.id),
        readyAfterAwait: result.planSummary?.readyTaskIds || [],
      },
    });
  });

  await runner.test('legacy await_agents alias still works and completes the final reconcile wave', async () => {
    const dispatch = await callBuiltin(ctx, 'dispatch_orchestrator_tasks', { maxTasks: 2 }, nestedSpawnStub);
    runner.assertEqual(dispatch.dispatched.length, 1, 'only reconcile should remain');

    const awaitAlias = await callBuiltin(ctx, 'await_agents', {});
    runner.assertTrue(awaitAlias.success === true, 'await_agents alias should succeed');

    const planResult = await callBuiltin(ctx, 'get_orchestrator_plan', {});
    runner.assertEqual(planResult.taskCounts.completed, planResult.taskCounts.total, 'all tasks should complete');
    runner.assertEqual(getTask(planResult.plan, 'reconcile')?.status, 'completed');
    runner.assertTrue(Boolean(planResult.whiteboard['sync.conflicts']), 'missing reconcile output');
    scenarios.push({
      id: 'final-wave',
      passed: true,
      details: { completedTasks: planResult.taskCounts.completed, history: getHistory(sessionState) },
    });
  });

  await runner.test('dispatch_orchestrator_tasks rejects invalid DAGs', async () => {
    const invalidCtx = createHarnessContext();
    await callBuiltin(invalidCtx, 'set_orchestrator_plan', {
      goal: 'Broken DAG',
      tasks: [{ id: 'broken', title: 'Broken task', dependencies: ['missing-task'] }],
    });

    const result = await callBuiltin(invalidCtx, 'dispatch_orchestrator_tasks', {}, createNestedSpawnStub(invalidCtx));
    runner.assertFalse(result.success, 'dispatch should fail for invalid graph');
    runner.assertTrue(Array.isArray(result.validationIssues), 'validationIssues should be present');
    runner.assertTrue(
      result.validationIssues.some((entry: string) => entry.includes('missing dependency')),
      'missing dependency issue expected',
    );
    scenarios.push({
      id: 'invalid-plan-rejected',
      passed: true,
      details: { validationIssues: result.validationIssues },
    });
  });

  return {
    generatedAt: new Date().toISOString(),
    runtimeEventCount: ctx.runtimeEvents.length,
    scenarios,
  };
}
