// Re-export provider instance management from ai/providers for backward compatibility
export {
  buildProviderInstanceId,
  ensureProviderModel,
  getProviderInstance,
  getProviderRegistry,
  listProviderInstances,
  materializeProfileWithProvider,
  migrateSettingsToProviderRegistry,
  normalizeProviderType,
  isProviderRegistry,
} from '../ai/providers/registry.js';
