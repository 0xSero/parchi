#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { executeOrchestratorFixture } from './fixture-executor.js';

type FixtureResult = ReturnType<typeof executeOrchestratorFixture>;

const colors = {
  info: '\x1b[36m',
  success: '\x1b[32m',
  error: '\x1b[31m',
  warning: '\x1b[33m',
  reset: '\x1b[0m',
} as const;

function log(message: string, type: keyof typeof colors = 'info') {
  console.log(`${colors[type]}${message}${colors.reset}`);
}

const repoRoot = path.resolve(process.cwd());
const fixtureDir = path.join(repoRoot, 'tests', 'fixtures', 'orchestrator');
const outputDir = path.join(repoRoot, 'test-output');
const outputJsonPath = path.join(outputDir, 'orchestrator-fixture-execution.json');
const outputMdPath = path.join(outputDir, 'orchestrator-fixture-execution.md');

const loadFixtureFiles = () =>
  fs
    .readdirSync(fixtureDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort();

const writeMarkdownSummary = (results: FixtureResult[]) => {
  const total = results.length;
  const passed = results.filter((result) => result.success).length;
  const failed = total - passed;
  const lines: string[] = [
    '# Orchestrator Fixture Execution',
    '',
    `- Generated: ${new Date().toISOString()}`,
    `- Total fixtures: ${total}`,
    `- Passed: ${passed}`,
    `- Failed: ${failed}`,
    '',
    '## Results',
    '',
  ];

  for (const result of results) {
    lines.push(`### ${result.fixture}`);
    lines.push(`- Goal: ${result.goal}`);
    lines.push(`- Success: ${result.success ? 'yes' : 'no'}`);
    lines.push(`- Tasks: ${result.completedTasks}/${result.taskCount} completed`);
    lines.push(`- Missing outputs: ${result.missingOutputKeys.length ? result.missingOutputKeys.join(', ') : 'none'}`);
    lines.push(`- Validation issues: ${result.validationIssues.length ? result.validationIssues.join('; ') : 'none'}`);
    lines.push('');
  }

  fs.writeFileSync(outputMdPath, `${lines.join('\n')}\n`);
};

function main() {
  log('╔══════════════════════════════════════════════════╗', 'info');
  log('║      Orchestrator Fixture Executor Runner       ║', 'info');
  log('╚══════════════════════════════════════════════════╝', 'info');

  if (!fs.existsSync(fixtureDir)) {
    log(`Fixture directory not found: ${fixtureDir}`, 'error');
    process.exit(1);
  }

  const fixtureFiles = loadFixtureFiles();
  if (fixtureFiles.length === 0) {
    log('No fixture files found under tests/fixtures/orchestrator.', 'warning');
    process.exit(0);
  }

  const results = fixtureFiles.map((fileName) => {
    const filePath = path.join(fixtureDir, fileName);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const result = executeOrchestratorFixture(fileName, parsed);
    log(`${result.success ? '✓' : '✗'} ${fileName} -> ${result.success ? 'pass' : 'fail'}`, result.success ? 'success' : 'error');
    return result;
  });

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    outputJsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        fixtureCount: results.length,
        passedCount: results.filter((result) => result.success).length,
        failedCount: results.filter((result) => !result.success).length,
        results,
      },
      null,
      2,
    ),
  );
  writeMarkdownSummary(results);

  const failed = results.filter((result) => !result.success);
  log(`\nArtifacts:`, 'info');
  log(`- ${path.relative(repoRoot, outputJsonPath)}`, 'info');
  log(`- ${path.relative(repoRoot, outputMdPath)}`, 'info');

  if (failed.length > 0) {
    log(`\n${failed.length} fixture(s) failed.`, 'error');
    process.exit(1);
  }

  log('\nAll orchestrator fixtures passed.', 'success');
  process.exit(0);
}

main();
