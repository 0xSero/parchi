import { PARCHI_STORAGE_KEYS, asRecord } from '@parchi/shared';
import { migrateSettingsToProviderRegistry } from '../../ai/providers/registry.js';

export type SettingsSnapshot = Record<string, unknown>;

const SETTINGS_KEYS = [...PARCHI_STORAGE_KEYS] as string[];

const asRecordOrEmpty = (value: unknown): Record<string, unknown> => asRecord(value) ?? {};

export function pickSettingsSnapshot(input: unknown): SettingsSnapshot {
  const source = asRecordOrEmpty(input);
  const snapshot: SettingsSnapshot = {};
  for (const key of SETTINGS_KEYS) {
    if (source[key] !== undefined) snapshot[key] = source[key];
  }
  return snapshot;
}

export function mergeSettingsSnapshot(current: SettingsSnapshot, patch: SettingsSnapshot): SettingsSnapshot {
  return {
    ...pickSettingsSnapshot(current),
    ...pickSettingsSnapshot(patch),
  };
}

export function sanitizeImportedSettings(input: unknown): SettingsSnapshot {
  const snapshot = pickSettingsSnapshot(input);
  if (snapshot.configs !== undefined) {
    const configs = snapshot.configs;
    if (!configs || typeof configs !== 'object' || Array.isArray(configs)) {
      throw new Error('Invalid configs payload');
    }
  }
  return migrateSettingsToProviderRegistry(snapshot);
}

export async function readSettingsSnapshot(): Promise<SettingsSnapshot> {
  const stored = await chrome.storage.local.get(SETTINGS_KEYS);
  return migrateSettingsToProviderRegistry(pickSettingsSnapshot(stored));
}

export async function writeSettingsSnapshot(snapshot: SettingsSnapshot): Promise<SettingsSnapshot> {
  const next = migrateSettingsToProviderRegistry(pickSettingsSnapshot(snapshot));
  await chrome.storage.local.set(next);
  return next;
}

export async function patchSettingsSnapshot(patch: SettingsSnapshot): Promise<SettingsSnapshot> {
  const next = pickSettingsSnapshot(patch);
  await chrome.storage.local.set(next);
  return next;
}

export function createSettingsExportPayload(snapshot: SettingsSnapshot): SettingsSnapshot {
  return {
    ...pickSettingsSnapshot(snapshot),
    exportedAt: new Date().toISOString(),
    exportVersion: 1,
  };
}

export function subscribeToSettingsChanges(listener: (patch: SettingsSnapshot) => void): () => void {
  const handleChanges = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== 'local') return;
    const patch: SettingsSnapshot = {};
    for (const key of SETTINGS_KEYS) {
      const change = changes[key];
      if (!change) continue;
      patch[key] = change.newValue;
    }
    if (Object.keys(patch).length > 0) {
      listener(pickSettingsSnapshot(patch));
    }
  };

  chrome.storage.onChanged.addListener(handleChanges);
  return () => chrome.storage.onChanged.removeListener(handleChanges);
}
