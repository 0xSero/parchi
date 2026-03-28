import { DEFAULT_THEME_VARS } from './theme-factory-defaults.js';

export const hexToRgbTriplet = (hex: string): string => {
  const raw = hex.replace('#', '').trim();
  const normalized =
    raw.length === 3
      ? raw
          .split('')
          .map((char) => char + char)
          .join('')
      : raw;
  if (normalized.length !== 6) return DEFAULT_THEME_VARS['--accent-rgb'];
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `${r} ${g} ${b}`;
};
