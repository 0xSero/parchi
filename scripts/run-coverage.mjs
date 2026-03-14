import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const coverageDistDir = path.join(rootDir, '.coverage-dist');
const coverageWorkDir = path.join(rootDir, 'coverage');
const outputDir = path.join(rootDir, 'test-output', 'coverage');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

const broadTargetSourceFiles = [
  'packages/shared/src/plan.ts',
  'packages/shared/src/runtime-messages.ts',
  'packages/extension/ai/messages/utils.ts',
  'packages/extension/ai/models/retry-engine.ts',
  'packages/extension/ai/messages/schema.ts',
  'packages/extension/ai/models/convert.ts',
  'packages/extension/ai/providers/model-listing.ts',
  'packages/extension/oauth/model-normalization.ts',
  'packages/extension/oauth/model-candidates.ts',
  'packages/extension/background/tool-permissions.ts',
  'packages/extension/background/report-images.ts',
  'packages/extension/background/xml-tool-parser.ts',
  'packages/extension/background/tools/tool-catalog.ts',
  'packages/extension/background/system-prompt.ts',
  'packages/extension/recording/recording-summary.ts',
  'packages/extension/tools/browser-tool-definitions.ts',
];

const strictTargetSourceFiles = [
  'packages/shared/src/plan.ts',
  'packages/shared/src/runtime-messages.ts',
  'packages/extension/ai/providers/model-listing.ts',
  'packages/extension/oauth/model-normalization.ts',
  'packages/extension/oauth/model-candidates.ts',
  'packages/extension/background/tool-permissions.ts',
  'packages/extension/background/report-images.ts',
  'packages/extension/background/xml-tool-parser.ts',
  'packages/extension/background/tools/tool-catalog.ts',
  'packages/extension/recording/recording-summary.ts',
  'packages/extension/tools/browser-tool-definitions.ts',
];

const nodeBin = process.execPath;
const tscBin = path.join(rootDir, 'node_modules', '.bin', 'tsc');
const c8Bin = path.join(rootDir, 'node_modules', '.bin', 'c8');

const compiledTargets = broadTargetSourceFiles.map((file) => path.join('.coverage-dist', file.replace(/\.ts$/, '.js')));

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    ...options,
  });
}

function ensureCleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function writeSharedShim() {
  const packageDir = path.join(coverageDistDir, 'node_modules', '@parchi', 'shared');
  fs.mkdirSync(packageDir, { recursive: true });
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    JSON.stringify(
      {
        name: '@parchi/shared',
        type: 'module',
        main: './src/index.js',
        exports: {
          '.': './src/index.js',
        },
      },
      null,
      2,
    ),
  );
  const target = path.join(packageDir, 'src');
  fs.rmSync(target, { recursive: true, force: true });
  fs.symlinkSync(path.join('..', '..', '..', 'packages', 'shared', 'src'), target, 'dir');
}

function readCoverageSummary() {
  const summaryPath = path.join(coverageWorkDir, 'coverage-summary.json');
  return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
}

function mapSummary(summary, sourceFiles) {
  return sourceFiles.map((sourcePath) => {
    const compiledPath = path.resolve(rootDir, '.coverage-dist', sourcePath.replace(/\.ts$/, '.js'));
    const stats = summary[compiledPath];
    return {
      sourcePath,
      compiledPath,
      stats,
    };
  });
}

function buildArtifacts(rows, total, strictRows, strictTotal) {
  fs.mkdirSync(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, `coverage-${timestamp}.json`);
  const mdPath = path.join(outputDir, `coverage-${timestamp}.md`);
  const payload = {
    generatedAt: new Date().toISOString(),
    total,
    strictTotal,
    targets: rows.map(({ sourcePath, stats }) => ({ sourcePath, stats })),
    strictTargets: strictRows.map(({ sourcePath, stats }) => ({ sourcePath, stats })),
  };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

  const tableRows = rows
    .map(({ sourcePath, stats }) => {
      const lines = stats?.lines?.pct ?? 0;
      const branches = stats?.branches?.pct ?? 0;
      const functions = stats?.functions?.pct ?? 0;
      const statements = stats?.statements?.pct ?? 0;
      return `| ${sourcePath} | ${lines}% | ${branches}% | ${functions}% | ${statements}% |`;
    })
    .join('\n');
  const markdown = [
    '# Coverage report',
    '',
    `- Generated: ${new Date().toISOString()}`,
    `- Target files: ${rows.length}`,
    `- Strict 100 files: ${strictRows.length}`,
    '',
    '| File | Lines | Branches | Functions | Statements |',
    '| --- | ---: | ---: | ---: | ---: |',
    tableRows,
    '',
    `**Target total**: lines ${total.lines.pct}%, branches ${total.branches.pct}%, functions ${total.functions.pct}%, statements ${total.statements.pct}%`,
    `**Strict total**: lines ${strictTotal.lines.pct}%, branches ${strictTotal.branches.pct}%, functions ${strictTotal.functions.pct}%, statements ${strictTotal.statements.pct}%`,
    '',
    'Strict files must stay at 100% for lines, functions, and statements. Branch coverage is tracked separately in the broad totals.',
  ].join('\n');
  fs.writeFileSync(mdPath, markdown);

  fs.copyFileSync(
    path.join(coverageWorkDir, 'coverage-summary.json'),
    path.join(outputDir, 'coverage-summary.latest.json'),
  );
  fs.copyFileSync(jsonPath, path.join(outputDir, 'coverage.latest.json'));
  fs.copyFileSync(mdPath, path.join(outputDir, 'coverage.latest.md'));

  return { jsonPath, mdPath };
}

