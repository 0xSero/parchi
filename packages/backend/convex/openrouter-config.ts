import type { OpenRouterLimitReset } from './openrouterManagement.js';
import { asRecord, asString } from './stripe-utils.js';

export type OpenRouterProvisioningPlan = {
  id: string;
  stripePriceId: string;
  keyLimitUsd: number;
  limitReset: OpenRouterLimitReset;
  allowedModels: string[];
  defaultModel: string;
};

export type OpenRouterProvisioningRuntimeConfig = {
  defaultPlanId: string;
  enforceModelGuardrail: boolean;
  enforceZdr: boolean;
  plans: OpenRouterProvisioningPlan[];
};

import {
  type OpenRouterLimitReset as LimitResetType,
  readOpenRouterProvisioningConfig,
} from './openrouterManagement.js';

const resolveProvisioningPriceId = () => {
  const priceId = asString(process.env.STRIPE_OPENROUTER_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID);
  if (!priceId) {
    throw new Error('Missing STRIPE_OPENROUTER_PRICE_ID (or STRIPE_PRO_PRICE_ID fallback)');
  }
  return priceId;
};

const parseAllowedModels = (value: unknown, fallback: string[]) => {
  if (value === null) return [];

  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)));
  }

  if (typeof value === 'string') {
    const parsed = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return Array.from(new Set(parsed));
  }

  return fallback;
};

const parseLimitReset = (value: unknown, fallback: LimitResetType): LimitResetType => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!normalized) return fallback;
  if (normalized === 'daily' || normalized === 'weekly' || normalized === 'monthly') return normalized;
  if (normalized === 'null' || normalized === 'none') return null;
  throw new Error(`Invalid limit_reset '${normalized}'. Expected daily|weekly|monthly|null`);
};

const parsePositiveNumber = (value: unknown, fallback: number, label: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    if (value == null || String(value).trim() === '') return fallback;
    throw new Error(`Invalid ${label}. Expected a positive number`);
  }
  return parsed;
};

export const resolveOpenRouterProvisioningRuntimeConfig = (): OpenRouterProvisioningRuntimeConfig => {
  const fallbackConfig = readOpenRouterProvisioningConfig();
  const defaultPlanId = asString(process.env.OPENROUTER_DEFAULT_PLAN_ID) || 'default';
  const fallbackAllowedModels = parseAllowedModels(process.env.OPENROUTER_ALLOWED_MODELS, [
    fallbackConfig.defaultModel,
  ]);
  const fallbackStripePriceId = resolveProvisioningPriceId();

  const parsePlan = (raw: unknown, index: number): OpenRouterProvisioningPlan => {
    const row = asRecord(raw) || {};
    const id = asString(row.id) || `plan-${index + 1}`;
    const stripePriceId = asString(row.stripePriceId) || asString(row.stripe_price_id) || fallbackStripePriceId;
    if (!stripePriceId) {
      throw new Error(`Plan '${id}' is missing stripePriceId`);
    }

    const allowedModels = parseAllowedModels(row.allowedModels ?? row.allowed_models, fallbackAllowedModels);
    const defaultModelCandidate = asString(row.defaultModel ?? row.default_model) || fallbackConfig.defaultModel;
    const defaultModel =
      allowedModels.length > 0
        ? allowedModels.includes(defaultModelCandidate)
          ? defaultModelCandidate
          : allowedModels[0]
        : defaultModelCandidate;

    return {
      id,
      stripePriceId,
      keyLimitUsd: parsePositiveNumber(
        row.keyLimitUsd ?? row.key_limit_usd,
        fallbackConfig.limitUsd,
        `plan '${id}' keyLimitUsd`,
      ),
      limitReset: parseLimitReset(row.limitReset ?? row.limit_reset, fallbackConfig.limitReset),
      allowedModels,
      defaultModel,
    };
  };

  const rawCatalog = asString(process.env.OPENROUTER_PLAN_CATALOG_JSON);
  if (!rawCatalog) {
    return {
      defaultPlanId,
      enforceModelGuardrail: fallbackConfig.enforceModelGuardrail,
      enforceZdr: fallbackConfig.enforceZdr,
      plans: [
        {
          id: defaultPlanId,
          stripePriceId: fallbackStripePriceId,
          keyLimitUsd: fallbackConfig.limitUsd,
          limitReset: fallbackConfig.limitReset,
          allowedModels: fallbackAllowedModels,
          defaultModel: fallbackAllowedModels[0] || fallbackConfig.defaultModel,
        },
      ],
    };
  }

  let parsedCatalog: unknown;
  try {
    parsedCatalog = JSON.parse(rawCatalog);
  } catch (error) {
    throw new Error(`Invalid OPENROUTER_PLAN_CATALOG_JSON: ${(error as Error).message}`);
  }

  if (!Array.isArray(parsedCatalog) || parsedCatalog.length === 0) {
    throw new Error('OPENROUTER_PLAN_CATALOG_JSON must be a non-empty JSON array');
  }

  const plans = parsedCatalog.map((entry, index) => parsePlan(entry, index));
  return {
    defaultPlanId: plans.some((plan) => plan.id === defaultPlanId) ? defaultPlanId : plans[0].id,
    enforceModelGuardrail: fallbackConfig.enforceModelGuardrail,
    enforceZdr: fallbackConfig.enforceZdr,
    plans,
  };
};

export const findPlanById = (runtime: OpenRouterProvisioningRuntimeConfig, planId: string) =>
  runtime.plans.find((plan) => plan.id === planId);

export const findPlanByStripePriceId = (runtime: OpenRouterProvisioningRuntimeConfig, stripePriceId: string) =>
  runtime.plans.find((plan) => plan.stripePriceId === stripePriceId);

export const choosePlanModelStrict = (plan: OpenRouterProvisioningPlan, requestedModel: string) => {
  const model = asString(requestedModel);
  if (model) {
    if (plan.allowedModels.length > 0 && !plan.allowedModels.includes(model)) {
      throw new Error(`Model '${model}' is not allowed for plan '${plan.id}'`);
    }
    return model;
  }
  if (plan.allowedModels.length > 0) {
    return plan.defaultModel || plan.allowedModels[0];
  }
  return plan.defaultModel;
};

export const choosePlanModelLenient = (plan: OpenRouterProvisioningPlan, requestedModel: string) => {
  const model = asString(requestedModel);
  if (!model) {
    return plan.allowedModels.length > 0 ? plan.defaultModel || plan.allowedModels[0] : plan.defaultModel;
  }
  if (plan.allowedModels.length === 0) return model;
  if (plan.allowedModels.includes(model)) return model;
  return plan.defaultModel || plan.allowedModels[0];
};
