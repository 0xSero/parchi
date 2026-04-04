#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const isDryRun = process.argv.includes('--dry-run');

const CLEAN_DIRS = ['dist', 'tmp', 'test-output'];
const CLEAN_FILE_PATTERNS = [/^parchi-.*\.(zip|xpi)$/i, /^dist\.crx$/i];

const removePath = (relativePath) => {
  const absolutePath = path.join(rootDir, relativePath);
  const exists = fs.existsSync(absolutePath);
  if (!exists) return false;

  if (isDryRun) {
    console.log(`[dry-run] remove ${relativePath}`);
    return true;
  }

  fs.rmSync(absolutePath, { recursive: true, force: true });
  console.log(`removed ${relativePath}`);
  return true;
};

const run = () => {
  let removedCount = 0;

  CLEAN_DIRS.forEach((dir) => {
    if (removePath(dir)) removedCount++;
  });

  const rootEntries = fs.readdirSync(rootDir, { withFileTypes: true });
  rootEntries.forEach((entry) => {
    if (!entry.isFile()) return;
    if (!CLEAN_FILE_PATTERNS.some((pattern) => pattern.test(entry.name))) return;
    if (removePath(entry.name)) removedCount++;
  });

  if (removedCount === 0) {
    console.log(isDryRun ? '[dry-run] no cleanup targets found' : 'no cleanup targets found');
    return;
  }

  console.log(`${isDryRun ? '[dry-run] ' : ''}cleanup complete (${removedCount} targets)`);
};

run();
