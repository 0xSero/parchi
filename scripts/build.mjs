import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const browserArg = args.find((arg) => arg.startsWith('--browser='));
const targetBrowser = (
  (browserArg ? browserArg.split('=')[1] : process.env.BROWSER || process.env.TARGET || 'chrome') || 'chrome'
).toLowerCase();
const isFirefox = targetBrowser === 'firefox';
const isSafari = targetBrowser === 'safari';
const manifestName = isFirefox
  ? 'manifest.firefox.json'
  : isSafari
    ? 'manifest.safari.json'
    : 'manifest.json';
const distName = isFirefox ? 'dist-firefox' : isSafari ? 'dist-safari' : 'dist';
const distDir = path.join(rootDir, distName);
const relayDistDir = path.join(rootDir, 'dist-relay');
const extensionRoot = path.join(rootDir, 'packages', 'extension');
const parseEnvText = (text) => {
  const parsed = {};
  for (const rawLine of String(text || '').split(/\r?\n/g)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
};

const loadBuildEnv = () => {
  const envPaths = [
    path.join(rootDir, '.env.local'),
    path.join(rootDir, '.env'),
    path.join(rootDir, 'packages', 'backend', '.env.local'),
    path.join(rootDir, 'packages', 'backend', '.env'),
  ];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const parsed = parseEnvText(fs.readFileSync(envPath, 'utf8'));
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key] || process.env[key]?.trim() === '') {
        process.env[key] = String(value);
      }
    }
  }
};

loadBuildEnv();

const convexUrl = String(process.env.CONVEX_URL || '').trim();
const buildDefines = {
  __CONVEX_URL__: JSON.stringify(convexUrl),
};

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const cleanDir = (dir) => {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
};

const copyFile = (src, dest) => {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
};

const copyDirFiltered = (src, dest, filter) => {
  if (!fs.existsSync(src)) return;
  const entries = fs.readdirSync(src, { withFileTypes: true });
  entries.forEach((entry) => {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirFiltered(srcPath, destPath, filter);
      return;
    }
    if (filter && !filter(srcPath)) {
      return;
    }
    copyFile(srcPath, destPath);
  });
};

const run = async () => {
  cleanDir(distDir);
  cleanDir(relayDistDir);

  execSync('tsc -p tsconfig.json --noEmit', { stdio: 'inherit' });

  // Build background and sidepanel as ESM (they support modules)
  const esmEntryPoints = [
    path.join(extensionRoot, 'background.ts'),
    path.join(extensionRoot, 'sidepanel', 'panel.ts'),
  ];
  if (!isSafari) {
    esmEntryPoints.push(path.join(extensionRoot, 'offscreen', 'offscreen.ts'));
  }
  await esbuild.build({
    entryPoints: esmEntryPoints,
    outdir: distDir,
    outbase: extensionRoot,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    sourcemap: true,
    logLevel: 'info',
    define: buildDefines,
  });

  // Build content script as IIFE (content scripts don't support ESM)
  await esbuild.build({
    entryPoints: [path.join(extensionRoot, 'content.ts')],
    outdir: distDir,
    outbase: extensionRoot,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    sourcemap: true,
    logLevel: 'info',
    define: buildDefines,
  });

  await esbuild.build({
    entryPoints: [
      path.join(rootDir, 'tests', 'run-tests.ts'),
      path.join(rootDir, 'tests', 'validate-extension.ts'),
      path.join(rootDir, 'tests', 'unit', 'run-unit-tests.ts'),
      path.join(rootDir, 'tests', 'e2e', 'run-e2e.ts'),
      path.join(rootDir, 'tests', 'e2e', 'test-browser-tools.ts'),
      path.join(rootDir, 'tests', 'api', 'run-api-tests.ts'),
      path.join(rootDir, 'tests', 'relay', 'run-relay-tests.ts'),
    ],
    outdir: distDir,
    outbase: rootDir,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    sourcemap: true,
    logLevel: 'info',
    define: buildDefines,
    packages: 'external',
    external: ['chromium-bidi/lib/cjs/bidiMapper/BidiMapper', 'chromium-bidi/lib/cjs/cdp/CdpConnection'],
  });

  // Build relay daemon + CLI (Node-only; separate dist folder so it isn't shipped with the extension bundle)
  await esbuild.build({
    entryPoints: {
      'relay-daemon': path.join(rootDir, 'packages', 'relay-service', 'src', 'relay-daemon.ts'),
      relay: path.join(rootDir, 'packages', 'relay-service', 'src', 'cli.ts'),
    },
    outdir: relayDistDir,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    sourcemap: true,
    logLevel: 'info',
    define: buildDefines,
    packages: 'external',
    banner: {
      js: '#!/usr/bin/env node',
    },
  });

  const manifestPath = path.join(extensionRoot, manifestName);
  const fallbackManifestPath = path.join(extensionRoot, 'manifest.json');
  const manifestSourcePath = fs.existsSync(manifestPath) ? manifestPath : fallbackManifestPath;
  const manifestDest = path.join(distDir, 'manifest.json');
  const manifestData = JSON.parse(fs.readFileSync(manifestSourcePath, 'utf8'));
  ensureDir(path.dirname(manifestDest));
  fs.writeFileSync(manifestDest, JSON.stringify(manifestData, null, 2));
  copyFile(path.join(extensionRoot, 'sidepanel', 'panel.html'), path.join(distDir, 'sidepanel', 'panel.html'));
  copyFile(path.join(extensionRoot, 'sidepanel', 'panel.css'), path.join(distDir, 'sidepanel', 'panel.css'));
  copyDirFiltered(path.join(extensionRoot, 'sidepanel', 'styles'), path.join(distDir, 'sidepanel', 'styles'));
  copyDirFiltered(path.join(extensionRoot, 'sidepanel', 'templates'), path.join(distDir, 'sidepanel', 'templates'));
  if (!isSafari) {
    copyFile(path.join(extensionRoot, 'offscreen', 'offscreen.html'), path.join(distDir, 'offscreen', 'offscreen.html'));
  }
  copyDirFiltered(path.join(extensionRoot, 'icons'), path.join(distDir, 'icons'));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
