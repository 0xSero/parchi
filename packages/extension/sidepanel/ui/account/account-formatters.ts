import { inferOpenRouterNamespace, stripRouterPrefix } from '../../../ai/providers/model-family.js';
import { ACCOUNT_MODE_KEY } from './account-mode.js';

export const PARCHI_PAID_DEFAULT_MODEL = 'moonshotai/kimi-k2.5';
export const LEGACY_MANAGED_DEFAULT_MODEL = 'openai/gpt-4o-mini';
export const PARCHI_RUNTIME_STATUS_KEY = 'parchiRuntimeStatus';
export const PARCHI_RUNTIME_STATUS_TTL_MS = 30 * 60 * 1000;

export const ACCOUNT_SETUP_STORAGE_KEYS = [
  ACCOUNT_MODE_KEY,
  'configs',
  'activeConfig',
  'provider',
  'apiKey',
  'model',
  'customEndpoint',
  'convexUrl',
  'convexAccessToken',
  'convexSubscriptionPlan',
  'convexSubscriptionStatus',
  'convexSubscriptionCurrentPeriodEnd',
  PARCHI_RUNTIME_STATUS_KEY,
] as const;

export const setHidden = (element: Element | null | undefined, hidden: boolean) => {
  if (!element) return;
  element.classList.toggle('hidden', hidden);
};

export const toUsageLabel = (usage: unknown) => {
  const u = usage as { requestCount?: unknown; tokensUsed?: unknown };
  const requestCount = Number(u?.requestCount || 0);
  const tokensUsed = Number(u?.tokensUsed || 0);
  return `${requestCount} req · ${tokensUsed} tokens`;
};

export const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

export const normalizeManagedModelId = (modelId: string) => {
  const model = stripRouterPrefix(String(modelId || '').trim());
  if (!model) return PARCHI_PAID_DEFAULT_MODEL;
  return inferOpenRouterNamespace(model);
};

export const hasConfiguredModel = (profile: Record<string, any> | null | undefined) =>
  Boolean(String(profile?.model || '').trim());

export const hasConfiguredApiKey = (profile: Record<string, any> | null | undefined) =>
  Boolean(String(profile?.apiKey || '').trim());

export const isOAuthProvider = (provider: unknown) =>
  String(provider || '')
    .trim()
    .toLowerCase()
    .endsWith('-oauth');

export const isManagedProvider = (provider: unknown) => {
  const normalized = String(provider || '')
    .trim()
    .toLowerCase();
  return normalized === 'parchi' || normalized === 'openrouter';
};

export const updateStatusCopy = (ui: any, text: string) => {
  if (ui.elements.accountStatusText) {
    ui.elements.accountStatusText.textContent = text;
  }
  const signedInStatus = document.getElementById('accountStatusTextSignedIn');
  if (signedInStatus) {
    signedInStatus.textContent = text;
  }
};
