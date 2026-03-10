import fs from 'fs';
import http from 'http';
import path from 'path';

type TestContext = {
  panel: import('playwright').Page;
};

type RegisterArgs = {
  test: (name: string, fn: (ctx: TestContext) => Promise<void>) => void;
  assert: (condition: unknown, message: string) => void;
  repoRoot: string;
  sendRuntimeMessageWithResponse: (panel: import('playwright').Page, message: Record<string, unknown>) => Promise<any>;
};

async function executeRuntimeTool(
  sendRuntimeMessageWithResponse: RegisterArgs['sendRuntimeMessageWithResponse'],
  panel: import('playwright').Page,
  sessionId: string,
  tool: string,
  args: Record<string, unknown>,
) {
  const response: any = await sendRuntimeMessageWithResponse(panel, {
    type: 'execute_runtime_tool_test',
    sessionId,
    tool,
    args,
    runId: `${sessionId}-run`,
    turnId: `${tool}-${Date.now()}`,
  });
  if (response?.success !== true) {
    throw new Error(`Runtime tool ${tool} message failed: ${JSON.stringify(response)}`);
  }
  return response.result;
}

export function registerOrchestratorE2ETests({ test, assert, repoRoot, sendRuntimeMessageWithResponse }: RegisterArgs) {
  test('Orchestrator runtime executes a deterministic local multi-tab workflow', async ({ panel }) => {
    const pageHtml = fs.readFileSync(path.join(repoRoot, 'tests/integration/test-page.html'), 'utf8');
    const server = http.createServer((req, res) => {
      if (req.url?.startsWith('/test-page-')) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(pageHtml);
        return;
      }
      res.writeHead(404);
      res.end('Not found');
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as { port: number };
    const pageA = `http://127.0.0.1:${address.port}/test-page-a.html`;
    const pageB = `http://127.0.0.1:${address.port}/test-page-b.html`;
    const sessionId = `orchestrator-e2e-${Date.now()}`;

    try {
      await panel.evaluate(async () => {
        await chrome.storage.local.set({
          activeConfig: 'default',
          configs: {},
          auxAgentProfiles: [],
          useOrchestrator: true,
          orchestratorProfile: 'default',
          visionProfile: 'default',
          enableScreenshots: false,
          toolPermissions: {
            read: true,
            interact: true,
            navigate: true,
            tabs: true,
            screenshots: false,
          },
          allowedDomains: '',
        });
      });

      const setPlan = await executeRuntimeTool(
        sendRuntimeMessageWithResponse,
        panel,
        sessionId,
        'set_orchestrator_plan',
        {
          goal: 'Run a deterministic two-tab local workflow and reconcile the outputs',
          maxConcurrentTabs: 2,
          tasks: [
            {
              id: 'tab1_form_submit',
              title: 'Submit the form on the first local page',
              kind: 'browser',
              outputs: [{ key: 'form.identity', required: true }],
            },
            {
              id: 'tab2_click_and_wait',
              title: 'Trigger click + dynamic load on the second local page',
              kind: 'browser',
              outputs: [{ key: 'ui.dynamicLoaded', required: true }],
            },
            {
              id: 'reconcile',
              title: 'Reconcile the outcomes from both tabs',
              kind: 'validation',
              dependencies: ['tab1_form_submit', 'tab2_click_and_wait'],
              inputs: [
                { key: 'form.identity', fromTaskId: 'tab1_form_submit', required: true },
                { key: 'ui.dynamicLoaded', fromTaskId: 'tab2_click_and_wait', required: true },
              ],
              outputs: [{ key: 'summary.final', required: true }],
              validations: [{ kind: 'whiteboard_key', value: 'summary.final', required: true }],
            },
          ],
        },
      );
      assert(setPlan?.success === true, 'set_orchestrator_plan should succeed');
      assert(
        Array.isArray(setPlan.readyTaskIds) &&
          setPlan.readyTaskIds.includes('tab1_form_submit') &&
          setPlan.readyTaskIds.includes('tab2_click_and_wait'),
        'parallel browser tasks should be ready',
      );

      const dispatchWaveOne = await executeRuntimeTool(
        sendRuntimeMessageWithResponse,
        panel,
        sessionId,
        'dispatch_orchestrator_tasks',
        {
          maxTasks: 2,
          __testSubagentResults: {
            tab1_form_submit: {
              url: pageA,
              summary: 'Completed the form branch on tab 1.',
              script: [
                { tool: 'type', args: { selector: '#nameInput', text: 'Test User' } },
                { tool: 'type', args: { selector: '#emailInput', text: 'test@example.com' } },
                { tool: 'type', args: { selector: '#messageInput', text: 'Automated test' } },
                { tool: 'click', args: { selector: '#subscribeCheck' } },
                { tool: 'click', args: { selector: '#submitBtn' } },
              ],
              verifyTextIncludes: ['Form submitted: Test User, test@example.com'],
              data: { 'form.identity': 'Test User|test@example.com' },
            },
            tab2_click_and_wait: {
              url: pageB,
              summary: 'Completed the click/dynamic branch on tab 2.',
              script: [
                { tool: 'click', args: { selector: '#clickTest2' } },
                { tool: 'click', args: { selector: '#loadDynamic' } },
                { tool: 'getContent', args: { type: 'text' }, waitMs: 3200 },
              ],
              verifyTextIncludes: ['Button #2 was clicked!', 'Dynamic content loaded successfully'],
              data: { 'ui.dynamicLoaded': true },
            },
          },
        },
      );
      assert(dispatchWaveOne?.success === true, 'wave one dispatch should succeed');
      assert(dispatchWaveOne?.dispatched?.length === 2, 'wave one should dispatch two branches');

      const tabUrls: string[] = await panel.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        return tabs.map((tab) => String(tab.url || ''));
      });
      assert(tabUrls.includes(pageA), 'expected orchestrator tab for local page A');
      assert(tabUrls.includes(pageB), 'expected orchestrator tab for local page B');

      const awaitWaveOne = await executeRuntimeTool(
        sendRuntimeMessageWithResponse,
        panel,
        sessionId,
        'await_subagent',
        {},
      );
      assert(awaitWaveOne?.success === true, 'await_subagent should complete wave one');
      assert(
        awaitWaveOne?.planSummary?.readyTaskIds?.includes('reconcile'),
        'reconcile should unlock after the parallel branches',
      );

      const dispatchWaveTwo = await executeRuntimeTool(
        sendRuntimeMessageWithResponse,
        panel,
        sessionId,
        'dispatch_orchestrator_tasks',
        {
          maxTasks: 1,
          __testSubagentResults: {
            reconcile: {
              summary: 'Reconciled the two local branches.',
              data: {
                'summary.final': {
                  formIdentity: 'Test User|test@example.com',
                  dynamicLoaded: true,
                  verdict: 'local multi-tab workflow complete',
                },
              },
            },
          },
        },
      );
      assert(dispatchWaveTwo?.success === true, 'wave two dispatch should succeed');

      const awaitWaveTwo = await executeRuntimeTool(
        sendRuntimeMessageWithResponse,
        panel,
        sessionId,
        'await_agents',
        {},
      );
      assert(awaitWaveTwo?.success === true, 'await_agents alias should complete the final branch');

      const finalPlan = await executeRuntimeTool(
        sendRuntimeMessageWithResponse,
        panel,
        sessionId,
        'get_orchestrator_plan',
        {},
      );
      assert(finalPlan?.success === true, 'get_orchestrator_plan should succeed');
      assert(finalPlan?.taskCounts?.completed === 3, 'all orchestrator tasks should be completed');
      assert(
        finalPlan?.whiteboard?.['summary.final']?.value?.verdict === 'local multi-tab workflow complete',
        'final whiteboard verdict missing',
      );

      const artifactPath = path.join(repoRoot, 'test-output', 'orchestrator-e2e-runtime.json');
      fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
      fs.writeFileSync(
        artifactPath,
        `${JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            sessionId,
            pageA,
            pageB,
            dispatchWaveOne: dispatchWaveOne.dispatched,
            dispatchWaveTwo: dispatchWaveTwo.dispatched,
            finalPlan,
          },
          null,
          2,
        )}\n`,
      );
    } finally {
      server.close();
    }
  });
}
