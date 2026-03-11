import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type AuthConfig = {
  token: string;
  port: number;
  createdAt: string;
  extensionId?: string;
};

export function isNativeMessagingMode(): boolean {
  if (process.stdin.isTTY) return false;
  const args = process.argv.slice(2);
  return args.length === 1 && args[0].startsWith('chrome-extension://');
}

export function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const [k, v] = arg.slice(2).split('=');
    flags[k] = v ?? 'true';
  }
  return { positional, flags };
}

function getNativeHostManifestPaths(): string[] {
  const platform = os.platform();
  const dirs: string[] = [];
  if (platform === 'darwin') {
    dirs.push(path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'));
    dirs.push(path.join(os.homedir(), 'Library', 'Application Support', 'Chromium', 'NativeMessagingHosts'));
  } else if (platform === 'linux') {
    dirs.push(path.join(os.homedir(), '.config', 'google-chrome', 'NativeMessagingHosts'));
    dirs.push(path.join(os.homedir(), '.config', 'chromium', 'NativeMessagingHosts'));
  }
  return dirs.map((d) => path.join(d, 'com.parchi.bridge.json'));
}

export function detectExtensionId(): string | null {
  const platform = os.platform();
  const profileDirs: string[] = [];
  if (platform === 'darwin') {
    profileDirs.push(path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome'));
    profileDirs.push(path.join(os.homedir(), 'Library', 'Application Support', 'Chromium'));
  } else if (platform === 'linux') {
    profileDirs.push(path.join(os.homedir(), '.config', 'google-chrome'));
    profileDirs.push(path.join(os.homedir(), '.config', 'chromium'));
  }

  for (const profileDir of profileDirs) {
    const profileNames = ['Default'];
    try {
      const entries = fs.readdirSync(profileDir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && e.name.startsWith('Profile ')) profileNames.push(e.name);
      }
    } catch {
      continue;
    }

    for (const profile of profileNames) {
      const extDir = path.join(profileDir, profile, 'Extensions');
      try {
        const extIds = fs.readdirSync(extDir);
        for (const extId of extIds) {
          const versionDir = path.join(extDir, extId);
          try {
            const versions = fs.readdirSync(versionDir);
            for (const ver of versions) {
              const manifestPath = path.join(versionDir, ver, 'manifest.json');
              try {
                const raw = fs.readFileSync(manifestPath, 'utf8');
                const manifest = JSON.parse(raw);
                if (manifest.name === 'Parchi') return extId;
              } catch {}
            }
          } catch {}
        }
      } catch {}
    }
  }
  return null;
}

export function installNativeHostManifest(extensionId: string): string[] {
  const binaryPath = process.argv[1];
  const absPath = path.resolve(binaryPath);

  const manifest = {
    name: 'com.parchi.bridge',
    description: 'Parchi CLI — zero-config browser control',
    path: absPath,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };

  const paths = getNativeHostManifestPaths();
  const installed: string[] = [];
  for (const p of paths) {
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(manifest, null, 2));
      installed.push(p);
    } catch {}
  }
  return installed;
}

export function spawnDaemonBackground(): void {
  const { spawn } = require('node:child_process') as typeof import('node:child_process');
  const binPath = process.argv[1];
  const child = spawn(process.execPath, [binPath, 'daemon'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

export async function runInitFlow({
  flags,
  authDeps,
}: {
  flags: Record<string, string>;
  authDeps: {
    defaultPort: number;
    generateToken: () => string;
    readAuth: () => AuthConfig | null;
    writeAuth: (config: AuthConfig) => void;
    isDaemonRunning: () => boolean;
  };
}) {
  const { defaultPort, generateToken, readAuth, writeAuth, isDaemonRunning } = authDeps;
  let auth = readAuth();
  if (auth) {
    console.log('[init] Existing auth config found, reusing token.');
  } else {
    auth = {
      token: generateToken(),
      port: defaultPort,
      createdAt: new Date().toISOString(),
    };
    writeAuth(auth);
    console.log('[init] Generated new auth token.');
  }

  let extensionId = flags.extensionId || auth.extensionId || null;
  if (!extensionId) {
    console.log('[init] Scanning for Parchi extension...');
    extensionId = detectExtensionId();
  }
  if (!extensionId) {
    console.error(
      '[init] Could not detect Parchi extension ID.\n' +
        '       Install the extension, then re-run with --extensionId=<id>\n' +
        '       (Find the ID at chrome://extensions)',
    );
    process.exit(1);
  }
  console.log(`[init] Extension ID: ${extensionId}`);

  if (auth.extensionId !== extensionId) {
    auth.extensionId = extensionId;
    writeAuth(auth);
  }

  const installed = installNativeHostManifest(extensionId);
  if (installed.length === 0) {
    console.error('[init] Failed to install native messaging host manifest.');
    process.exit(1);
  }
  for (const p of installed) console.log(`[init] Installed native host manifest: ${p}`);

  if (isDaemonRunning()) {
    console.log('[init] Daemon already running.');
  } else {
    console.log('[init] Starting daemon...');
    spawnDaemonBackground();
    await new Promise((r) => setTimeout(r, 500));
    if (isDaemonRunning()) {
      console.log(`[init] Daemon started on port ${auth.port}.`);
    } else {
      console.log(`[init] Daemon spawned (port ${auth.port}). It may take a moment to initialize.`);
    }
  }

  console.log('\n[init] Done! Reload the extension in Chrome to auto-pair.');
  console.log('       Then run: parchi status');
}
