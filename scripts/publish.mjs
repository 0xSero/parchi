#!/usr/bin/env node
/**
 * Publish Parchi extension to Chrome Web Store.
 *
 * Usage:
 *   node scripts/publish.mjs            # publish to Chrome Web Store
 *   node scripts/publish.mjs --dry-run  # build ZIP only, skip upload
 *
 * Required environment variables (set in .env.publish or .env.local or shell):
 *
 *   Chrome Web Store (Option A - Service Account):
 *     CWS_EXTENSION_ID    – 32-char extension ID from Chrome Developer Dashboard
 *     CWS_SERVICE_ACCOUNT_KEY – service account JSON, base64 JSON, or path to key file
 *     CWS_PUBLISHER_ID    – numeric publisher ID from Chrome Web Store Developer Dashboard
 *
 *   Chrome Web Store (Option B - OAuth 2.0):
 *     CWS_EXTENSION_ID   – 32-char extension ID from Chrome Developer Dashboard
 *     CWS_CLIENT_ID      – OAuth 2.0 client ID (Google Cloud Console)
 *     CWS_CLIENT_SECRET  – OAuth 2.0 client secret
 *     CWS_REFRESH_TOKEN  – long-lived refresh token (via `npx chrome-webstore-upload-keys`)
 */

import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// ── Load .env.publish if it exists ────────────────────────────────────
const envFile = path.join(root, '.env.publish');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

// ── Read version ──────────────────────────────────────────────────────
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = pkg.version;
console.log(`\n📦 Parchi v${version}\n`);

const run = (cmd, opts = {}) => {
  console.log(`  → ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
};

const runCapture = (cmd, opts = {}) =>
  execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', cwd: root, ...opts }).trim();

const toBase64Url = (value) =>
  Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const createServiceAccountToken = (serviceAccount) => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/chromewebstore',
    aud: serviceAccount.token_uri || 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${toBase64Url(JSON.stringify(header))}.${toBase64Url(JSON.stringify(payload))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key, 'base64url');
  const jwt = `${unsigned}.${signature}`;

  const tokenRaw = runCapture(
    `curl -sS -X POST "${payload.aud}" ` +
      '-H "Content-Type: application/x-www-form-urlencoded" ' +
      `--data-urlencode "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer" ` +
      `--data-urlencode "assertion=${jwt}"`,
  );

  let tokenData;
  try {
    tokenData = JSON.parse(tokenRaw);
  } catch {
    throw new Error(`Unable to parse OAuth token response: ${tokenRaw}`);
  }
  if (!tokenData.access_token) {
    throw new Error(`Service account token request failed: ${tokenData.error || tokenRaw}`);
  }
  return tokenData.access_token;
};

const parseJsonOrThrow = (label, raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${label} returned non-JSON response: ${raw.slice(0, 300)}`);
  }
};

const toCurlJsonData = (obj) => `'${JSON.stringify(obj).replace(/'/g, "'\\''")}'`;

const parseServiceAccountInput = (rawValue) => {
  const trimmed = String(rawValue || '').trim();
  if (!trimmed) throw new Error('CWS_SERVICE_ACCOUNT_KEY is empty');

  const tryParseJson = (text) => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  const inlineJson = tryParseJson(trimmed);
  if (inlineJson) return inlineJson;

  const resolvedPath = path.isAbsolute(trimmed) ? trimmed : path.join(root, trimmed);
  if (fs.existsSync(resolvedPath)) {
    const fileJson = tryParseJson(fs.readFileSync(resolvedPath, 'utf8'));
    if (fileJson) return fileJson;
    throw new Error(`Service account key file is not valid JSON: ${resolvedPath}`);
  }

  let decodedBase64 = null;
  try {
    decodedBase64 = Buffer.from(trimmed, 'base64').toString('utf8');
  } catch {
    decodedBase64 = null;
  }
  if (decodedBase64) {
    const base64Decoded = tryParseJson(decodedBase64);
    if (base64Decoded) return base64Decoded;
  }

  throw new Error('CWS_SERVICE_ACCOUNT_KEY must be a JSON object, JSON file path, or base64-encoded JSON');
};

