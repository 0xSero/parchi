import type { SessionState } from './service-types.js';

export function enhanceSystemPrompt(
  basePrompt: string,
  context: {
    currentUrl: string;
    currentTitle: string;
    tabId: number | null;
    availableTabs: Array<{ id: number; title?: string; url?: string }>;
    orchestratorEnabled: boolean;
    teamProfiles: Array<{ name: string; provider?: string; model?: string }>;
    provider: string;
    model: string;
    toolCatalog: Array<{ name: string; description: string }>;
    showThinking: boolean;
  },
  sessionState: SessionState,
  matchedSkills: Array<{ name: string; description: string; steps: string }> = [],
) {
  const tabsSection =
    Array.isArray(context.availableTabs) && context.availableTabs.length
      ? `Tabs selected (${context.availableTabs.length}). You MUST only act on these tabs (session tabs). Always pass tabId from this list to navigate/click/type/pressKey/scroll/getContent/screenshot.\n${context.availableTabs
          .map((tab) => `  - [${tab.id}] ${tab.title || 'Untitled'} - ${tab.url}`)
          .join('\n')}`
      : 'No tabs selected; tools will fail until the user selects at least one tab in the UI.';
  const teamProfiles = Array.isArray(context.teamProfiles) ? context.teamProfiles : [];
  const teamSection = teamProfiles.length
    ? `Team profiles available for sub-agents:\n${teamProfiles
        .map((profile) => `  - ${profile.name}: ${profile.provider || 'provider'} · ${profile.model || 'model'}`)
        .join('\n')}\nUse spawn_subagent with a profile name to delegate parallel browser work.`
    : '';
  const orchestratorSection = context.orchestratorEnabled ? 'Orchestrator mode is enabled.' : '';
  const modelLabel = String(context.model || '').toLowerCase();
  const isKimi = context.provider === 'kimi' || modelLabel.includes('kimi');
  const thinkingSection =
    context.showThinking && isKimi
      ? '\n<thinking>\nIf you produce internal reasoning, wrap it in <analysis>...</analysis> tags. Keep it concise. Do not include the analysis in your final answer text.\n</thinking>'
      : '';
  const toolCatalog = Array.isArray(context.toolCatalog) ? context.toolCatalog : [];
  const availableToolNames = toolCatalog.length
    ? toolCatalog.map((tool) => String(tool?.name || '')).filter(Boolean)
    : [];
  const toolCatalogSection = toolCatalog.length
    ? `<tooling>
${toolCatalog.map((tool) => `  - ${tool.name}: ${tool.description || 'No description.'}`).join('\n')}
</tooling>`
    : '';
  const hasVisionTools =
    availableToolNames.includes('screenshot') ||
    availableToolNames.includes('watchVideo') ||
    availableToolNames.includes('getVideoInfo');
  const visionToolSection = hasVisionTools
    ? `<vision_tools>
Vision-capable tools enabled:
  - screenshot: capture a full screenshot of the current tab for visual verification.
  - watchVideo: analyze on-page video/audio elements for motion content.
  - getVideoInfo: fetch metadata for video elements (duration, playback, resolution).
  - findHtml: confirm whether exact HTML structure exists within page markup.
If vision tools are enabled, use them when visual structure or media context cannot be verified by text alone.
</vision_tools>`
    : '<vision_tools>Vision-capable tools are disabled for this model.</vision_tools>';
  const orchestratorToolSection = context.orchestratorEnabled
    ? availableToolNames.includes('spawn_subagent')
      ? '<orchestrator_tools>Orchestrator tools enabled: set_orchestrator_plan, get_orchestrator_plan, update_orchestrator_task, dispatch_orchestrator_tasks, spawn_subagent, list_subagents, await_subagent, subagent_complete. Use set_orchestrator_plan before dispatch, then spawn/await/list helpers as the DAG advances.</orchestrator_tools>'
      : '<orchestrator_tools>Orchestrator mode is enabled.</orchestrator_tools>'
    : '';

  // Build state section with enforcement - tracks exactly what model needs to do next
  let stateSection = '';
  let requiredNextCall = '';

  if (!sessionState.currentPlan || sessionState.currentPlan.steps.length === 0) {
    // No plan - MUST create one first
    requiredNextCall = 'set_plan({ steps: [{ title: "..." }, ...] })';
    stateSection = `
<execution_state>
⛔ NO ACTIVE PLAN

REQUIRED NEXT CALL: ${requiredNextCall}

You CANNOT call navigate, click, type, scroll, or pressKey until you call set_plan.
Create 3-6 specific action steps, then proceed.
</execution_state>`;
  } else {
    const steps = sessionState.currentPlan.steps;
    const doneCount = steps.filter((s) => s.status === 'done').length;
    const currentIndex = steps.findIndex((s) => s.status !== 'done');
    const launchedSubagents = Math.max(0, Number(sessionState.subAgentCount || 0));
    const requiresSubagentFanout = context.orchestratorEnabled && launchedSubagents < 2;
    const planLines = steps.map((step, i) => {
      const marker = step.status === 'done' ? '[✓]' : i === currentIndex ? '[→]' : '[ ]';
      return `${marker} step_index=${i}: ${step.title}`;
    });

    if (currentIndex === -1) {
      // All steps complete
      requiredNextCall = 'Provide final summary with findings';
      stateSection = `
<execution_state>
✅ ALL STEPS COMPLETE (${doneCount}/${steps.length})
${planLines.join('\n')}

REQUIRED: Provide your final summary now with evidence from getContent.
</execution_state>`;
    } else if (sessionState.awaitingVerification) {
      // Browser action taken but getContent not called yet
      requiredNextCall = 'getContent({ mode: "text" })';
      stateSection = `
<execution_state>
PROGRESS: ${doneCount}/${steps.length} steps complete
${planLines.join('\n')}

CURRENT STEP: "${steps[currentIndex].title}"
LAST ACTION: ${sessionState.lastBrowserAction || 'unknown'}
VERIFICATION: ⚠️ PENDING - getContent NOT called

⛔ REQUIRED NEXT CALL: ${requiredNextCall}

You MUST call getContent to verify your action before proceeding.
Do NOT call update_plan or any other tool until you call getContent.
</execution_state>`;
    } else if (requiresSubagentFanout) {
      requiredNextCall = 'spawn_subagent({ name: "...", profile: "...", tasks: ["..."] })';
      stateSection = `
<execution_state>
PROGRESS: ${doneCount}/${steps.length} steps complete
${planLines.join('\n')}

ORCHESTRATOR SUCCESS GATE: launch at least 2 sub-agents before finalizing.
SUB-AGENTS LAUNCHED: ${launchedSubagents}/2

⛔ REQUIRED NEXT CALL: ${requiredNextCall}

Delegate distinct work to additional sub-agents, then continue once at least two child sessions exist.
</execution_state>`;
    } else {
      // Ready to mark step done or execute next action
      requiredNextCall = `update_plan({ step_index: ${currentIndex}, status: "done" })`;
      stateSection = `
<execution_state>
PROGRESS: ${doneCount}/${steps.length} steps complete
${planLines.join('\n')}

CURRENT STEP: "${steps[currentIndex].title}"
VERIFICATION: ✓ getContent was called

⚠️ REQUIRED NEXT CALL: ${requiredNextCall}

After marking step ${currentIndex} done, proceed to step ${currentIndex + 1}.
</execution_state>`;
    }
  }

  const skillSection =
    matchedSkills.length > 0
      ? `<available_skills>\nSite-matched skills for ${context.currentUrl}:\n${matchedSkills
          .map((s) => `- ${s.name}: ${s.description}\n  Steps: ${s.steps}`)
          .join('\n')}\n</available_skills>`
      : '';

  return `${basePrompt}
 ${stateSection}${thinkingSection}
${toolCatalogSection}
${visionToolSection}
${orchestratorToolSection}
${skillSection ? `\n${skillSection}` : ''}

 <browser_context>
URL: ${context.currentUrl}
Title: ${context.currentTitle}
Tab: ${context.tabId}
${tabsSection}
</browser_context>
${orchestratorSection ? `\n${orchestratorSection}` : ''}
${teamSection ? `\n${teamSection}` : ''}

<enter_and_search_rules>
SEARCH:
• NEVER navigate to google.com/bing.com homepages just to type a query.
• If search is needed, use a direct results URL with encoded query OR go directly to target site.
• After ONE failed search attempt, switch strategy (different selector, click submit button, or direct URL).

ENTER / SUBMIT:
• Prefer clicking visible submit/search buttons when present.
• Use pressKey("Enter") once only; then verify page state with getContent.
• If Enter does not change content/URL, do not repeat blindly—use click submit or direct navigation.
</enter_and_search_rules>

<batch_actions>
When you need to perform the same action on multiple similar elements (e.g. clicking all "Approve" buttons, checking all checkboxes, deleting multiple items):
• Do NOT call click/type/fill repeatedly for each element.
• Instead, use evaluate() to run a single batch script. Example:
  evaluate({ expression: "document.querySelectorAll('button').forEach(b => { if (b.textContent.includes('Approve')) b.click(); })" })
• Then call getContent to verify all actions succeeded.
• If some elements are below the fold, scroll first, then batch again.
• This is faster, cheaper, and produces cleaner output.
</batch_actions>

<output_artifacts>
When the user asks for data extraction, reports, spreadsheets, or any file output:
• Use the create_file tool to produce a downloadable artifact.
• Always prefer structured formats: CSV for tabular data, JSON for structured data, Markdown for reports.
• Example: create_file({ filename: "prices.csv", content: "Product,Price\\nWidget,9.99\\nGadget,19.99" })
• The file appears as a download card in the chat — the user can click to save it.
</output_artifacts>

<checkpoint>
Before your next tool call, verify:
□ Required next call shown above: ${requiredNextCall}
□ If awaiting verification, call getContent first
□ If step complete, call update_plan before next step

When a tool fails:
• Read the error message carefully
• Try alternative approaches (different selector, wait longer, scroll first, etc.)
• You can retry the same tool with different parameters
• If an element is not found, try a broader selector or use text-based selection
• Never give up - keep trying until you succeed or exhaust options
</checkpoint>`;
}
