import { buildAgentLoopContext } from '../../../packages/extension/background/agent/agent-loop/context.js';
import * as observer from '../../../packages/extension/background/network-observer.js';
import { newDocumentId } from '../shared/fake-browser.js';
import { type AsyncTestRunner, log } from '../shared/runner.js';
import {
  DEFAULT_SETTINGS,
  PUBLIC_IP,
  assertBlocked,
  observe,
  runTool,
  sessionTab,
  withGuardEnv,
} from './private-network-guard.integration.test.js';

// Issue #42 regression suite, part 4: findings of the closing review (in-page overlay text, non-web schemes,
// approved-private URLs in listings, stale pending frame responses).
const SECRET = 'SECRET-SENTINEL-7731';
const APPROVED = { ...DEFAULT_SETTINGS, allowedPrivateHosts: 'localhost:3000' };
const optional = (name: string) => (observer as Record<string, unknown>)[name] as ((d: object) => void) | undefined;

export async function runPrivateNetworkClosingSuite(runner: AsyncTestRunner) {
  log('\n=== Integration: Private Network Closing Review (issue #42) ===', 'info');

  await runner.test('P1-1 model-supplied tool arguments never reach page DOM overlays', async () => {
    await withGuardEnv(async (env) => {
      env.fake.addTab({ id: 2, url: 'https://attacker.example.com/', active: false });
      env.tools.sessionTabs.set(2, { id: 2, url: 'https://attacker.example.com/' });
      observe('https://attacker.example.com/', PUBLIC_IP, 2);
      sessionTab(env, 1, 'http://localhost:3000/app', '127.0.0.1');
      await runTool(env, 'getContent', {}, APPROVED); // private read: session is now fenced
      await runTool(env, 'getContent', { tabId: 2, selector: `#${SECRET}` }, APPROVED);
      await runTool(env, 'findHtml', { tabId: 2, selector: `.${SECRET}` }, APPROVED);
      await runTool(env, 'waitFor', { tabId: 2, text: SECRET, timeoutMs: 50 }, APPROVED);
      await runTool(env, 'navigate', { tabId: 2, url: `http://localhost:3000/?q=${SECRET}` }, APPROVED);
      const toAttacker = env.fake.messages.filter((entry) => entry.tabId === 2);
      runner.assertTrue(toAttacker.length > 0, 'positive control: overlays are still shown on the page');
      runner.assertFalse(JSON.stringify(toAttacker).includes(SECRET), 'secret written into attacker page overlay');
    });
  });

  await runner.test(
    'P1-2 browser/extension/opaque pages fail closed; executable schemes are not navigable',
    async () => {
      await withGuardEnv(async (env) => {
        sessionTab(env, 1, 'https://example.com/', PUBLIC_IP, false);
        for (const url of [
          'chrome://history/',
          'chrome-extension://abcdef/sidepanel/panel.html',
          'data:text/html,<p>x</p>',
        ]) {
          env.fake.addTab({ id: 2, url, active: true }); // the visible tab is what captureVisibleTab images
          const shot = await runTool(env, 'screenshot', { tabId: 1 });
          runner.assertFalse(shot.success !== false || 'dataUrl' in shot, `screenshot of visible ${url}`);
          env.tools.sessionTabs.set(2, { id: 2, url });
          assertBlocked(runner, await runTool(env, 'getContent', { tabId: 2 }), 'content of', `read ${url}`);
        }
        for (const url of [
          'chrome://settings/',
          'javascript:alert(1)',
          'data:text/html,x',
          'chrome-extension://abcdef/x.html',
        ]) {
          const nav = await runTool(env, 'navigate', { tabId: 1, url });
          runner.assertFalse(nav.success !== false, `navigate ${url} should be refused`);
        }
        runner.assertEqual(env.fake.tabs.get(1)?.pendingUrl, undefined, 'a refused navigation still started');
      });
    },
  );

  await runner.test(
    'P1-2 positive controls: about:blank tabs and data: iframes in public pages still work',
    async () => {
      await withGuardEnv(async (env) => {
        sessionTab(env, 1, 'about:blank');
        runner.assertIncludes(JSON.stringify(await runTool(env, 'getContent', {})), 'content of about:blank');
        const tab = sessionTab(env, 2, 'https://example.com/', PUBLIC_IP);
        tab.frames.push({ frameId: 4, documentId: newDocumentId(), url: 'data:text/html,<b>ad</b>', content: 'ad' });
        runner.assertIncludes(JSON.stringify(await runTool(env, 'getContent', {})), 'content of https://example.com/');
        const tabs = JSON.stringify(await runTool(env, 'getTabs', {}));
        runner.assertIncludes(tabs, 'about:blank', 'about:blank tab metadata stays visible');
      });
    },
  );

  await runner.test('P1-3 approved private tabs are listed by origin only, without tainting the session', async () => {
    await withGuardEnv(async (env) => {
      const url = 'http://localhost:3000/reset?token=XYZ-TOKEN#frag';
      sessionTab(env, 1, url, '127.0.0.1');
      const listed = JSON.stringify(await runTool(env, 'getTabs', {}, APPROVED));
      runner.assertIncludes(listed, 'http://localhost:3000', 'approved origin should be listed');
      runner.assertFalse(
        listed.includes('XYZ-TOKEN') || listed.includes('/reset'),
        'getTabs leaked the private path/query',
      );
      const ctx = {
        getBrowserTools: () => env.tools,
        currentSessionId: env.sessionId,
        getToolsForSession: () => [],
      } as any;
      const context = JSON.stringify(await buildAgentLoopContext(ctx, APPROVED as any, {} as any, [], false, false));
      runner.assertFalse(context.includes('XYZ-TOKEN') || context.includes('/reset'), 'system prompt leaked the query');
      // No over-taint: listing alone does not fence public writes.
      sessionTab(env, 2, 'https://example.org/', PUBLIC_IP);
      const nav = await runTool(env, 'navigate', { tabId: 2, url: 'https://example.org/next' }, APPROVED);
      runner.assertTrue(
        nav.success !== false,
        `public navigation after listing should be allowed: ${JSON.stringify(nav)}`,
      );
    });
  });

  await runner.test('a stale pending frame response cannot bind to a later unobserved commit', async () => {
    await withGuardEnv(async (env) => {
      const tab = sessionTab(env, 1, 'https://a.example.com/start', PUBLIC_IP);
      void tab;
      // A 204 for /page leaves a pending response; the next navigation to /page is served by a service worker.
      observer.recordResponse({
        url: 'https://a.example.com/page',
        ip: PUBLIC_IP,
        tabId: 1,
        frameId: 0,
        type: 'main_frame',
      });
      optional('clearPending')?.({ tabId: 1, frameId: 0 }); // webNavigation.onBeforeNavigate of the SW navigation
      const doc = env.fake.commit(1, 'https://a.example.com/page');
      optional('recordCommit')?.({ url: doc.url, tabId: 1, frameId: 0, documentId: doc.documentId });
      assertBlocked(
        runner,
        await runTool(env, 'getContent', {}),
        'content of https://a.example.com/page',
        'stale pending',
      );
    });
  });
}
