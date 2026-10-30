import { isPrivateNetworkUrl, isPrivateUrlApproved } from '../../../packages/extension/background/private-network.js';
import { checkToolPermission } from '../../../packages/extension/background/tool-permissions.js';
import { validateAndExecuteBrowserTool } from '../../../packages/extension/background/tools/tool-executor/browser-gate.js';
import { type AsyncTestRunner, log } from '../shared/runner.js';

// Issue #42 fixtures: every "private" URL below is a synthetic address that is never contacted; tab state is mocked.
const DEFAULT_SETTINGS = {
  toolPermissions: { read: true, interact: true, navigate: true, tabs: true, screenshots: true },
  allowedDomains: '',
};
const PRIVATE_URLS = [
  'http://127.0.0.1:8080/secret',
  'http://localhost:3000/admin',
  'http://intranet/hr',
  'http://169.254.169.254/latest/meta-data/',
  'http://10.0.0.5/',
  'http://192.168.1.1/',
  'http://[::1]/',
  'http://[::ffff:127.0.0.1]/',
  'http://2130706433/',
  'http://0x7f.0.0.1/',
  'http://0177.0.0.1/',
  'http://attacker.example@127.0.0.1/',
  'http://127.0.0.1.nip.io/',
  'http://wiki.corp.internal/',
  'http://printer.local./',
  'http://0.0.0.0:8000/',
  'file:///etc/hosts',
];
const PUBLIC_URLS = [
  'https://example.com/form',
  'https://docs.example.org/',
  'http://8.8.8.8/',
  'http://[2606:4700::1]/',
];

type MockTab = { id: number; url: string; pendingUrl?: string };

function installChromeTabs(tabs: Map<number, MockTab>) {
  const state = globalThis as typeof globalThis & { chrome?: typeof chrome };
  const original = state.chrome;
  state.chrome = {
    tabs: {
      get: async (tabId: number) => {
        const tab = tabs.get(tabId);
        if (!tab) throw new Error(`No tab ${tabId}`);
        return tab;
      },
      query: async () => [],
    },
  } as unknown as typeof chrome;
  return () => {
    state.chrome = original;
  };
}

function sessionTools(currentTabId: number, onExecute?: (toolName: string) => unknown) {
  return {
    tools: { openTab: {}, navigate: {}, getContent: {}, type: {}, click: {}, screenshot: {} },
    getCurrentSessionTabId: () => currentTabId,
    resolveTabId: async (args: { tabId?: unknown }) => (typeof args.tabId === 'number' ? args.tabId : currentTabId),
    executeTool: async (toolName: string) => onExecute?.(toolName) ?? { success: true, content: 'page text' },
  } as any;
}

async function permission(toolName: string, args: Record<string, unknown>, settings: any, tools = sessionTools(1)) {
  return checkToolPermission(toolName, args as any, settings, null, 's1', 's1', () => tools);
}

