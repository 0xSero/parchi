#!/usr/bin/env node

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const quickMode = args.has('--quick');

const now = new Date();
const runId = now.toISOString().replace(/[:.]/g, '-');
const outputRoot = path.join(rootDir, 'test-output', 'production-readiness');
const runDir = path.join(outputRoot, runId);
const logsDir = path.join(runDir, 'logs');

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const readCommand = (command) => {
  try {
    return execSync(command, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 1024 * 1024 * 10,
    }).trim();
  } catch {
    return '';
  }
};

const durationMs = (startMs) => Date.now() - startMs;

const steps = [
  { id: 'lint', command: 'npm run lint', required: true },
  { id: 'typecheck', command: 'npm run typecheck', required: true },
  { id: 'repo-standards', command: 'npm run check:repo-standards', required: true },
  ...(quickMode
    ? []
    : [
        { id: 'unit-tests', command: 'npm run test:unit', required: true },
        { id: 'api-tests', command: 'npm run test:api', required: true },
        { id: 'e2e-tests', command: 'npm run test:e2e', required: true },
      ]),
  { id: 'build-chrome', command: 'npm run build', required: true },
];

const writeLog = (step, output, startedAt, endedAt) => {
  const relativeLogPath = path.join('logs', `${step.id}.log`);
  const absoluteLogPath = path.join(runDir, relativeLogPath);
  const payload = [
    `step: ${step.id}`,
    `command: ${step.command}`,
    `startedAt: ${startedAt}`,
    `endedAt: ${endedAt}`,
    '',
    output,
  ].join('\n');
  fs.writeFileSync(absoluteLogPath, payload);
  return relativeLogPath;
};

const runStep = (step) => {
  const startedAt = new Date();
  const startedAtIso = startedAt.toISOString();
  const startedAtMs = Date.now();

  const result = spawnSync(step.command, {
    cwd: rootDir,
    shell: true,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 50,
  });

  const endedAtIso = new Date().toISOString();
  const elapsed = durationMs(startedAtMs);
  const status = result.status === 0 ? 'passed' : 'failed';
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  const logFile = writeLog(step, output, startedAtIso, endedAtIso);

  const icon = status === 'passed' ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${step.id} (${elapsed}ms)`);

  return {
    ...step,
    status,
    exitCode: result.status ?? 1,
    startedAt: startedAtIso,
    endedAt: endedAtIso,
    durationMs: elapsed,
    logFile,
    outputSnippet: output.slice(0, 1200),
  };
};

const renderMarkdown = (summary) => {
  const lines = [
    '# Production Readiness Audit',
    '',
    `- Generated: ${summary.generatedAt}`,
    `- Run ID: ${summary.runId}`,
    `- Branch: ${summary.git.branch || 'unknown'}`,
    `- Commit: ${summary.git.commit || 'unknown'}`,
    `- Dirty: ${summary.git.dirty ? 'yes' : 'no'}`,
    `- Quick Mode: ${summary.options.quickMode ? 'yes' : 'no'}`,
    `- Required Gates Passed: ${summary.requiredPass ? 'yes' : 'no'}`,
    '',
    '| Step | Status | Required | Duration (ms) | Log |',
    '|---|---|---|---:|---|',
  ];

  summary.steps.forEach((step) => {
    const required = step.required ? 'yes' : 'no';
    lines.push(`| ${step.id} | ${step.status} | ${required} | ${step.durationMs} | ${step.logFile} |`);
  });

  lines.push('', '## Failed Steps', '');

  const failed = summary.steps.filter((step) => step.status !== 'passed');
  if (failed.length === 0) {
    lines.push('None.');
  } else {
    failed.forEach((step) => {
      lines.push(`### ${step.id}`);
      lines.push('```text');
      lines.push(step.outputSnippet || '(no output)');
      lines.push('```');
      lines.push('');
    });
  }

  return `${lines.join('\n')}\n`;
};

const run = () => {
  ensureDir(logsDir);

  const stepResults = steps.map((step) => runStep(step));
  const requiredFailures = stepResults.filter((step) => step.required && step.status !== 'passed');

  const summary = {
    runId,
    generatedAt: now.toISOString(),
    options: {
      quickMode,
    },
    git: {
      branch: readCommand('git rev-parse --abbrev-ref HEAD'),
      commit: readCommand('git rev-parse HEAD'),
      dirty: Boolean(readCommand('git status --porcelain=v1')),
    },
    environment: {
      node: process.version,
      npm: readCommand('npm --version'),
    },
    steps: stepResults,
    requiredPass: requiredFailures.length === 0,
  };

  const jsonPath = path.join(runDir, 'readiness.json');
  const mdPath = path.join(runDir, 'readiness.md');
  const latestJsonPath = path.join(outputRoot, 'latest.json');
  const latestMdPath = path.join(outputRoot, 'latest.md');

  fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(mdPath, renderMarkdown(summary));
  fs.copyFileSync(jsonPath, latestJsonPath);
  fs.copyFileSync(mdPath, latestMdPath);

  console.log(`report: ${path.relative(rootDir, mdPath)}`);
  console.log(`report: ${path.relative(rootDir, jsonPath)}`);
  console.log(`latest: ${path.relative(rootDir, latestMdPath)}`);
  console.log(`latest: ${path.relative(rootDir, latestJsonPath)}`);

  if (!summary.requiredPass) {
    console.error(`production-readiness: failed (${requiredFailures.length} required gate(s) red)`);
    process.exit(1);
  }

  console.log('production-readiness: pass');
};

run();
