export type ToolPermissions = {
  read: boolean;
  interact: boolean;
  navigate: boolean;
  tabs: boolean;
  screenshots: boolean;
};

export const DEFAULT_TOOL_PERMISSIONS: ToolPermissions = {
  read: true,
  interact: true,
  navigate: true,
  tabs: true,
  screenshots: true,
};

// Superset of keys used across background + sidepanel.
export const PARCHI_STORAGE_KEYS = [
  'providers',
  'provider',
  'apiKey',
  'model',
  'customEndpoint',
  'extraHeaders',
  'systemPrompt',
  'temperature',
  'maxTokens',
  'contextLimit',
  'timeout',
  'enableScreenshots',
  'sendScreenshotsAsImages',
  'screenshotQuality',
  'showThinking',
  'streamResponses',
  'autoScroll',
  'confirmActions',
  'saveHistory',
  'autoSaveSession',
  'toolPermissions',
  'allowedDomains',
  'activeConfig',
  'configs',
  'auxAgentProfiles',
  'useOrchestrator',
  'orchestratorProfile',
  'visionProfile',
  'visionBridge',
  'uiZoom',
  'fontPreset',
  'fontStylePreset',
  'colorMode',
  'timelineCollapsed',
  'accountModeChoice',
  'convexUrl',
  'convexAccessToken',
  'convexRefreshToken',
  'convexTokenExpiresAt',
  'convexUserId',
  'convexUserEmail',
  'convexSubscriptionPlan',
  'convexSubscriptionStatus',
  'convexSubscriptionCurrentPeriodEnd',
  'convexSubscriptionCheckedAt',
  'parchiRuntimeStatus',
  'theme',
  'workflows',
] as const;
