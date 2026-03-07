import fs from 'node:fs';
import path from 'node:path';
import type { FixtureExecutionResult } from './fixture-executor.js';

export type SystemValidationCriteria = {
  version: string;
  title: string;
  updatedAt: string;
  systemContracts: Array<{ id: string; description: string; threshold: string }>;
  validationCriteria: Array<{ id: string; description: string }>;
  gateCriteria: Array<{ id: string; command: string; required: boolean }>;
  requiredArtifacts: string[];
};

export type FixtureCriteriaResult = {
  fixture: string;
  checks: Array<{ id: string; passed: boolean; detail: string }>;
  passed: boolean;
};

const repoRoot = path.resolve(process.cwd());

export function loadSystemValidationCriteria(): SystemValidationCriteria {
  const filePath = path.join(repoRoot, 'tests/fixtures/orchestrator/system-validation-criteria.json');
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return parsed as SystemValidationCriteria;
}

export function evaluateFixtureAgainstCriteria(
  criteria: SystemValidationCriteria,
  result: FixtureExecutionResult,
): FixtureCriteriaResult {
  const checks = criteria.validationCriteria.map((criterion) => {
    switch (criterion.id) {
      case 'goal.success':
        return { id: criterion.id, passed: result.success === true, detail: `success=${result.success}` };
      case 'tasks.completed':
        return {
          id: criterion.id,
          passed: result.completedTasks === result.taskCount,
          detail: `${result.completedTasks}/${result.taskCount} completed`,
        };
      case 'outputs.complete':
        return {
          id: criterion.id,
          passed: result.missingOutputKeys.length === 0,
          detail: result.missingOutputKeys.length ? result.missingOutputKeys.join(', ') : 'none',
        };
      case 'issues.none':
        return {
          id: criterion.id,
          passed: result.validationIssues.length === 0,
          detail: result.validationIssues.length ? result.validationIssues.join('; ') : 'none',
        };
      case 'timeline.present':
        return {
          id: criterion.id,
          passed: result.timeline.length > 0,
          detail: `${result.timeline.length} events`,
        };
      default:
        return { id: criterion.id, passed: false, detail: 'unknown criterion id' };
    }
  });

  return {
    fixture: result.fixture,
    checks,
    passed: checks.every((entry) => entry.passed),
  };
}
