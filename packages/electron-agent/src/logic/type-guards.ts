export const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export const asBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  return null;
};

export const asNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
};

export const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
};

export const withRequiredString = (record: Record<string, unknown>, key: string): string => {
  const value = asString(record[key]);
  if (!value) throw new Error(`Missing required string field: ${key}`);
  return value;
};
