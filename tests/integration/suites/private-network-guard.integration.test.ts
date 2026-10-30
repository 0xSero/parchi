import { recordResponse, resetNetworkObserver } from '../../../packages/extension/background/network-observer.js';
import { isPrivateNetworkUrl } from '../../../packages/extension/background/private-network.js';
import { validateAndExecuteBrowserTool } from '../../../packages/extension/background/tools/tool-executor/browser-gate.js';
import { BrowserTools } from '../../../packages/extension/tools/browser-tools.js';
import { FakeBrowser, newDocumentId } from '../shared/fake-browser.js';
import { type AsyncTestRunner, log } from '../shared/runner.js';

// Issue #42 regression suite: the real tool gate + real BrowserTools against an in-memory browser. Every address is
// synthetic and no network I/O happens; "observed" remote addresses are fed the way webRequest reports them.
export const PUBLIC_IP = '93.184.215.14';
export const DEFAULT_SETTINGS = {
  toolPermissions: { read: true, interact: true, navigate: true, tabs: true, screenshots: true },
  allowedDomains: '',
};

export type GuardEnv = { fake: FakeBrowser; tools: BrowserTools; sessionId: string };

export async function withGuardEnv(fn: (env: GuardEnv) => Promise<void>) {
  resetNetworkObserver();
  const fake = new FakeBrowser();
  const restore = fake.install();
  try {
    await fn({ fake, tools: new BrowserTools(), sessionId: `s-${Math.random().toString(36).slice(2)}` });
  } finally {
    restore();
  }
}

export function sessionTab(env: GuardEnv, id: number, url: string, ip?: string, active = true) {
  const tab = env.fake.addTab({ id, url, active });
  env.tools.sessionTabs.set(id, { id, url, title: tab.title, windowId: 1 });
  env.tools.currentSessionTabId = id;
  if (ip) observe(url, ip, id);
  return tab;
}

export function observe(url: string, ip: string, tabId: number, frameId = 0, type = 'main_frame', documentId?: string) {
  recordResponse({ url, ip, tabId, frameId, type, documentId });
}

export async function runTool(
  env: GuardEnv,
  toolName: string,
  args: Record<string, unknown>,
  settings: any = DEFAULT_SETTINGS,
) {
  const ctx = { currentSettings: settings, currentSessionId: env.sessionId, getBrowserTools: () => env.tools } as any;
  const options = { settings, runMeta: { sessionId: env.sessionId, runId: 'r', turnId: 't' } } as any;
  const gated = await validateAndExecuteBrowserTool(ctx, env.tools, toolName, args, options);
  return gated.result as Record<string, any>;
}

export function assertBlocked(runner: AsyncTestRunner, result: Record<string, any>, leak: string, label: string) {
  runner.assertFalse(result?.success !== false, `${label}: expected the tool to be refused`);
  runner.assertFalse(JSON.stringify(result).includes(leak), `${label}: leaked "${leak}"`);
}

