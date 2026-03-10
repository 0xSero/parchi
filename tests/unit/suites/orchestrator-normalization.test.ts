import {
  COMMON_TASK_STATUSES,
  type CommonTaskStatus,
  type OrchestratorTaskStatus,
  buildOrchestratorPlan,
  getDispatchableOrchestratorTaskIds,
  getOrchestratorPlanValidationIssues,
  getReadyOrchestratorTaskIds,
  isOrchestratorTaskTerminal,
  normalizeOrchestratorTaskStatus,
  normalizeOrchestratorTasks,
} from '@parchi/shared';
import { type TestRunner, log } from '../shared/runner.js';

export function runOrchestratorNormalizationSuite(runner: TestRunner) {
  log('\n=== Testing Orchestrator Normalization ===', 'info');

  runner.test('normalizeOrchestratorTaskStatus handles valid values', () => {
    runner.assertEqual(normalizeOrchestratorTaskStatus('pending'), 'pending');
    runner.assertEqual(normalizeOrchestratorTaskStatus('ready'), 'ready');
    runner.assertEqual(normalizeOrchestratorTaskStatus('running'), 'running');
    runner.assertEqual(normalizeOrchestratorTaskStatus('blocked'), 'blocked');
    runner.assertEqual(normalizeOrchestratorTaskStatus('completed'), 'completed');
    runner.assertEqual(normalizeOrchestratorTaskStatus('failed'), 'failed');
    runner.assertEqual(normalizeOrchestratorTaskStatus('cancelled'), 'cancelled');
  });

  runner.test('normalizeOrchestratorTaskStatus normalizes case', () => {
    runner.assertEqual(normalizeOrchestratorTaskStatus('PENDING'), 'pending');
    runner.assertEqual(normalizeOrchestratorTaskStatus('RUNNING'), 'running');
    runner.assertEqual(normalizeOrchestratorTaskStatus('COMPLETED'), 'completed');
  });

  runner.test('normalizeOrchestratorTaskStatus handles invalid values', () => {
    runner.assertEqual(normalizeOrchestratorTaskStatus('unknown'), 'pending');
    runner.assertEqual(normalizeOrchestratorTaskStatus(''), 'pending');
    runner.assertEqual(normalizeOrchestratorTaskStatus(null as any), 'pending');
    runner.assertEqual(normalizeOrchestratorTaskStatus(undefined as any), 'pending');
    runner.assertEqual(normalizeOrchestratorTaskStatus(123 as any), 'pending');
  });

  runner.test('isOrchestratorTaskTerminal identifies terminal states', () => {
    runner.assertTrue(isOrchestratorTaskTerminal('completed'), 'completed is terminal');
    runner.assertTrue(isOrchestratorTaskTerminal('failed'), 'failed is terminal');
    runner.assertTrue(isOrchestratorTaskTerminal('cancelled'), 'cancelled is terminal');
    runner.assertFalse(isOrchestratorTaskTerminal('pending'), 'pending is not terminal');
    runner.assertFalse(isOrchestratorTaskTerminal('ready'), 'ready is not terminal');
    runner.assertFalse(isOrchestratorTaskTerminal('running'), 'running is not terminal');
    runner.assertFalse(isOrchestratorTaskTerminal('blocked'), 'blocked is not terminal');
  });

  runner.test('normalizeOrchestratorTasks handles valid task array', () => {
    const tasks = normalizeOrchestratorTasks([
      { id: 'task-1', title: 'First task', kind: 'browser' },
      { id: 'task-2', title: 'Second task', kind: 'research', status: 'completed' },
    ]);
    runner.assertEqual(tasks.length, 2);
    runner.assertEqual(tasks[0].id, 'task-1');
    runner.assertEqual(tasks[0].status, 'pending');
    runner.assertEqual(tasks[1].status, 'completed');
  });

  runner.test('normalizeOrchestratorTasks filters invalid entries', () => {
    const tasks = normalizeOrchestratorTasks([
      { id: 'task-1', title: 'Valid task' },
      { id: 'task-2' }, // No title - should be filtered
      { title: 'Another valid' }, // No id - auto-generated as task-3 (based on original index)
      null,
      undefined,
    ]);
    runner.assertEqual(tasks.length, 2);
    runner.assertEqual(tasks[0].title, 'Valid task');
    runner.assertEqual(tasks[1].id, 'task-3'); // Auto-generated from original array index 2
  });

  runner.test('normalizeOrchestratorTasks handles dependencies normalization', () => {
    const tasks = normalizeOrchestratorTasks([
      { id: 'task-1', title: 'Task one', dependencies: ['  task-2  ', '', 'task-1'] },
      { id: 'task-2', title: 'Task two' },
    ]);
    runner.assertEqual(tasks[0].dependencies.length, 1);
    runner.assertEqual(tasks[0].dependencies[0], 'task-2');
    // Self-referencing dependency should be filtered
  });

  runner.test('buildOrchestratorPlan creates valid plan', () => {
    const plan = buildOrchestratorPlan({
      goal: 'Test goal',
      tasks: [{ id: 't1', title: 'Task 1' }],
    });
    runner.assertEqual(plan.version, 1);
    runner.assertEqual(plan.goal, 'Test goal');
    runner.assertEqual(plan.tasks.length, 1);
    runner.assertTrue(typeof plan.createdAt === 'number');
    runner.assertTrue(typeof plan.updatedAt === 'number');
  });

  runner.test('buildOrchestratorPlan merges whiteboardKeys from task inputs/outputs', () => {
    const plan = buildOrchestratorPlan({
      tasks: [
        {
          id: 't1',
          title: 'Task 1',
          inputs: [{ key: 'input1' }],
          outputs: [{ key: 'output1' }],
        },
      ],
      whiteboardKeys: ['customKey'],
    });
    runner.assertTrue(plan.whiteboardKeys.includes('input1'));
    runner.assertTrue(plan.whiteboardKeys.includes('output1'));
    runner.assertTrue(plan.whiteboardKeys.includes('customKey'));
  });

  runner.test('buildOrchestratorPlan preserves existing plan timestamps', () => {
    const existingCreatedAt = 1000;
    const now = 5000;
    const existing = buildOrchestratorPlan({ goal: 'Old goal' }, { now: existingCreatedAt });
    const updated = buildOrchestratorPlan({ goal: 'New goal' }, { existingPlan: existing, now });
    runner.assertEqual(updated.createdAt, existingCreatedAt);
    runner.assertEqual(updated.updatedAt, now);
  });

  runner.test('getReadyOrchestratorTaskIds returns tasks with satisfied dependencies', () => {
    const plan = buildOrchestratorPlan({
      tasks: [
        { id: 't1', title: 'Task 1', status: 'completed' },
        { id: 't2', title: 'Task 2', dependencies: ['t1'] },
        { id: 't3', title: 'Task 3', dependencies: ['t1', 't2'] },
        { id: 't4', title: 'Task 4', dependencies: ['missing-task'] },
        { id: 't5', title: 'Task 5', status: 'blocked' },
        { id: 't6', title: 'Task 6', status: 'running' },
      ],
    });
    const ready = getReadyOrchestratorTaskIds(plan);
    // t2 is ready (only depends on completed t1)
    // t3 is not ready (depends on t2 which is pending)
    // t4 is ready in terms of dependency check but depends on missing task
    // t5 is blocked, not pending
    // t6 is running
    runner.assertTrue(ready.includes('t2'), 't2 should be ready');
    runner.assertFalse(ready.includes('t3'), 't3 should not be ready');
    runner.assertFalse(ready.includes('t5'), 'blocked tasks not ready');
    runner.assertFalse(ready.includes('t6'), 'running tasks not ready');
  });

  runner.test('getDispatchableOrchestratorTaskIds respects maxSlots', () => {
    const plan = buildOrchestratorPlan({
      tasks: [
        { id: 't1', title: 'Task 1', status: 'completed' },
        { id: 't2', title: 'Task 2', dependencies: ['t1'] },
        { id: 't3', title: 'Task 3', dependencies: ['t1'] },
        { id: 't4', title: 'Task 4', dependencies: ['t1'] },
      ],
      maxConcurrentTabs: 2,
    });
    const dispatchable = getDispatchableOrchestratorTaskIds(plan, { maxSlots: 2 });
    runner.assertEqual(dispatchable.length, 2);
  });

  runner.test('getDispatchableOrchestratorTaskIds excludes running tasks', () => {
    const plan = buildOrchestratorPlan({
      tasks: [
        { id: 't1', title: 'Task 1', status: 'completed' },
        { id: 't2', title: 'Task 2', dependencies: ['t1'] },
      ],
    });
    const dispatchable = getDispatchableOrchestratorTaskIds(plan, { runningTaskIds: ['t2'] });
    runner.assertEqual(dispatchable.length, 0);
  });

  runner.test('getOrchestratorPlanValidationIssues detects missing dependencies', () => {
    const plan = buildOrchestratorPlan({
      tasks: [{ id: 't1', title: 'Task 1', dependencies: ['nonexistent'] }],
    });
    const issues = getOrchestratorPlanValidationIssues(plan);
    runner.assertTrue(issues.length > 0);
    runner.assertTrue(issues.some((i) => i.includes('missing dependency')));
  });

  runner.test('getOrchestratorPlanValidationIssues detects dependency cycles', () => {
    const plan = buildOrchestratorPlan({
      tasks: [
        { id: 't1', title: 'Task 1', dependencies: ['t2'] },
        { id: 't2', title: 'Task 2', dependencies: ['t3'] },
        { id: 't3', title: 'Task 3', dependencies: ['t1'] },
      ],
    });
    const issues = getOrchestratorPlanValidationIssues(plan);
    runner.assertTrue(issues.some((i) => i.includes('cycle')));
  });

  runner.test('COMMON_TASK_STATUSES contains shared status values', () => {
    runner.assertTrue(COMMON_TASK_STATUSES.includes('pending'));
    runner.assertTrue(COMMON_TASK_STATUSES.includes('running'));
    runner.assertTrue(COMMON_TASK_STATUSES.includes('blocked'));
    runner.assertEqual(COMMON_TASK_STATUSES.length, 3);
  });

  runner.test('CommonTaskStatus type is compatible with both status types', () => {
    // This test verifies type compatibility at compile time
    const commonPending: CommonTaskStatus = 'pending';
    const commonRunning: CommonTaskStatus = 'running';
    const commonBlocked: CommonTaskStatus = 'blocked';

    // CommonTaskStatus should be assignable to OrchestratorTaskStatus
    // (since OrchestratorTaskStatus extends CommonTaskStatus)
    const orchestratorCompatible: OrchestratorTaskStatus = commonPending;
    void orchestratorCompatible; // Mark as intentionally used

    runner.assertEqual(commonPending, 'pending');
    runner.assertEqual(commonRunning, 'running');
    runner.assertEqual(commonBlocked, 'blocked');
  });
}
