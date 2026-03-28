import type { ThemeDefinition } from '../theme-definition.js';

type ThemeVars = ThemeDefinition['vars'];
type ThemePreview = ThemeDefinition['preview'];

export type ThemeBaseName =
  | 'default'
  | 'warm'
  | 'cool'
  | 'frost'
  | 'violet'
  | 'slate'
  | 'graphite'
  | 'obsidian'
  | 'onyx'
  | 'neon'
  | 'midnight'
  | 'storm';

export type ThemeOverrides = {
  id: string;
  name: string;
  base?: ThemeBaseName;
  preview?: Partial<ThemePreview>;
  vars: Pick<ThemeVars, '--accent' | '--accent-light' | '--accent-dark'> &
    Partial<Omit<ThemeVars, '--accent' | '--accent-light' | '--accent-dark'>>;
};

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

export type { ThemePreview, ThemeVars };
