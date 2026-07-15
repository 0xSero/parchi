import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tmpDir = '/tmp/parchi-screenshots';
const outHtml = path.join(root, 'commit-ui-review.html');

// Get commit list in order (oldest first)
const dirs = fs.readdirSync(tmpDir).filter((d) => {
  return fs.existsSync(path.join(tmpDir, d, 'commit-info.json'));
});

// Load info and sort by date
const commits = dirs
  .map((d) => {
    const info = JSON.parse(fs.readFileSync(path.join(tmpDir, d, 'commit-info.json'), 'utf-8'));
    return { dir: d, ...info };
  })
  .sort((a, b) => new Date(a.date) - new Date(b.date));

console.log(`Assembling ${commits.length} commits...\n`);

// For each commit, build a self-contained HTML that inlines all CSS and the static layout
// (no JS needed — just the HTML structure + styles)
const assembled = [];

for (const c of commits) {
  const dir = path.join(tmpDir, c.dir);

  // Read all CSS files and inline them
  const cssFiles = [
    path.join(dir, 'panel.css'),
    ...fs.readdirSync(path.join(dir, 'styles')).map((f) => path.join(dir, 'styles', f)),
  ];
  const allCss = cssFiles
    .map((f) => {
      let css = fs.readFileSync(f, 'utf-8');
      // Convert relative imports/urls to absolute file paths for the preview
      css = css.replace(/@import\s+url\(["']\.\/styles\/([^"']+)["']\);?/g, '');
      css = css.replace(/url\(["']\.\.\/([^"']+)["']\)/g, (_, p) => `url("file://${path.resolve(dir, '..', p)}")`);
      return css;
    })
    .join('\n');

  // Read the template HTML fragments
  const sidebarShell = fs.readFileSync(path.join(dir, 'templates', 'sidebar-shell.html'), 'utf-8');
  const mainContent = fs.readFileSync(path.join(dir, 'templates', 'main.html'), 'utf-8');

  // Read the base panel.html to get the structure
  const panelHtml = fs.readFileSync(path.join(dir, 'panel.html'), 'utf-8');

  // Compose a full static page
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${c.dir}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Geist:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&family=Nunito+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" />
<style>
${allCss}
</style>
</head>
<body>
<div id="appRoot" class="app-container">
${sidebarShell}
${mainContent}
</div>
<div id="modalRoot"></div>
</body>
</html>`;

  const assembledPath = path.join(dir, 'assembled.html');
  fs.writeFileSync(assembledPath, fullHtml);
  assembled.push({ ...c, assembledPath });
  console.log(`  Assembled ${c.dir} ${c.msg.slice(0, 50)}`);
}

// Screenshot with Playwright
console.log('\nTaking screenshots...\n');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 420, height: 700 }, deviceScaleFactor: 2 });

const screenshots = [];

for (const c of assembled) {
  const page = await ctx.newPage();
  try {
    await page.goto(`file://${c.assembledPath}`, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000); // Wait for Google Fonts to load
    const screenshotPath = path.join(tmpDir, c.dir, 'screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: false });
    screenshots.push({ ...c, screenshotPath });
    console.log(`  Captured ${c.dir} ${c.msg.slice(0, 50)}`);
  } catch (e) {
    console.log(`  Failed ${c.dir}: ${e.message?.slice(0, 100)}`);
  } finally {
    await page.close();
  }
}

await browser.close();

// Generate review HTML
console.log('\nGenerating review HTML...');

const cards = screenshots
  .map((s) => {
    const imgData = fs.readFileSync(s.screenshotPath).toString('base64');
    return `<div class="commit-card">
  <div class="commit-header">
    <code>${s.dir}</code>
    <span class="commit-msg">${escapeHtml(s.msg)}</span>
    <span class="commit-date">${s.date}</span>
  </div>
  <img src="data:image/png;base64,${imgData}" />
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
<h1>Parchi UI Review — ${screenshots.length} Commits</h1>
<p class="sub">Static layout + CSS at each commit (oldest at bottom, newest at top). Rendered at 420x700 (2x DPR).</p>
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
