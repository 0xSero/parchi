import {
  COMMON_TASK_STATUSES,
  PLAN_SPECIFIC_STATUSES,
  PLAN_STATUSES,
  buildRunPlan,
  isPlanStatusTerminal,
  normalizePlanStatus,
  normalizePlanSteps,
} from '@parchi/shared';
import { type TestRunner, log } from '../shared/runner.js';

export function runPlanNormalizationSuite(runner: TestRunner) {
  log('\n=== Testing Plan Normalization ===', 'info');

  runner.test('normalizePlanStatus handles invalid values', () => {
    runner.assertEqual(normalizePlanStatus('done'), 'done');
    runner.assertEqual(normalizePlanStatus('RUNNING'), 'running');
    runner.assertEqual(normalizePlanStatus('unknown'), 'pending');
    runner.assertEqual(normalizePlanStatus(null), 'pending');
  });

  runner.test('normalizePlanSteps trims, filters, and clamps', () => {
    const steps = normalizePlanSteps([
      { title: '  Step one  ', status: 'done' },
      { title: '', status: 'pending' },
      { title: 'Step two', status: 'blocked', notes: '  Needs access  ' },
    ]);
    runner.assertEqual(steps.length, 2);
    runner.assertEqual(steps[0].id, 'step-1');
    runner.assertEqual(steps[1].status, 'blocked');
    runner.assertEqual(steps[1].notes, 'Needs access');

    const tooMany = normalizePlanSteps(
      Array.from({ length: 12 }, (_, idx) => ({
        title: `Step ${idx + 1}`,
        status: 'pending',
      })),
    );
    runner.assertEqual(tooMany.length, 8);
    runner.assertEqual(normalizePlanSteps('bad-input' as any), []);
  });

  runner.test('buildRunPlan preserves createdAt and updates timestamps', () => {
    const now = Date.now();
    const existing = buildRunPlan([{ title: 'Step one', status: 'pending' }], {
      now,
    });
    const updated = buildRunPlan([{ title: 'Step two', status: 'done' }], {
      existingPlan: existing,
      now: now + 5000,
    });
    runner.assertEqual(updated.createdAt, existing.createdAt);
    runner.assertTrue(updated.updatedAt > existing.updatedAt, 'updatedAt should advance');
    runner.assertEqual(updated.steps[0].title, 'Step two');
  });

  runner.test('normalizePlanSteps accepts string inputs and buildRunPlan append mode renumbers steps', () => {
    const normalized = normalizePlanSteps([' First ', { title: 'Second', status: 'RUNNING' }], { maxSteps: 3 });
    runner.assertEqual(
      normalized.map((step) => step.title),
      ['First', 'Second'],
    );
    runner.assertEqual(normalized[1]?.status, 'running');

    const existing = buildRunPlan([{ title: 'Existing one', status: 'done' }], {
      now: 1,
    });
    const appended = buildRunPlan(['New one', 'New two'], {
      existingPlan: existing,
      mode: 'append',
      now: 2,
      maxSteps: 5,
    });

    runner.assertEqual(
      appended.steps.map((step) => step.id),
      ['step-1', 'step-2', 'step-3'],
    );
    runner.assertEqual(
      appended.steps.map((step) => step.title),
      ['Existing one', 'New one', 'New two'],
    );
  });

  runner.test('PLAN_STATUSES includes all common task statuses', () => {
    // Verify PLAN_STATUSES includes all COMMON_TASK_STATUSES
    for (const status of COMMON_TASK_STATUSES) {
      runner.assertTrue(PLAN_STATUSES.includes(status), `PLAN_STATUSES should include ${status}`);
    }
  });

  runner.test('PLAN_STATUSES includes plan-specific done status', () => {
    runner.assertTrue(PLAN_SPECIFIC_STATUSES.includes('done'), 'PLAN_SPECIFIC_STATUSES should include done');
    runner.assertTrue(PLAN_STATUSES.includes('done'), 'PLAN_STATUSES should include done');
  });

  runner.test('PLAN_STATUSES has correct count', () => {
    // COMMON_TASK_STATUSES (3: pending, running, blocked) + PLAN_SPECIFIC_STATUSES (1: done) = 4
    runner.assertEqual(PLAN_STATUSES.length, COMMON_TASK_STATUSES.length + PLAN_SPECIFIC_STATUSES.length);
  });

  runner.test('isPlanStatusTerminal identifies terminal states', () => {
    runner.assertTrue(isPlanStatusTerminal('done'), 'done is terminal');
    runner.assertFalse(isPlanStatusTerminal('pending'), 'pending is not terminal');
    runner.assertFalse(isPlanStatusTerminal('running'), 'running is not terminal');
    runner.assertFalse(isPlanStatusTerminal('blocked'), 'blocked is not terminal');
  });

  runner.test('normalizePlanStatus handles all plan statuses', () => {
    runner.assertEqual(normalizePlanStatus('pending'), 'pending');
    runner.assertEqual(normalizePlanStatus('running'), 'running');
    runner.assertEqual(normalizePlanStatus('blocked'), 'blocked');
    runner.assertEqual(normalizePlanStatus('done'), 'done');
    // Case normalization
    runner.assertEqual(normalizePlanStatus('PENDING'), 'pending');
    runner.assertEqual(normalizePlanStatus('DONE'), 'done');
  });
}
