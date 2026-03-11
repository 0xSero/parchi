import type { ThemeDefinition } from './theme-definition.js';

export type HighContrastThemeInput = {
  id: string;
  name: string;
  accent: string;
  accentLight: string;
  accentDark: string;
  bg: string;
  card: string;
  border: string;
  fg?: string;
  muted?: string;
  mutedDim?: string;
};

export const hexToRgbTriplet = (hex: string): string => {
  const raw = hex.replace('#', '').trim();
  const normalized =
    raw.length === 3
      ? raw
          .split('')
          .map((char) => char + char)
          .join('')
      : raw;
  if (normalized.length !== 6) return '129 140 248';
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `${r} ${g} ${b}`;
};

export const createHighContrastTheme = ({
  id,
  name,
  accent,
  accentLight,
  accentDark,
  bg,
  card,
  border,
  fg = '#f7fafc',
  muted = '#a6b1c2',
  mutedDim = '#6b7688',
}: HighContrastThemeInput): ThemeDefinition => ({
  id,
  name,
  preview: { bg, accent, card },
  vars: {
    '--background': bg,
    '--foreground': fg,
    '--muted': muted,
    '--muted-dim': mutedDim,
    '--border': border,
    '--card': card,
    '--card-hover': card,
    '--accent': accent,
    '--accent-rgb': hexToRgbTriplet(accent),
    '--accent-light': accentLight,
    '--accent-dark': accentDark,
    '--success': '#4ade80',
    '--warning': '#fbbf24',
    '--error': '#f87171',
  },
});
