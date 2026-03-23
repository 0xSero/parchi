import type { ComposedSkill, ToolDefinition } from '@parchi/shared';
import { getOrchestratorToolDefinitions } from './orchestrator/tool-definitions.js';

type BrowserToolProvider = {
  getToolDefinitions(): ToolDefinition[];
};

type ToolCatalogSettings = {
  enableScreenshots?: boolean;
} & Record<string, unknown>;

export function getToolsForSession(
  browserTools: BrowserToolProvider,
  settings: ToolCatalogSettings,
  includeOrchestrator = false,
  teamProfiles: Array<{ name: string }> = [],
  includeVisionTools = false,
) {
  let tools = browserTools.getToolDefinitions();
  if (settings && settings.enableScreenshots === false) {
    tools = tools.filter((tool) => tool.name !== 'screenshot');
  }
  if (!includeVisionTools) {
    tools = tools.filter((tool) => tool.name !== 'watchVideo' && tool.name !== 'getVideoInfo');
  }
  tools = tools.concat([
    {
      name: 'set_plan',
      description:
        'Set a checklist of concrete action steps to complete the task. Each step should be a single specific action (e.g., "Navigate to example.com", "Click the login button", "Extract product prices"). Avoid headers, phases, or abstract descriptions. Keep to 3-6 actionable steps. Mark steps done via update_plan as you complete them.',
      input_schema: {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Short action description (e.g., "Search for user profile", "Extract contact info")',
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'done'],
                  description: 'Step status - pending or done',
                },
              },
              required: ['title'],
            },
            description: 'Ordered list of 3-6 concrete action steps. Each step = one tool call or logical action.',
          },
        },
        required: ['steps'],
      },
    },
    {
      name: 'update_plan',
      description: 'Mark a plan step as done after completing it. Call this after each step you finish.',
      input_schema: {
        type: 'object',
        properties: {
          step_index: {
            type: 'number',
            description: 'Zero-based index of the step to mark done (0 = first step)',
          },
          status: {
            type: 'string',
            enum: ['done', 'pending', 'blocked'],
            description: 'New status for the step (defaults to "done")',
          },
        },
        required: ['step_index'],
      },
    },
    {
      name: 'create_file',
      description:
        'Create a downloadable file artifact for the user. Use this to output CSVs, JSON, text reports, markdown documents, or any structured data the user requested. The file will appear as a download card in the chat.',
      input_schema: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'File name with extension (e.g. "report.csv", "data.json", "summary.md")',
          },
          content: { type: 'string', description: 'File content as a string' },
          mimeType: {
            type: 'string',
            description: 'MIME type (defaults to text/plain). Common: text/csv, application/json, text/markdown',
          },
        },
        required: ['filename', 'content'],
      },
    },
    {
      name: 'list_report_images',
      description: 'List screenshots captured in this run session and whether they are selected for the final report.',
      input_schema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'select_report_images',
      description:
        'Select which captured screenshots should be included in the final report export. Use mode add/remove/replace/clear.',
      input_schema: {
        type: 'object',
        properties: {
          imageIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Screenshot IDs from list_report_images.',
          },
          mode: {
            type: 'string',
            enum: ['replace', 'add', 'remove', 'clear'],
            description: 'Selection mode. replace is default.',
          },
        },
      },
    },
  ]);

  if (includeOrchestrator) {
    const teamNames = Array.isArray(teamProfiles) ? teamProfiles.map((profile) => profile.name).filter(Boolean) : [];
    const profileSchema: {
      type: string;
      description: string;
      enum?: string[];
    } = {
      type: 'string',
      description: teamNames.length
        ? `Name of saved profile to use. Available: ${teamNames.join(', ')}`
        : 'Name of saved profile to use.',
    };
    if (teamNames.length) {
      profileSchema.enum = teamNames;
    }
    tools = tools.concat(getOrchestratorToolDefinitions(profileSchema));
  }
  return tools;
}

export async function getMatchedSkills(
  url: string,
): Promise<Array<{ name: string; description: string; steps: string }>> {
  try {
    const data = await chrome.storage.local.get('skills');
    const skills: ComposedSkill[] = Array.isArray(data.skills) ? data.skills : [];
    return skills
      .filter((skill) => {
        if (!skill.sitePattern) return false;
        try {
          return new RegExp(skill.sitePattern.replace(/\*/g, '.*')).test(url);
        } catch {
          return false;
        }
      })
      .slice(0, 5)
      .map((skill) => ({
        name: skill.name,
        description: skill.description,
        steps: skill.steps.map((s, i) => `${i + 1}. ${s.tool}(${JSON.stringify(s.args)})`).join('\n'),
      }));
  } catch {
    return [];
  }
}
