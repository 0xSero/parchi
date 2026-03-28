import { buildRunPlan } from '@parchi/shared';
import type { SessionState } from '../../../packages/extension/background/service-types.js';
import { enhanceSystemPrompt } from '../../../packages/extension/background/system-prompt.js';
import { getMatchedSkills, getToolsForSession } from '../../../packages/extension/background/tools/tool-catalog.js';
import { getBrowserToolDefinitions } from '../../../packages/extension/tools/browser-tool-definitions.js';
import { type AsyncTestRunner, log } from '../shared/runner.js';

const browserTools = {
  getToolDefinitions: () => getBrowserToolDefinitions(true),
};

function createSessionState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    sessionId: 'session-1',
    currentPlan: null,
    orchestratorPlan: null,
    subAgentCount: 0,
    subAgentProfileCursor: 0,
    lastBrowserAction: null,
    awaitingVerification: false,
    currentStepVerified: false,
    kimiWarningSent: false,
    failureTracker: new Map(),
    reportImages: [],
    reportImageBytes: 0,
    selectedReportImageIds: new Set(),
    tokenVisibility: {
      providerInputTokens: null,
      providerOutputTokens: null,
      contextApproxTokens: null,
      contextLimit: null,
      contextPercent: null,
      sessionInputTokens: 0,
      sessionOutputTokens: 0,
      sessionTotalTokens: 0,
    },
    runningSubagents: new Map(),
    subagentHistory: new Map(),
    orchestratorWhiteboard: new Map(),
    attachments: [],
    ...overrides,
  };
}

function createPromptContext(toolCatalog: Array<{ name: string; description: string }>) {
  return {
    currentUrl: 'https://example.com/dashboard',
    currentTitle: 'Example Dashboard',
    tabId: 7,
    availableTabs: [{ id: 7, title: 'Example Dashboard', url: 'https://example.com/dashboard' }],
    orchestratorEnabled: true,
    teamProfiles: [{ name: 'researcher', provider: 'openai', model: 'gpt-4.1' }],
    provider: 'kimi',
    model: 'kimi-k2-vision',
    toolCatalog,
    showThinking: true,
  };
}

