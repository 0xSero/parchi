#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_MAX_LINES = 300;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html']);
const LINE_COUNT_IGNORE_SEGMENTS = ['dist/', 'dist-firefox/', 'node_modules/'];
const LINE_COUNT_IGNORE_PATHS = [/^packages\/backend\/convex\/_generated\//, /^docs\//];

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    base: null,
    maxLines: DEFAULT_MAX_LINES,
  };

  for (const arg of args) {
    if (arg.startsWith('--base=')) {
      options.base = arg.slice('--base='.length).trim() || null;
      continue;
    }
    if (arg.startsWith('--max-lines=')) {
      const parsed = Number(arg.slice('--max-lines='.length));
      if (Number.isFinite(parsed) && parsed > 0) {
        options.maxLines = Math.floor(parsed);
      }
    }
  }

  return options;
};

const run = (command, { allowFailure = false } = {}) => {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1024 * 1024 * 10,
    }).trim();
  } catch (error) {
    if (allowFailure) {
      return '';
    }
    const stderr = error?.stderr ? String(error.stderr) : '';
    throw new Error(`Command failed: ${command}\n${stderr}`);
  }
};

const tryRun = (command) => {
  try {
    run(command);
    return true;
  } catch {
    return false;
  }
};

const resolveBaseRef = (requestedBase) => {
  if (requestedBase) {
    if (!tryRun(`git rev-parse --verify ${requestedBase}`)) {
      throw new Error(`Base ref '${requestedBase}' not found. Fetch it or pass a valid --base=<ref>.`);
    }
    return run(`git merge-base HEAD ${requestedBase}`);
  }

  if (tryRun('git rev-parse --verify origin/master')) {
    return run('git merge-base HEAD origin/master');
  }

  if (tryRun('git rev-parse --verify origin/main')) {
    return run('git merge-base HEAD origin/main');
  }

  if (tryRun('git rev-parse --verify HEAD~1')) {
    return run('git rev-parse HEAD~1');
  }

  return run('git rev-parse HEAD');
};

const parseDiffEntries = (baseRef) => {
  const raw = run(`git diff --name-status --find-renames ${baseRef}`);
  if (!raw) return [];

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const fields = line.split('\t');
      const status = fields[0];
      if (status.startsWith('R')) {
        return {
          status: 'R',
          oldPath: fields[1] || '',
          path: fields[2] || '',
        };
      }
      return {
        status: status[0],
        oldPath: fields[1] || '',
        path: fields[1] || '',
      };
    });
};

const shouldCheckLineCount = (filePath) => {
  if (!filePath) return false;
  const normalized = filePath.replaceAll('\\', '/');
  if (!SOURCE_EXTENSIONS.has(path.extname(normalized))) return false;
  if (LINE_COUNT_IGNORE_SEGMENTS.some((segment) => normalized.includes(segment))) return false;
  if (LINE_COUNT_IGNORE_PATHS.some((pattern) => pattern.test(normalized))) return false;
  return true;
};

const DEEP_SHARED_IMPORT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);
const DEEP_SHARED_IMPORT_PATTERNS = [/from\s+['"][^'"]*shared\/src\//, /import\(\s*['"][^'"]*shared\/src\//];
const DEEP_SHARED_IMPORT_IGNORE_SEGMENTS = ['dist/', 'dist-firefox/', 'node_modules/', 'packages/shared/'];

const findDeepSharedImports = (filePath) => {
  if (!filePath) return [];
  const normalized = filePath.replaceAll('\\', '/');
  if (!DEEP_SHARED_IMPORT_EXTENSIONS.has(path.extname(normalized))) return [];
  if (DEEP_SHARED_IMPORT_IGNORE_SEGMENTS.some((seg) => normalized.includes(seg))) return [];
  if (!fs.existsSync(filePath)) return [];

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const violations = [];
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of DEEP_SHARED_IMPORT_PATTERNS) {
      if (pattern.test(lines[i])) {
        violations.push({ line: i + 1, text: lines[i].trim() });
        break;
      }
    }
  }
  return violations;
};

const countLines = (filePath) => {
  if (!fs.existsSync(filePath)) return 0;
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content) return 0;
  return content.split(/\r?\n/).length;
};

const countLinesAtBase = (baseRef, filePath) => {
  const encodedPath = filePath.replace(/'/g, "'\\''");
  const baseContent = run(`git show '${baseRef}:${encodedPath}'`, { allowFailure: true });
  if (!baseContent) return null;
  return baseContent.split(/\r?\n/).length;
};

const runChecks = () => {
  const options = parseArgs();
  const baseRef = resolveBaseRef(options.base);
  const entries = parseDiffEntries(baseRef);

  const lineViolations = [];
  const sharedImportViolations = [];

  for (const entry of entries) {
    const currentPath = entry.path;
    if (!currentPath) continue;

    // Check for deep shared imports in new or modified files
    if (entry.status === 'A' || entry.status === 'M' || entry.status === 'R') {
      const deepImports = findDeepSharedImports(currentPath);
      for (const v of deepImports) {
        sharedImportViolations.push({ path: currentPath, line: v.line, text: v.text });
      }
    }

    if (!shouldCheckLineCount(currentPath)) continue;
    if (!fs.existsSync(currentPath)) continue;

    const currentLines = countLines(currentPath);
    if (entry.status === 'A') {
      if (currentLines > options.maxLines) {
        lineViolations.push({
          path: currentPath,
          reason: `new file has ${currentLines} lines (limit ${options.maxLines})`,
        });
      }
      continue;
    }

    if (entry.status === 'M' || entry.status === 'R') {
      const previousPath = entry.status === 'R' ? entry.oldPath : currentPath;
      const previousLines = countLinesAtBase(baseRef, previousPath);
      if (previousLines == null) continue;
      if (previousLines <= options.maxLines && currentLines > options.maxLines) {
        lineViolations.push({
          path: currentPath,
          reason: `file crossed limit: ${previousLines} -> ${currentLines} lines (limit ${options.maxLines})`,
        });
      }
    }
  }

  if (lineViolations.length === 0 && sharedImportViolations.length === 0) {
    console.log(
      `repo-standards: pass (base=${baseRef.slice(0, 12)}, maxLines=${options.maxLines}, filesChecked=${entries.length})`,
    );
    return;
  }

  console.error('repo-standards: failed');
  if (lineViolations.length > 0) {
    console.error('\n[Line limit violations]');
    for (const violation of lineViolations) {
      console.error(`- ${violation.path}: ${violation.reason}`);
    }
  }

  if (sharedImportViolations.length > 0) {
    console.error('\n[Deep shared import violations]');
    for (const v of sharedImportViolations) {
      console.error(`- ${v.path}:${v.line}: ${v.text}`);
    }
    console.error('\n  Use `@parchi/shared` instead of deep imports from `packages/shared/src/`.');
  }

  console.error('\nFixes:');
  console.error(`1. Split files so newly added files stay at <= ${options.maxLines} lines.`);
  if (sharedImportViolations.length > 0) {
    console.error('2. Replace deep shared imports with `@parchi/shared` entrypoint imports.');
  }
  process.exit(1);
};

runChecks();