export async function runPrivateNetworkGuardSuite(runner: AsyncTestRunner) {
  log('\n=== Integration: Private Network Guard (issue #42) ===', 'info');

  await runner.test('classifier flags literal private hosts and address tricks', () => {
    for (const url of [
      'http://127.0.0.1/',
      'http://2130706433/',
      'http://0x7f.1/',
      'http://[::ffff:127.0.0.1]/',
      'http://a@10.0.0.5/',
      'http://intranet/',
      'http://127.0.0.1.nip.io/',
      'file:///etc/hosts',
    ]) {
      runner.assertTrue(isPrivateNetworkUrl(url), `${url} should be private`);
    }
    for (const url of ['https://example.com/', 'http://8.8.8.8/', 'http://[2606:4700::1]/']) {
      runner.assertFalse(isPrivateNetworkUrl(url), `${url} should be public`);
    }
  });

  await runner.test('literal private navigation is refused; Allowed Domains never grants private access', async () => {
    await withGuardEnv(async (env) => {
      sessionTab(env, 1, 'https://example.com/', PUBLIC_IP);
      for (const settings of [DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, allowedDomains: '127.0.0.1, localhost' }]) {
        const result = await runTool(env, 'openTab', { url: 'http://127.0.0.1:8080/secret' }, settings);
        assertBlocked(runner, result, 'content of', 'openTab 127.0.0.1');
      }
      runner.assertEqual(env.fake.createdUrls, [], 'No private tab should have been opened');
    });
  });

  await runner.test('public-looking hostname that resolved to a private address is not readable', async () => {
    await withGuardEnv(async (env) => {
      sessionTab(env, 1, 'http://wiki.corp-example.com/payroll', '10.0.0.5');
      assertBlocked(runner, await runTool(env, 'getContent', {}), 'content of', 'getContent DNS->10.0.0.5');
    });
  });

  await runner.test(
    'unverified destinations fail closed; verified public pages run pinned to judged documents',
    async () => {
      await withGuardEnv(async (env) => {
        const tab = sessionTab(env, 1, 'http://news.example.org/');
        assertBlocked(runner, await runTool(env, 'getContent', {}), 'content of', 'unobserved address');
        observe('http://news.example.org/', PUBLIC_IP, 1);
        const result = await runTool(env, 'getContent', {});
        runner.assertIncludes(JSON.stringify(result), 'content of http://news.example.org/');
        runner.assertEqual(env.fake.injections.at(-1)?.target, { tabId: 1, documentIds: [tab.frames[0].documentId] });
      });
    },
  );

  await runner.test('a spoofed url argument cannot redirect the check away from the real tab', async () => {
    await withGuardEnv(async (env) => {
      sessionTab(env, 1, 'http://127.0.0.1:9000/admin', '127.0.0.1');
      const result = await runTool(env, 'getContent', { url: 'https://example.com/' });
      assertBlocked(runner, result, 'content of http://127.0.0.1', 'spoofed url arg');
    });
  });

  await runner.test('a private iframe blocks read, write and screenshot tools on its parent tab', async () => {
    await withGuardEnv(async (env) => {
      const tab = sessionTab(env, 1, 'https://attacker.example.com/', PUBLIC_IP);
      const frame = {
        frameId: 7,
        documentId: newDocumentId(),
        url: 'http://router.example.net/',
        content: 'ROUTER-SECRET',
      };
      tab.frames.push(frame);
      observe(frame.url, '192.168.0.1', 1, 7, 'sub_frame');
      for (const [tool, args] of [
        ['getContent', {}],
        ['click', { selector: '#x' }],
        ['type', { selector: '#x', text: 'hi' }],
        ['screenshot', {}],
      ] as const) {
        assertBlocked(runner, await runTool(env, tool, args), 'ROUTER-SECRET', `${tool} with private iframe`);
      }
      runner.assertEqual(env.fake.injections.length, 0, 'No script may run in a tab with a private frame');
    });
  });

  await runner.test(
    'navigation that lands on a private address returns nothing and later reads stay blocked',
    async () => {
      await withGuardEnv(async (env) => {
        sessionTab(env, 1, 'https://example.com/', PUBLIC_IP);
        env.fake.onNavigate = (tabId, url) => {
          const target = 'http://portal.example.net/admin'; // public-looking name, redirected/resolved privately
          env.fake.commit(tabId, target);
          observe(target, '172.16.4.4', tabId);
          void url;
        };
        for (const tool of ['navigate', 'openTab']) {
          const result = await runTool(env, tool, { url: 'https://example.com/landing' });
          assertBlocked(runner, result, 'title of http://portal', `${tool} result`);
        }
        assertBlocked(runner, await runTool(env, 'getContent', {}), 'content of http://portal', 'read after redirect');
      });
    },
  );

  await runner.test('a page that navigates privately while a tool runs never yields its content', async () => {
    await withGuardEnv(async (env) => {
      sessionTab(env, 1, 'https://example.com/', PUBLIC_IP);
      env.fake.beforeNextInjection = () => {
        env.fake.commit(1, 'http://10.1.1.1/secret');
        observe('http://10.1.1.1/secret', '10.1.1.1', 1);
      };
      assertBlocked(runner, await runTool(env, 'getContent', {}), 'content of http://10.1.1.1', 'race');
    });
  });

  await runner.test('private-address subresources (DNS rebinding) taint the document that loaded them', async () => {
    await withGuardEnv(async (env) => {
      const tab = sessionTab(env, 1, 'https://rebind.example.com/', PUBLIC_IP);
      observe('https://rebind.example.com/api', '192.168.1.1', 1, 0, 'xmlhttprequest', tab.frames[0].documentId);
      assertBlocked(runner, await runTool(env, 'getContent', {}), 'content of', 'rebinding');
    });
  });
}
