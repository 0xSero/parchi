import type { MatchedSkill } from './agent-loop/shared.js';

type StoredSkillStep = {
  tool?: string;
  args?: Record<string, unknown>;
};

type StoredSkill = {
  name?: string;
  description?: string;
  sitePattern?: string;
  steps?: StoredSkillStep[];
};

export async function getMatchedSkills(url: string): Promise<MatchedSkill[]> {
  try {
    const data = await chrome.storage.local.get('skills');
    const skills = Array.isArray(data.skills) ? (data.skills as StoredSkill[]) : [];
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
        name: String(skill.name || ''),
        description: String(skill.description || ''),
        steps: Array.isArray(skill.steps)
          ? skill.steps
              .map((step, index) => `${index + 1}. ${String(step.tool || '')}(${JSON.stringify(step.args || {})})`)
              .join('\n')
          : '',
      }));
  } catch {
    return [];
  }
}