function validateCoverage(strictRows, broadTotal) {
  const failures = strictRows.filter(({ stats }) => {
    if (!stats) return true;
    return !['lines', 'functions', 'statements'].every((key) => Number(stats[key]?.pct || 0) === 100);
  });

  if (failures.length > 0) {
    console.error(
      '\nCoverage target failure: expected 100% line/function/statement coverage on all strict helper files.',
    );
    for (const failure of failures) {
      const stats = failure.stats || {};
      console.error(
        `- ${failure.sourcePath}: lines ${stats.lines?.pct ?? 0}% | branches ${stats.branches?.pct ?? 0}% | functions ${stats.functions?.pct ?? 0}% | statements ${stats.statements?.pct ?? 0}%`,
      );
    }
    process.exit(1);
  }

  const broadThresholds = {
    lines: 95,
    branches: 75,
    functions: 95,
    statements: 95,
  };
  for (const [key, threshold] of Object.entries(broadThresholds)) {
    if (Number(broadTotal[key]?.pct || 0) < threshold) {
      console.error(
        `\nCoverage target failure: broad headless surface ${key} coverage ${broadTotal[key].pct}% is below ${threshold}%.`,
      );
      process.exit(1);
    }
  }
}

ensureCleanDir(coverageDistDir);
ensureCleanDir(coverageWorkDir);
fs.mkdirSync(outputDir, { recursive: true });

run(tscBin, ['-p', 'tsconfig.json', '--outDir', '.coverage-dist']);
writeSharedShim();
run(c8Bin, [
  '--lines=0',
  '--branches=0',
  '--functions=0',
  '--statements=0',
  '--reporter=json-summary',
  '--reporter=text-summary',
  '--report-dir',
  'coverage',
  '--temp-directory',
  'coverage/tmp',
  '--all',
  ...compiledTargets.flatMap((target) => ['--include', target]),
  nodeBin,
  path.join('.coverage-dist', 'tests', 'run-headless-tests.js'),
]);

const summary = readCoverageSummary();
const rows = mapSummary(summary, broadTargetSourceFiles);
const strictRows = mapSummary(summary, strictTargetSourceFiles);
const total = rows.reduce(
  (acc, row) => {
    const stats = row.stats;
    if (!stats) return acc;
    for (const key of ['lines', 'branches', 'functions', 'statements']) {
      acc[key].covered += Number(stats[key].covered || 0);
      acc[key].total += Number(stats[key].total || 0);
      acc[key].pct = acc[key].total > 0 ? Number(((acc[key].covered / acc[key].total) * 100).toFixed(2)) : 100;
    }
    return acc;
  },
  {
    lines: { covered: 0, total: 0, pct: 100 },
    branches: { covered: 0, total: 0, pct: 100 },
    functions: { covered: 0, total: 0, pct: 100 },
    statements: { covered: 0, total: 0, pct: 100 },
  },
);
const strictTotal = strictRows.reduce(
  (acc, row) => {
    const stats = row.stats;
    if (!stats) return acc;
    for (const key of ['lines', 'branches', 'functions', 'statements']) {
      acc[key].covered += Number(stats[key].covered || 0);
      acc[key].total += Number(stats[key].total || 0);
      acc[key].pct = acc[key].total > 0 ? Number(((acc[key].covered / acc[key].total) * 100).toFixed(2)) : 100;
    }
    return acc;
  },
  {
    lines: { covered: 0, total: 0, pct: 100 },
    branches: { covered: 0, total: 0, pct: 100 },
    functions: { covered: 0, total: 0, pct: 100 },
    statements: { covered: 0, total: 0, pct: 100 },
  },
);
const artifacts = buildArtifacts(rows, total, strictRows, strictTotal);
console.log(`\nCoverage artifacts written to:\n- ${artifacts.jsonPath}\n- ${artifacts.mdPath}`);
validateCoverage(strictRows, total);
