import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tmpDir = '/tmp/parchi-screenshots';
const outHtml = path.join(root, 'commit-ui-review.html');

const worktreeDir = '/tmp/parchi-worktree';

// Cleanup from previous runs
execSync(`rm -rf ${tmpDir} ${worktreeDir}`);

// The 25 commits from HEAD
const commitsRaw = execSync(`git log --oneline -25 --format="%H|%s"`, { cwd: root }).toString().trim().split('\n');
const commits = commitsRaw.map((line) => {
  const [hash, msg] = line.split('|');
  return { hash: hash.trim(), msg: msg.trim() };
});

// Filter to only commits that touched sidepanel styles/templates/html
const uiCommits = [];
for (const c of commits) {
  const files = execSync(`git diff-tree --no-commit-id --name-only -r ${c.hash}`, { cwd: root }).toString().trim();
  if (!files) continue;
  const touchesUI = files
    .split('\n')
    .some(
      (f) =>
        f.includes('sidepanel/styles/') ||
        f.includes('sidepanel/templates/') ||
        f.includes('sidepanel/panel.css') ||
        f.includes('sidepanel/panel.html'),
    );
  if (touchesUI) uiCommits.push(c);
}

// Always include first and last for context
if (!uiCommits.find((c) => c.hash === commits[0].hash)) uiCommits.unshift(commits[0]);
if (!uiCommits.find((c) => c.hash === commits[commits.length - 1].hash)) uiCommits.push(commits[commits.length - 1]);

// Deduplicate, keep order
const seen = new Set();
const unique = [];
for (const c of uiCommits) {
  if (!seen.has(c.hash)) {
    seen.add(c.hash);
    unique.push(c);
  }
}

console.log(`\nBuilding ${unique.length} commits with UI changes...\n`);

fs.mkdirSync(tmpDir, { recursive: true });

// Create a single worktree — we'll just checkout different commits in it
console.log('Creating worktree...');
try {
  execSync(`git worktree add --detach ${worktreeDir} ${unique[0].hash}`, { cwd: root, stdio: 'pipe' });
} catch {
  // If worktree fails, fall back to cloning
  console.log('Worktree failed, using clone...');
  execSync(`git clone --no-checkout . ${worktreeDir}`, { cwd: root, stdio: 'pipe' });
}

// Install deps in worktree (needed for esbuild)
console.log('Installing deps in worktree...');
execSync('npm install --ignore-scripts', { cwd: worktreeDir, stdio: 'pipe' });

let idx = 0;
for (const c of unique) {
  idx++;
  const label = `${idx}/${unique.length}`;
  const short = c.hash.slice(0, 7);
  console.log(`[${label}] ${short} ${c.msg.slice(0, 60)}...`);

  try {
    execSync(`git checkout ${c.hash} -q`, { cwd: worktreeDir, stdio: 'pipe' });

    // Build
    execSync('node scripts/build.mjs', { cwd: worktreeDir, stdio: 'pipe' });

    // Copy the built sidepanel to persistent tmp
    const commitDir = path.join(tmpDir, short);
    fs.mkdirSync(commitDir, { recursive: true });
    execSync(`cp -r ${worktreeDir}/dist/sidepanel/. ${commitDir}/`);
    execSync(`cp -r ${worktreeDir}/dist/icons ${commitDir}/icons 2>/dev/null || true`);

    // Save commit info
    const date = execSync(`git log -1 --format="%ci" ${c.hash}`, { cwd: root }).toString().trim();
    fs.writeFileSync(path.join(commitDir, 'commit-info.json'), JSON.stringify({ hash: c.hash, msg: c.msg, date }));

    console.log(`  [${label}] Built OK`);
  } catch (e) {
    console.log(`  [${label}] FAILED: ${e.message?.slice(0, 120)}`);
  }
}

// Clean up worktree
console.log('\nCleaning up worktree...');
try {
  execSync(`git worktree remove ${worktreeDir} --force`, { cwd: root, stdio: 'pipe' });
} catch {}

// Now screenshot each with Playwright
console.log('\nTaking screenshots...\n');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 700 }, deviceScaleFactor: 2 });

const screenshots = [];

for (const c of unique) {
  const short = c.hash.slice(0, 7);
  const commitDir = path.join(tmpDir, short);
  const infoPath = path.join(commitDir, 'commit-info.json');
  if (!fs.existsSync(infoPath)) {
    console.log(`  Skip ${short} (no build)`);
    continue;
  }

  const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
  const htmlPath = path.join(commitDir, 'panel.html');
  if (!fs.existsSync(htmlPath)) {
    console.log(`  Skip ${short} (no panel.html)`);
    continue;
  }

  const page = await ctx.newPage();
  try {
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(800);
    const screenshotPath = path.join(commitDir, 'screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    screenshots.push({ ...info, screenshotPath, shortHash: short });
    console.log(`  Captured ${short} ${info.msg.slice(0, 50)}`);
  } catch (e) {
    console.log(`  Screenshot failed ${short}: ${e.message?.slice(0, 80)}`);
  } finally {
    await page.close();
  }
}

await browser.close();

// Generate HTML
console.log('\nGenerating review HTML...');

const cards = screenshots
  .map((s) => {
    const imgData = fs.readFileSync(s.screenshotPath).toString('base64');
    return `<div class="commit-card">
  <div class="commit-header">
    <code>${s.shortHash}</code>
    <span class="commit-msg">${escapeHtml(s.msg)}</span>
    <span class="commit-date">${s.date}</span>
  </div>
  <img src="data:image/png;base64,${imgData}" alt="${s.shortHash}" />
</div>`;
  })
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Parchi UI Review — ${screenshots.length} Commits</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0b;color:#e4e4e7;font-family:-apple-system,system-ui,sans-serif;padding:24px}
h1{font-size:20px;font-weight:600;margin-bottom:8px;color:#fafafa}
.sub{font-size:13px;color:#71717a;margin-bottom:32px}
.grid{display:flex;flex-wrap:wrap;gap:24px}
.commit-card{background:#131316;border:1px solid #27272a;border-radius:12px;overflow:hidden;width:440px;flex-shrink:0}
.commit-header{padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #27272a;flex-wrap:wrap}
.commit-header code{font-family:'SF Mono',monospace;font-size:11px;color:#818cf8;background:rgba(129,140,248,.1);padding:2px 6px;border-radius:4px}
.commit-msg{font-size:12px;color:#a1a1aa;flex:1;min-width:150px}
.commit-date{font-size:10px;color:#52525b;white-space:nowrap}
.commit-card img{display:block;width:100%;height:auto}
</style>
</head>
<body>
<h1>Parchi UI Review — Sidepanel Across ${screenshots.length} Commits</h1>
<p class="sub">Rendered at 420x700 (2x DPR). Oldest at bottom, newest at top.</p>
<div class="grid">
${cards}
</div>
</body>
</html>`;

fs.writeFileSync(outHtml, html);
console.log(`\nDone! file://${outHtml}`);

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
