// Barrel export for provider modules
export type { ModelEntry, ProviderCredentials, ProviderDefinition } from './types.js';
export {
  PROVIDER_REGISTRY,
  getAllProviders,
  getApiKeyProviders,
  getOAuthProviders,
  getProviderDefinition,
} from './definitions.js';
export { fetchModelsForProvider } from './fetch.js';
export { resolveProviderSdk } from './resolve.js';

// Provider instance management
export { buildProviderInstanceId } from './instance-id.js';
export {
  normalizeProviderInstance,
  normalizeProviderType,
  isProviderRegistry,
  buildProviderFromProfile,
} from './instance-normalize.js';
export {
  getProviderRegistry,
  listProviderInstances,
  getProviderInstance,
  ensureProviderModel,
} from './instance-registry.js';
export { materializeProfileWithProvider, migrateSettingsToProviderRegistry } from './instance-migrate.js';
export { normalizeProviderModels, mergeProviderModels } from './instance-models.js';
