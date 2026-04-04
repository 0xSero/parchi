#!/usr/bin/env node
/**
 * Auto-increment patch version across package.json and both manifests.
 * Called by the pre-commit git hook.
 *
 * Usage:
 *   node scripts/bump-version.mjs          # bump patch
 *   node scripts/bump-version.mjs --sync   # sync manifests to package.json without bumping
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const FILES = [path.join(root, 'package.json'), path.join(root, 'packages', 'extension', 'manifest.json')];

const syncOnly = process.argv.includes('--sync');

// Read current version from package.json
const pkg = JSON.parse(fs.readFileSync(FILES[0], 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
const newVersion = syncOnly ? pkg.version : `${major}.${minor}.${patch + 1}`;

for (const filePath of FILES) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  if (data.version === newVersion) continue;
  data.version = newVersion;
  // Preserve original formatting (2-space indent, trailing newline)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

console.log(`version: ${pkg.version} → ${newVersion}`);
