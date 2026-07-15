import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Get the 25 commits in chronological order (oldest first)
const commitsRaw = execSync(`git log --oneline -25 --format="%H|%s|%ci" --reverse`, { cwd: root })
  .toString()
  .trim()
  .split('\n');

const commits = commitsRaw.map((line) => {
  const [hash, msg, date] = line.split('|');
  return { hash: hash.trim(), msg: msg.trim(), date: date.trim(), short: hash.trim().slice(0, 7) };
});

// For each consecutive pair, diff only sidepanel CSS/HTML/template files
const diffs = [];
for (let i = 1; i < commits.length; i++) {
  const prev = commits[i - 1];
  const curr = commits[i];

  let diff;
  try {
    diff = execSync(
      `git diff ${prev.hash} ${curr.hash} -- ` +
        'packages/extension/sidepanel/styles/ ' +
        'packages/extension/sidepanel/templates/ ' +
        'packages/extension/sidepanel/panel.css ' +
        'packages/extension/sidepanel/panel.html',
      { cwd: root, maxBuffer: 10 * 1024 * 1024 },
    )
      .toString()
      .trim();
  } catch (e) {
    diff = null;
  }

  if (diff && diff.length > 0) {
    diffs.push({ prev, curr, diff });
  }
}

console.log(`Found ${diffs.length} commits with UI changes out of ${commits.length} total\n`);

// Generate HTML
const sections = diffs
  .map((d) => {
    const diffHtml = escapeHtml(d.diff)
      .replace(/^(-.*)$/gm, '<span class="del">$1</span>')
      .replace(/^(\+.*)$/gm, '<span class="add">$1</span>')
      .replace(/^(@@.*@@)$/gm, '<span class="hunk">$1</span>')
      .replace(/^(diff .*)$/gm, '<span class="header">$1</span>')
      .replace(/^(index .*)$/gm, '<span class="header">$1</span>')
      .replace(/^(--- .*)$/gm, '<span class="header">$1</span>')
      .replace(/^(\+\+\+ .*)$/gm, '<span class="header">$1</span>');

    return `
<div class="diff-section">
  <div class="diff-header">
    <div class="diff-arrow">
      <code>${d.prev.short}</code>
      <span class="arrow">→</span>
      <code>${d.curr.short}</code>
    </div>
    <div class="diff-msg">${escapeHtml(d.curr.msg)}</div>
    <div class="diff-date">${d.curr.date}</div>
  </div>
  <pre class="diff-body">${diffHtml}</pre>
</div>`;
  })
  .join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Parchi UI Diff Review</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0b;color:#d4d4d8;font-family:-apple-system,system-ui,sans-serif;padding:24px}
h1{font-size:20px;font-weight:600;color:#fafafa;margin-bottom:6px}
.sub{font-size:13px;color:#71717a;margin-bottom:28px}
.diff-section{margin-bottom:32px;border:1px solid #27272a;border-radius:10px;overflow:hidden;background:#111113}
.diff-header{padding:14px 18px;border-bottom:1px solid #27272a;display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#161618}
.diff-header code{font-family:'SF Mono',monospace;font-size:11px;color:#818cf8;background:rgba(129,140,248,.1);padding:2px 8px;border-radius:4px}
.arrow{color:#52525b;margin:0 2px;font-size:14px}
.diff-msg{font-size:12px;color:#a1a1aa;flex:1;min-width:100px}
.diff-date{font-size:10px;color:#52525b;white-space:nowrap}
.diff-body{padding:16px;font-family:'SF Mono','JetBrains Mono',monospace;font-size:11px;line-height:1.55;overflow-x:auto;max-height:600px;overflow-y:auto;color:#a1a1aa}
.del{color:#f87171;background:rgba(248,113,113,.08);display:block}
.add{color:#4ade80;background:rgba(74,222,128,.08);display:block}
.hunk{color:#818cf8;background:rgba(129,140,248,.06);display:block;padding:2px 0}
.header{color:#52525b;display:block}
.legend{display:flex;gap:16px;margin-bottom:20px;font-size:11px;color:#71717a}
.legend span{display:flex;align-items:center;gap:4px}
.legend .box-del{width:12px;height:12px;background:rgba(248,113,113,.15);border:1px solid #f87171;border-radius:2px}
.legend .box-add{width:12px;height:12px;background:rgba(74,222,128,.15);border:1px solid #4ade80;border-radius:2px}
.legend .box-hunk{width:12px;height:12px;background:rgba(129,140,248,.15);border:1px solid #818cf8;border-radius:2px}
</style>
</head>
<body>
<h1>Parchi UI Diff Review — ${diffs.length} Changes</h1>
<p class="sub">CSS &amp; HTML diffs between consecutive commits (oldest → newest). ${commits.length} commits scanned.</p>
<div class="legend">
  <span><div class="box-del"></div> Removed lines</span>
  <span><div class="box-add"></div> Added lines</span>
  <span><div class="box-hunk"></div> Change hunks</span>
</div>
${sections}
</body>
</html>`;

const outPath = path.join(root, 'commit-ui-review.html');
fs.writeFileSync(outPath, html);
console.log(`Done! file://${outPath}`);

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