export async function runPrivateNetworkGuardSuite(runner: AsyncTestRunner) {
  log('\n=== Integration: Private Network Guard (issue #42) ===', 'info');

  await runner.test('classifier flags private hosts, address tricks and local files but not public hosts', () => {
    for (const url of PRIVATE_URLS) runner.assertTrue(isPrivateNetworkUrl(url), `${url} should be private`);
    for (const url of PUBLIC_URLS) runner.assertFalse(isPrivateNetworkUrl(url), `${url} should be public`);
    runner.assertTrue(isPrivateNetworkUrl('blob:http://127.0.0.1/abc'), 'blob URLs inherit their origin');
  });

  await runner.test('openTab/navigate to private destinations are blocked under default settings', async () => {
    for (const url of PRIVATE_URLS) {
      for (const tool of ['openTab', 'navigate']) {
        const result = await permission(tool, { url }, DEFAULT_SETTINGS);
        runner.assertFalse(result.allowed, `${tool} ${url} should be blocked`);
        runner.assertEqual(result.policy?.type, 'private-network');
      }
    }
    const unset = await permission('openTab', { url: 'http://127.0.0.1/' }, null);
    runner.assertFalse(unset.allowed, 'Missing settings must not disable the guard');
    const publicTab = await permission('openTab', { url: 'https://example.com/form' }, DEFAULT_SETTINGS);
    runner.assertTrue(publicTab.allowed, 'Public destinations stay allowed');
  });

  await runner.test('read and write tools are checked against the real tab, not a spoofed url arg', async () => {
    const restore = installChromeTabs(
      new Map([
        [1, { id: 1, url: 'http://127.0.0.1:8080/secret' }],
        [2, { id: 2, url: 'https://example.com/form' }],
        [3, { id: 3, url: 'https://attacker.example.net/' }],
      ]),
    );
    try {
      for (const tool of ['getContent', 'type', 'click', 'screenshot']) {
        const spoofed = await permission(tool, { url: 'https://example.com/form' }, DEFAULT_SETTINGS);
        runner.assertFalse(spoofed.allowed, `${tool} on a private tab must be blocked despite url arg`);
      }
      const allowlisted = await permission(
        'getContent',
        { tabId: 3, url: 'https://example.com/' },
        { allowedDomains: 'example.com' },
      );
      runner.assertFalse(allowlisted.allowed, 'url arg must not bypass the public allowlist either');
      const publicWrite = await permission('type', { tabId: 2, selector: '#q', text: 'x' }, DEFAULT_SETTINGS);
      runner.assertTrue(publicWrite.allowed, 'Writing to public tabs stays allowed');
    } finally {
      restore();
    }
  });

  await runner.test('redirects onto private origins are caught via committed and pending tab URLs', async () => {
    const tabs = new Map<number, MockTab>([
      [1, { id: 1, url: 'https://example.com/r', pendingUrl: 'http://10.0.0.5/' }],
    ]);
    const restore = installChromeTabs(tabs);
    try {
      const pending = await permission('getContent', {}, DEFAULT_SETTINGS);
      runner.assertFalse(pending.allowed, 'Pending private navigation should block reads');

      tabs.set(1, { id: 1, url: 'https://example.com/r' });
      let reads = 0;
      const tools = sessionTools(1, () => {
        reads += 1;
        tabs.set(1, { id: 1, url: 'http://10.0.0.5/' }); // navigation committed while the tool ran
        return { success: true, content: 'victim-only data' };
      });
      const ctx = { currentSettings: DEFAULT_SETTINGS, currentSessionId: 's1', getBrowserTools: () => tools } as any;
      const options = { settings: DEFAULT_SETTINGS, runMeta: { sessionId: 's1', runId: 'r', turnId: 't' } } as any;
      const gated = await validateAndExecuteBrowserTool(ctx, tools, 'getContent', {}, options);
      runner.assertEqual(reads, 1);
      runner.assertTrue(gated.shouldReturn, 'Output read after a private redirect must be withheld');
      runner.assertFalse(JSON.stringify(gated.result).includes('victim-only data'), 'Private content leaked');
    } finally {
      restore();
    }
  });

  await runner.test('explicitly approved private hosts keep local workflows working', async () => {
    const settings = { ...DEFAULT_SETTINGS, allowedPrivateHosts: 'localhost:3000, nas.lan, 192.168.1.10' };
    runner.assertTrue((await permission('openTab', { url: 'http://localhost:3000/app' }, settings)).allowed);
    runner.assertTrue((await permission('openTab', { url: 'http://media.nas.lan/' }, settings)).allowed);
    runner.assertTrue((await permission('navigate', { url: 'http://192.168.1.10/' }, settings)).allowed);
    runner.assertFalse((await permission('openTab', { url: 'http://localhost:4000/' }, settings)).allowed);
    runner.assertFalse((await permission('openTab', { url: 'http://192.168.1.11/' }, settings)).allowed);
    runner.assertTrue(isPrivateUrlApproved('http://10.1.2.3/', ['*']), '* approves every private host');
    const viaAllowlist = { allowedDomains: 'localhost, example.com' };
    runner.assertTrue((await permission('openTab', { url: 'http://localhost:5173/' }, viaAllowlist)).allowed);
  });
}