const uploadChromeViaServiceAccount = ({ extensionId, serviceAccountInput, zipPath, publisherId }) => {
  const serviceAccount = parseServiceAccountInput(serviceAccountInput);
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Invalid service account key: missing client_email/private_key');
  }

  const accessToken = createServiceAccountToken(serviceAccount);
  const itemName = `publishers/${publisherId}/items/${extensionId}`;
  const uploadRaw = runCapture(
    `curl -sS -X POST "https://chromewebstore.googleapis.com/upload/v2/${itemName}:upload" ` +
      `-H "Authorization: Bearer ${accessToken}" ` +
      '-H "Content-Type: application/octet-stream" ' +
      `--data-binary @"${zipPath}"`,
  );
  const uploadData = parseJsonOrThrow('Chrome upload', uploadRaw);
  const uploadState = String(uploadData.uploadState || '').toUpperCase();
  if (uploadState && uploadState !== 'SUCCEEDED' && uploadState !== 'IN_PROGRESS') {
    throw new Error(`Chrome upload failed: ${uploadRaw}`);
  }

  const publishRaw = runCapture(
    `curl -sS -X POST "https://chromewebstore.googleapis.com/v2/${itemName}:publish" ` +
      `-H "Authorization: Bearer ${accessToken}" ` +
      '-H "Content-Type: application/json" ' +
      `-d ${toCurlJsonData({ publishType: 'DEFAULT_PUBLISH' })}`,
  );
  const publishData = parseJsonOrThrow('Chrome publish', publishRaw);
  if (publishData.error) {
    throw new Error(`Chrome publish failed: ${publishRaw}`);
  }

  const state = String(publishData.state || 'UNKNOWN');
  return { state, itemName };
};

// ── Build ─────────────────────────────────────────────────────────────
console.log('🔨 Building Chrome extension...');
run('node scripts/build.mjs');
const chromeZip = path.join(root, `parchi-${version}-chrome.zip`);
run(`cd dist && zip -r "${chromeZip}" . -x '*.map' 'tests/*' 'tests/**/*'`);
console.log(`  ✓ ${path.basename(chromeZip)}\n`);

if (dryRun) {
  console.log('🏁 Dry run complete — ZIP built, skipping upload.\n');
  process.exit(0);
}

// ── Publish to Chrome Web Store ───────────────────────────────────────
const {
  CWS_EXTENSION_ID,
  CWS_CLIENT_ID,
  CWS_CLIENT_SECRET,
  CWS_REFRESH_TOKEN,
  CWS_SERVICE_ACCOUNT_KEY,
  CWS_PUBLISHER_ID,
} = process.env;

if (!CWS_EXTENSION_ID) {
  console.error(
    '⚠️  Chrome Web Store credentials missing. Set these env vars (or in .env.local/.env.publish):\n' +
      '   Option A (Service Account, preferred):\n' +
      '     CWS_EXTENSION_ID, CWS_SERVICE_ACCOUNT_KEY, CWS_PUBLISHER_ID\n' +
      '   Option B (OAuth 2.0):\n' +
      '     CWS_EXTENSION_ID, CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN\n',
  );
  process.exit(1);
}

console.log('🚀 Uploading to Chrome Web Store...');
try {
  if (CWS_SERVICE_ACCOUNT_KEY) {
    if (!CWS_PUBLISHER_ID) {
      throw new Error('Service account mode requires CWS_PUBLISHER_ID (Chrome Web Store publisher ID)');
    }
    const { state, itemName } = uploadChromeViaServiceAccount({
      extensionId: CWS_EXTENSION_ID,
      serviceAccountInput: CWS_SERVICE_ACCOUNT_KEY,
      zipPath: chromeZip,
      publisherId: CWS_PUBLISHER_ID,
    });
    console.log(`  ✓ Chrome Web Store: ${itemName} publish state ${state}\n`);
  } else if (CWS_CLIENT_ID && CWS_CLIENT_SECRET && CWS_REFRESH_TOKEN) {
    run(
      'npx chrome-webstore-upload-cli upload --source ' +
        `"${chromeZip}" ` +
        `--extension-id ${CWS_EXTENSION_ID} ` +
        `--client-id ${CWS_CLIENT_ID} ` +
        `--client-secret ${CWS_CLIENT_SECRET} ` +
        `--refresh-token ${CWS_REFRESH_TOKEN}`,
    );
    console.log('📢 Publishing to Chrome Web Store...');
    run(
      'npx chrome-webstore-upload-cli publish ' +
        `--extension-id ${CWS_EXTENSION_ID} ` +
        `--client-id ${CWS_CLIENT_ID} ` +
        `--client-secret ${CWS_CLIENT_SECRET} ` +
        `--refresh-token ${CWS_REFRESH_TOKEN}`,
    );
    console.log('  ✓ Chrome Web Store: submitted for review\n');
  } else {
    throw new Error('Invalid credentials configuration');
  }
} catch (err) {
  console.error('  ✗ Chrome Web Store publish failed:', err.message, '\n');
  process.exit(1);
}

console.log('🏁 Done.\n');
