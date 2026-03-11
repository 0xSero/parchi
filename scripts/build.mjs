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
const manifestName = isFirefox ? 'manifest.firefox.json' : 'manifest.json';
const distName = isFirefox ? 'dist-firefox' : 'dist';
const distDir = path.join(rootDir, distName);
const relayDistDir = path.join(rootDir, 'dist-relay');
const cliDistDir = path.join(rootDir, 'dist-cli');
const electronAgentDistDir = path.join(rootDir, 'dist-electron-agent');
const extensionRoot = path.join(rootDir, 'packages', 'extension');
// Alias workspace packages so esbuild inlines them instead of treating as external
const workspaceAlias = {
  '@parchi/shared': path.join(rootDir, 'packages', 'shared', 'src', 'index.ts'),
};
const parseEnvText = (text) => {
  const parsed = {};
  for (const rawLine of String(text || '').split(/\r?\n/g)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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
const perfDebug = (process.env.PERF_DEBUG || '').toLowerCase() === 'true';
const buildDefines = {
  __CONVEX_URL__: JSON.stringify(convexUrl),
  __PERF_DEBUG__: JSON.stringify(perfDebug),
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
  cleanDir(cliDistDir);
  cleanDir(electronAgentDistDir);

  try {
    execSync('tsc -p tsconfig.json --noEmit', { stdio: 'inherit', cwd: rootDir });
  } catch {
    console.warn('⚠ tsc found errors (non-blocking, continuing build)');
  }

  // Build background and sidepanel as ESM (they support modules)
  await esbuild.build({
    entryPoints: [
      path.join(extensionRoot, 'background.ts'),
      path.join(extensionRoot, 'sidepanel', 'panel.ts'),
      path.join(extensionRoot, 'offscreen', 'offscreen.ts'),
    ],
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

  // Build content scripts as IIFE (content scripts don't support ESM)
  await esbuild.build({
    entryPoints: [path.join(extensionRoot, 'content.ts'), path.join(extensionRoot, 'content-recording.ts')],
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
      path.join(rootDir, 'tests', 'integration', 'run-integration-tests.ts'),
      path.join(rootDir, 'tests', 'e2e', 'run-e2e.ts'),
      path.join(rootDir, 'tests', 'e2e', 'run-orchestrator-runtime-e2e.ts'),
      path.join(rootDir, 'tests', 'e2e', 'test-browser-tools.ts'),
      path.join(rootDir, 'tests', 'orchestrator', 'run-fixture-executor.ts'),
      path.join(rootDir, 'tests', 'api', 'run-api-tests.ts'),
      path.join(rootDir, 'tests', 'relay', 'run-relay-tests.ts'),
      path.join(rootDir, 'tests', 'relay', 'run-electron-agent-tests.ts'),
      path.join(rootDir, 'tests', 'relay', 'run-relay-benchmark.ts'),
      path.join(rootDir, 'tests', 'perf', 'run-perf-profile.ts'),
      path.join(rootDir, 'tests', 'perf', 'run-tab-cpu-audit.ts'),
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
    alias: workspaceAlias,
    packages: 'external',
    external: ['chromium-bidi/lib/cjs/bidiMapper/BidiMapper', 'chromium-bidi/lib/cjs/cdp/CdpConnection'],
  });

  // Build parchi CLI (single file, Node.js)
  // This now includes both the daemon and relay functionality (merged from relay-service)
  await esbuild.build({
    entryPoints: {
      parchi: path.join(rootDir, 'packages', 'cli', 'src', 'main.ts'),
    },
    outdir: cliDistDir,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    sourcemap: true,
    logLevel: 'info',
    define: buildDefines,
    alias: workspaceAlias,
    packages: 'external',
    banner: {
      js: '#!/usr/bin/env node',
    },
  });

  // Build Electron relay agent (Node.js)
  await esbuild.build({
    entryPoints: {
      'electron-agent': path.join(rootDir, 'packages', 'electron-agent', 'src', 'main.ts'),
    },
    outdir: electronAgentDistDir,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'es2022',
    sourcemap: true,
    logLevel: 'info',
    define: buildDefines,
    alias: workspaceAlias,
    packages: 'external',
    banner: {
      js: '#!/usr/bin/env node',
    },
  });

  // Create backward-compatible relay wrappers in dist-relay
  // These delegate to the unified CLI binary
  cleanDir(relayDistDir);
  const cliPath = path.join(cliDistDir, 'parchi.js');

  // relay-daemon.js wrapper - delegates to parchi daemon
  fs.writeFileSync(
    path.join(relayDistDir, 'relay-daemon.js'),
    `#!/usr/bin/env node
// Backward-compatible wrapper - relay-service merged into CLI
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cliPath = path.join(__dirname, '..', 'dist-cli', 'parchi.js');
// Pass through original arguments directly to daemon
const child = spawn(process.execPath, [cliPath, 'daemon', ...process.argv.slice(2)], {
  stdio: 'inherit',
});
child.on('exit', (code) => process.exit(code ?? 0));
`,
  );

  // relay.js wrapper - delegates to parchi relay
  fs.writeFileSync(
    path.join(relayDistDir, 'relay.js'),
    `#!/usr/bin/env node
// Backward-compatible wrapper - relay-service merged into CLI
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cliPath = path.join(__dirname, '..', 'dist-cli', 'parchi.js');
const args = ['relay', ...process.argv.slice(2)];
const child = spawn(process.execPath, [cliPath, ...args], {
  stdio: 'inherit',
});
child.on('exit', (code) => process.exit(code ?? 0));
`,
  );

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
  copyFile(path.join(extensionRoot, 'offscreen', 'offscreen.html'), path.join(distDir, 'offscreen', 'offscreen.html'));
  copyDirFiltered(path.join(extensionRoot, 'icons'), path.join(distDir, 'icons'));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
