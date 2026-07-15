import { DEFAULT_AGENT_SYSTEM_PROMPT } from '@parchi/shared';
import type { SessionState } from '../../../packages/extension/background/service-types.js';
import { enhanceSystemPrompt } from '../../../packages/extension/background/system-prompt.js';
import { getBrowserToolDefinitions } from '../../../packages/extension/tools/browser-tool-definitions.js';
import { type AsyncTestRunner, log } from '../shared/runner.js';

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
    ...overrides,
  };
}

function createPromptContext(url: string, toolCatalog: Array<{ name: string; description: string }>) {
  return {
    currentUrl: url,
    currentTitle: 'CSP-strict SPA',
    tabId: 7,
    availableTabs: [{ id: 7, title: 'CSP-strict SPA', url }],
    orchestratorEnabled: false,
    teamProfiles: [],
    provider: 'openai',
    model: 'gpt-4.1',
    toolCatalog,
    showThinking: false,
  };
}

function getToolCatalog() {
  return getBrowserToolDefinitions(true).map((tool) => ({
    name: tool.name,
    description: tool.description || '',
  }));
}

export async function runCspHardeningPromptSuite(runner: AsyncTestRunner) {
  log('\n=== Integration: CSP-strict SPA hardening — prompt generalization ===', 'info');

  await runner.test('enhanceSystemPrompt injects csp_host_risk hint for facebook.com', async () => {
    const prompt = enhanceSystemPrompt(
      'BASE',
      createPromptContext('https://www.facebook.com/messages', getToolCatalog()),
      createSessionState(),
    );
    runner.assertIncludes(prompt, '<csp_host_risk>');
    runner.assertIncludes(prompt, 'facebook.com');
    runner.assertIncludes(prompt, 'AVOID evaluate() and waitFor(script)');
  });

  await runner.test(
    'enhanceSystemPrompt injects csp_host_risk hint for linkedin.com (non-Meta, generalized)',
    async () => {
      const prompt = enhanceSystemPrompt(
        'BASE',
        createPromptContext('https://www.linkedin.com/feed', getToolCatalog()),
        createSessionState(),
      );
      runner.assertIncludes(prompt, '<csp_host_risk>');
      runner.assertIncludes(prompt, 'linkedin.com');
    },
  );

  await runner.test('enhanceSystemPrompt injects csp_host_risk hint for x.com (non-Meta, generalized)', async () => {
    const prompt = enhanceSystemPrompt(
      'BASE',
      createPromptContext('https://x.com/home', getToolCatalog()),
      createSessionState(),
    );
    runner.assertIncludes(prompt, '<csp_host_risk>');
    runner.assertIncludes(prompt, 'x.com');
  });

  await runner.test(
    'enhanceSystemPrompt injects csp_host_risk hint for a banking/fintech host (chase.com)',
    async () => {
      const prompt = enhanceSystemPrompt(
        'BASE',
        createPromptContext('https://chase.com/dashboard', getToolCatalog()),
        createSessionState(),
      );
      runner.assertIncludes(prompt, '<csp_host_risk>');
      runner.assertIncludes(prompt, 'chase.com');
    },
  );

  await runner.test('enhanceSystemPrompt injects csp_host_risk hint for a sub-domain (mail.google.com)', async () => {
    const prompt = enhanceSystemPrompt(
      'BASE',
      createPromptContext('https://mail.google.com/inbox', getToolCatalog()),
      createSessionState(),
    );
    runner.assertIncludes(prompt, '<csp_host_risk>');
    runner.assertIncludes(prompt, 'mail.google.com');
  });

  await runner.test(
    'enhanceSystemPrompt does NOT inject csp_host_risk hint for a non-strict host (example.com)',
    async () => {
      const prompt = enhanceSystemPrompt(
        'BASE',
        createPromptContext('https://example.com/page', getToolCatalog()),
        createSessionState(),
      );
      runner.assertFalse(prompt.includes('<csp_host_risk>'), 'non-strict hosts should not get a csp_host_risk hint');
    },
  );

  await runner.test('enhanceSystemPrompt does NOT inject csp_host_risk hint for an empty / invalid URL', async () => {
    const promptEmpty = enhanceSystemPrompt('BASE', createPromptContext('', getToolCatalog()), createSessionState());
    runner.assertFalse(promptEmpty.includes('<csp_host_risk>'));

    const promptInvalid = enhanceSystemPrompt(
      'BASE',
      createPromptContext('not a url', getToolCatalog()),
      createSessionState(),
    );
    runner.assertFalse(promptInvalid.includes('<csp_host_risk>'));
  });

  await runner.test(
    'DEFAULT_AGENT_SYSTEM_PROMPT frames the CSP guidance as a general pattern, not Facebook-specific',
    async () => {
      runner.assertIncludes(DEFAULT_AGENT_SYSTEM_PROMPT, '<csp_strict_hosts>');
      runner.assertIncludes(DEFAULT_AGENT_SYSTEM_PROMPT, 'social networks, banking, enterprise SaaS, Google apps');
      runner.assertIncludes(DEFAULT_AGENT_SYSTEM_PROMPT, 'CSP-STRICT HOSTS');
      runner.assertIncludes(DEFAULT_AGENT_SYSTEM_PROMPT, 'RECOVERY LADDER');
      runner.assertFalse(
        /facebook[- ]?specific/i.test(DEFAULT_AGENT_SYSTEM_PROMPT),
        'default system prompt must not brand the guidance as facebook-specific',
      );
    },
  );

  await runner.test('DEFAULT_AGENT_SYSTEM_PROMPT embeds the csp_strict_hosts recovery ladder', async () => {
    runner.assertIncludes(DEFAULT_AGENT_SYSTEM_PROMPT, 'RECOVERY LADDER');
    runner.assertIncludes(DEFAULT_AGENT_SYSTEM_PROMPT, 'waitFor(selector)');
    runner.assertIncludes(DEFAULT_AGENT_SYSTEM_PROMPT, 'getContent');
    runner.assertIncludes(DEFAULT_AGENT_SYSTEM_PROMPT, 'screenshot');
    runner.assertIncludes(DEFAULT_AGENT_SYSTEM_PROMPT, 'findHtml');
  });

  await runner.test('enhanceSystemPrompt structured error recovery guide mentions every code from PAR-18', async () => {
    const prompt = enhanceSystemPrompt(
      'BASE',
      createPromptContext('https://www.facebook.com/messages', getToolCatalog()),
      createSessionState(),
    );
    runner.assertIncludes(prompt, 'csp_blocked');
    runner.assertIncludes(prompt, 'frame_detached');
    runner.assertIncludes(prompt, 'element_not_found');
    runner.assertIncludes(prompt, 'invalid_args');
  });
}