export async function runPromptAndCatalogIntegrationSuite(runner: AsyncTestRunner) {
  log('\n=== Integration: Prompt and Tool Catalog ===', 'info');

  await runner.test('tool catalog includes browser, planning, report, and orchestrator tools', async () => {
    const tools = getToolsForSession(browserTools, { enableScreenshots: true }, true, [{ name: 'researcher' }], true);
    const toolNames = tools.map((tool) => tool.name);
    const spawnTool = tools.find((tool) => tool.name === 'spawn_subagent');
    const profileEnum = (spawnTool?.input_schema as any)?.properties?.profile?.enum;

    runner.assertTrue(toolNames.includes('navigate'));
    runner.assertTrue(toolNames.includes('watchVideo'));
    runner.assertTrue(toolNames.includes('set_plan'));
    runner.assertTrue(toolNames.includes('set_orchestrator_plan'));
    runner.assertTrue(toolNames.includes('dispatch_orchestrator_tasks'));
    runner.assertTrue(toolNames.includes('list_report_images'));
    runner.assertTrue(toolNames.includes('spawn_subagent'));
    runner.assertTrue(toolNames.includes('list_subagents'));
    runner.assertTrue(toolNames.includes('await_subagent'));
    runner.assertEqual(profileEnum, ['researcher']);
  });

  await runner.test('tool catalog hides screenshots or vision tools when disabled', async () => {
    const tools = getToolsForSession(browserTools, { enableScreenshots: false }, false, [], false);
    const toolNames = tools.map((tool) => tool.name);

    runner.assertFalse(toolNames.includes('screenshot'));
    runner.assertFalse(toolNames.includes('watchVideo'));
    runner.assertFalse(toolNames.includes('getVideoInfo'));
    runner.assertTrue(toolNames.includes('set_plan'));
  });

  await runner.test('getMatchedSkills returns matching skills and ignores broken patterns', async () => {
    const state = globalThis as typeof globalThis & { chrome?: typeof chrome };
    const originalChrome = state.chrome;
    Object.defineProperty(state, 'chrome', {
      configurable: true,
      value: {
        ...originalChrome,
        storage: {
          ...originalChrome?.storage,
          local: {
            ...originalChrome?.storage?.local,
            get: async () => ({
              skills: [
                {
                  id: 'skill-1',
                  name: 'Checkout helper',
                  description: 'Helps with checkout pages',
                  sitePattern: 'example.com/.*',
                  steps: [
                    { tool: 'click', args: { selector: '#checkout' } },
                    { tool: 'type', args: { selector: '#email', text: 'user@example.com' } },
                  ],
                  positiveExamples: [],
                  negativeExamples: [],
                  createdAt: 1,
                  successCount: 0,
                  failureCount: 0,
                },
                {
                  id: 'skill-2',
                  name: 'Broken regex',
                  description: 'Should be ignored',
                  sitePattern: '[',
                  steps: [],
                  positiveExamples: [],
                  negativeExamples: [],
                  createdAt: 1,
                  successCount: 0,
                  failureCount: 0,
                },
              ],
            }),
          },
        },
      },
    });

    try {
      const matched = await getMatchedSkills('https://example.com/dashboard');
      runner.assertEqual(matched.length, 1);
      runner.assertEqual(matched[0]?.name, 'Checkout helper');
      runner.assertIncludes(matched[0]?.steps || '', '1. click({"selector":"#checkout"})');
    } finally {
      state.chrome = originalChrome;
    }
  });

  await runner.test(
    'getMatchedSkills returns empty when storage fails and orchestrator schema omits enum without profiles',
    async () => {
      const state = globalThis as typeof globalThis & { chrome?: typeof chrome };
      const originalChrome = state.chrome;
      Object.defineProperty(state, 'chrome', {
        configurable: true,
        value: {
          ...originalChrome,
          storage: {
            ...originalChrome?.storage,
            local: {
              ...originalChrome?.storage?.local,
              get: async () => {
                throw new Error('storage unavailable');
              },
            },
          },
        },
      });

      try {
        runner.assertEqual(await getMatchedSkills('https://example.com'), []);
        const tools = getToolsForSession(browserTools, { enableScreenshots: true }, true, [], true);
        const profileSchema = (tools.find((tool) => tool.name === 'spawn_subagent')?.input_schema as any)?.properties
          ?.profile;
        runner.assertFalse(Array.isArray(profileSchema?.enum), 'No enum should be emitted without team profiles');
      } finally {
        state.chrome = originalChrome;
      }
    },
  );

  await runner.test('system prompt enforces set_plan when no plan exists', async () => {
    const toolCatalog = getToolsForSession(
      browserTools,
      { enableScreenshots: true },
      true,
      [{ name: 'researcher' }],
      true,
    ).map((tool) => ({ name: tool.name, description: tool.description || '' }));
    const prompt = enhanceSystemPrompt('BASE', createPromptContext(toolCatalog), createSessionState());

    runner.assertIncludes(prompt, '⛔ NO ACTIVE PLAN');
    runner.assertIncludes(prompt, 'REQUIRED NEXT CALL: set_plan({ steps: [{ title: "..." }, ...] })');
    runner.assertIncludes(prompt, 'Vision-capable tools enabled:');
    runner.assertIncludes(prompt, 'Orchestrator tools enabled: set_orchestrator_plan, get_orchestrator_plan');
    runner.assertIncludes(prompt, 'Tabs selected (1).');
  });

  await runner.test('system prompt prioritizes verification and completion over subagent fanout', async () => {
    const toolCatalog = getToolsForSession(browserTools, { enableScreenshots: true }, false, [], false).map((tool) => ({
      name: tool.name,
      description: tool.description || '',
    }));
    const basePlan = buildRunPlan([{ title: 'Click checkout', status: 'pending' }], { now: 10 });

    const verifyingPrompt = enhanceSystemPrompt(
      'BASE',
      createPromptContext(toolCatalog),
      createSessionState({
        currentPlan: basePlan,
        awaitingVerification: true,
        lastBrowserAction: 'click',
        subAgentCount: 0,
      }),
    );
    runner.assertIncludes(verifyingPrompt, 'VERIFICATION: ⚠️ PENDING - getContent NOT called');
    runner.assertIncludes(verifyingPrompt, '⛔ REQUIRED NEXT CALL: getContent({ mode: "text" })');

    const donePlan = buildRunPlan([{ title: 'Click checkout', status: 'done' }], { now: 20 });
    const donePrompt = enhanceSystemPrompt(
      'BASE',
      createPromptContext(toolCatalog),
      createSessionState({ currentPlan: donePlan, subAgentCount: 0 }),
      [{ name: 'Skill A', description: 'Matched', steps: '1. click({})' }],
    );
    runner.assertIncludes(donePrompt, '✅ ALL STEPS COMPLETE (1/1)');
    runner.assertIncludes(donePrompt, 'REQUIRED: Provide your final summary now with evidence from getContent.');
    runner.assertIncludes(donePrompt, '<available_skills>');
  });

  await runner.test('system prompt enforces two-subagent gate when orchestrator mode is enabled', async () => {
    const toolCatalog = getToolsForSession(
      browserTools,
      { enableScreenshots: true },
      true,
      [{ name: 'researcher' }],
      true,
    ).map((tool) => ({ name: tool.name, description: tool.description || '' }));
    const basePlan = buildRunPlan(
      [
        { title: 'Inspect pricing page', status: 'pending' },
        { title: 'Compare checkout copy', status: 'pending' },
      ],
      { now: 30 },
    );

    const gatedPrompt = enhanceSystemPrompt(
      'BASE',
      createPromptContext(toolCatalog),
      createSessionState({ currentPlan: basePlan, subAgentCount: 1 }),
    );

    runner.assertIncludes(gatedPrompt, 'ORCHESTRATOR SUCCESS GATE: launch at least 2 sub-agents before finalizing.');
    runner.assertIncludes(gatedPrompt, 'SUB-AGENTS LAUNCHED: 1/2');
    runner.assertIncludes(
      gatedPrompt,
      'REQUIRED NEXT CALL: spawn_subagent({ name: "...", profile: "...", tasks: ["..."] })',
    );
  });
}
