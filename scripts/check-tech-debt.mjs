#!/usr/bin/env node
// Tech debt scanner: enforces that TODO/FIXME/HACK comments link to an issue.
// Convention: TODO(owner/repo#123) or FIXME(#456) or HACK(#789)
// Bare TODOs without an issue reference are flagged.
//
// Usage:
//   node scripts/check-tech-debt.mjs          # scan all source files
//   node scripts/check-tech-debt.mjs --base=abc123  # scan only changed files

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html']);
const IGNORE_SEGMENTS = [
  'dist/', 'dist-firefox/', 'dist-relay/', 'dist-cli/', 'dist-electron-agent/',
  'node_modules/', 'test-output/',
];
const IGNORE_PATTERNS = [
  /^packages\/backend\/convex\/_generated\//,
  /^docs\//,
];

// Pattern: TODO or FIXME or HACK followed optionally by (owner/repo#123) or (#123)
// We flag lines that have the keyword but NO parenthesised issue reference.
const TECH_DEBT_RE = /\b(TODO|FIXME|HACK)\b/;
const TICKET_RE = /\b(TODO|FIXME|HACK)\s*\([^)]*#\d+\)/;

let violations = 0;
let warnings = 0;
let total = 0;

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = { base: null };
  for (const arg of args) {
    if (arg.startsWith('--base=')) {
      options.base = arg.slice('--base='.length);
    }
  }
  return options;
};

const isIgnored = (filePath) => {
  if (IGNORE_SEGMENTS.some((seg) => filePath.includes(seg))) return true;
  return IGNORE_PATTERNS.some((re) => re.test(filePath));
};

const getSourceFiles = (base) => {
  if (base) {
    try {
      const diff = execSync(`git diff --name-only --diff-filter=ACMR ${base} -- .`, {
        encoding: 'utf8',
        cwd: path.resolve(import.meta.dirname, '..'),
      });
      return diff
        .split('\n')
        .filter(Boolean)
        .filter((f) => SOURCE_EXTENSIONS.has(path.extname(f)))
        .filter((f) => !isIgnored(f));
    } catch {
      return [];
    }
  }
  // Full scan
  const allFiles = execSync('git ls-files -- .', { encoding: 'utf8' });
  return allFiles
    .split('\n')
    .filter(Boolean)
    .filter((f) => SOURCE_EXTENSIONS.has(path.extname(f)))
    .filter((f) => !isIgnored(f));
};

const scanFile = (filePath) => {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return;

  const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!TECH_DEBT_RE.test(line)) continue;
    total++;

    if (TICKET_RE.test(line)) {
      // Has a ticket reference — OK
      continue;
    }

    // Flag: tech debt marker without issue reference
    const trimmed = line.trim();
    console.error(`  ${filePath}:${i + 1}: ${trimmed}`);
    violations++;
  }
};

const main = () => {
  const options = parseArgs();
  const files = getSourceFiles(options.base);

  if (files.length === 0) {
    console.log('No source files to scan.');
    process.exit(0);
  }

  console.log(`Scanning ${files.length} file(s) for tech debt markers...\n`);

  for (const file of files) {
    scanFile(file);
  }

  console.log('');
  if (total > 0) {
    console.log(`Found ${total} tech debt marker(s), ${violations} without issue reference.`);
  } else {
    console.log('No tech debt markers found.');
  }

  if (violations > 0) {
    console.error(`\n${violations} tech debt marker(s) missing issue reference.`);
    console.error('Use TODO(owner/repo#123) or FIXME(#456) or HACK(#789) format.');
    console.error('Example: TODO(0xSero/parchi#42) — add retry logic');
    process.exit(1);
  }

  process.exit(0);
};

main();
