import { type BrowserToolArgs, formatToolError } from './browser-tool-shared.js';

const CORS_RULE_ID_BASE = 10000;
const MAX_CORS_RULES = 20;

type CorsRule = {
  id: number;
  domain: string;
  createdAt: number;
};

async function getStoredRules(): Promise<CorsRule[]> {
  try {
    const data = await chrome.storage.local.get('corsProxyRules');
    return Array.isArray(data.corsProxyRules) ? data.corsProxyRules : [];
  } catch {
    return [];
  }
}

async function setStoredRules(rules: CorsRule[]): Promise<void> {
  await chrome.storage.local.set({ corsProxyRules: rules });
}

function nextRuleId(rules: CorsRule[]): number {
  const used = new Set(rules.map((r) => r.id));
  for (let i = CORS_RULE_ID_BASE; i < CORS_RULE_ID_BASE + MAX_CORS_RULES * 2; i++) {
    if (!used.has(i)) return i;
  }
  return CORS_RULE_ID_BASE + rules.length;
}

export async function manageCorsRulesTool(_ctx: unknown, args: BrowserToolArgs) {
  const action = String(args.action || 'list');

  try {
    if (action === 'list') {
      const rules = await getStoredRules();
      return {
        success: true,
        rules: rules.map((r) => ({ id: r.id, domain: r.domain })),
        count: rules.length,
        maxRules: MAX_CORS_RULES,
      };
    }

    if (action === 'add') {
      const domain = typeof args.domain === 'string' ? args.domain.trim().toLowerCase() : '';
      if (!domain) return { success: false, error: 'Missing domain parameter.' };

      const rules = await getStoredRules();
      if (rules.some((r) => r.domain === domain)) {
        return { success: true, message: `CORS bypass already exists for ${domain}.`, alreadyExists: true };
      }
      if (rules.length >= MAX_CORS_RULES) {
        return { success: false, error: `Maximum ${MAX_CORS_RULES} CORS rules reached.` };
      }

      const ruleId = nextRuleId(rules);
      const urlFilter = `||${domain}`;

      const dnr = chrome.declarativeNetRequest;
      await dnr.updateDynamicRules({
        removeRuleIds: [ruleId],
        addRules: [
          {
            id: ruleId,
            priority: 1,
            action: {
              type: dnr.RuleActionType.MODIFY_HEADERS,
              responseHeaders: [
                { header: 'Access-Control-Allow-Origin', operation: dnr.HeaderOperation.SET, value: '*' },
                {
                  header: 'Access-Control-Allow-Methods',
                  operation: dnr.HeaderOperation.SET,
                  value: 'GET, POST, PUT, DELETE, OPTIONS',
                },
                { header: 'Access-Control-Allow-Headers', operation: dnr.HeaderOperation.SET, value: '*' },
              ],
            },
            condition: {
              urlFilter,
              resourceTypes: [dnr.ResourceType.XMLHTTPREQUEST, dnr.ResourceType.OTHER],
            },
          },
        ],
      });

      rules.push({ id: ruleId, domain, createdAt: Date.now() });
      await setStoredRules(rules);

      return { success: true, message: `CORS bypass added for ${domain}.`, ruleId, domain };
    }

    if (action === 'remove') {
      const ruleId = typeof args.ruleId === 'number' ? args.ruleId : null;
      const domain = typeof args.domain === 'string' ? args.domain.trim().toLowerCase() : '';

      const rules = await getStoredRules();
      const target = ruleId
        ? rules.find((r) => r.id === ruleId)
        : domain
          ? rules.find((r) => r.domain === domain)
          : null;

      if (!target) return { success: false, error: 'Rule not found.' };

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [target.id],
        addRules: [],
      });

      const updated = rules.filter((r) => r.id !== target.id);
      await setStoredRules(updated);

      return { success: true, message: `CORS rule removed for ${target.domain}.`, removedId: target.id };
    }

    return { success: false, error: `Unknown action: ${action}. Use add, remove, or list.` };
  } catch (error) {
    return {
      success: false,
      error: 'CORS rule management failed.',
      details: formatToolError(error),
    };
  }
}
