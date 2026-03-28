import type { ThemeDefinition } from '../theme-definition.js';

type ThemeVars = ThemeDefinition['vars'];
type ThemePreview = ThemeDefinition['preview'];

type ThemeBaseName =
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

const DEFAULT_THEME_VARS: ThemeVars = {
  '--background': '#09090b',
  '--foreground': '#fafafa',
  '--muted': '#a1a1aa',
  '--muted-dim': '#71717a',
  '--border': '#27272a',
  '--card': '#131315',
  '--card-hover': '#1a1a1d',
  '--accent': '#818cf8',
  '--accent-rgb': '129 140 248',
  '--accent-light': '#a5b4fc',
  '--accent-dark': '#6366f1',
  '--success': '#4ade80',
  '--warning': '#fbbf24',
  '--error': '#f87171',
};

const THEME_BASES: Record<ThemeBaseName, Partial<ThemeVars>> = {
  default: {},
  warm: {
    '--background': '#0a0a0a',
    '--muted': '#a0a0a0',
    '--muted-dim': '#6e6e6e',
    '--border': '#262626',
    '--card': '#141414',
    '--card-hover': '#1c1c1c',
  },
  cool: {
    '--background': '#080808',
    '--muted': '#9a9a9a',
    '--muted-dim': '#6a6a6a',
    '--border': '#242424',
    '--card': '#121212',
    '--card-hover': '#1a1a1a',
  },
  frost: {
    '--background': '#090909',
    '--muted': '#9a9a9a',
    '--muted-dim': '#6a6a6a',
    '--border': '#252525',
    '--card': '#131313',
    '--card-hover': '#1b1b1b',
  },
  violet: {
    '--background': '#09090b',
    '--muted': '#a0a0aa',
    '--muted-dim': '#70707a',
    '--border': '#262628',
    '--card': '#131315',
    '--card-hover': '#1a1a1d',
  },
  slate: {
    '--background': '#0a0a0c',
    '--muted': '#8a8a94',
    '--muted-dim': '#5e5e68',
    '--border': '#242428',
    '--card': '#141416',
    '--card-hover': '#1c1c1e',
  },
  graphite: {
    '--background': '#0a0a0c',
    '--muted': '#8a8a94',
    '--muted-dim': '#606068',
    '--border': '#222226',
    '--card': '#141416',
    '--card-hover': '#1c1c1e',
  },
  obsidian: {
    '--background': '#020202',
    '--muted': '#737373',
    '--muted-dim': '#525252',
    '--border': '#1a1a1a',
    '--card': '#0a0a0a',
    '--card-hover': '#121212',
  },
  onyx: {
    '--background': '#040404',
    '--muted': '#909090',
    '--muted-dim': '#686868',
    '--border': '#1c1c1c',
    '--card': '#0e0e0e',
    '--card-hover': '#161616',
  },
  neon: {
    '--background': '#030303',
    '--muted': '#909090',
    '--muted-dim': '#606060',
    '--border': '#202020',
    '--card': '#0e0e0e',
    '--card-hover': '#161616',
  },
  midnight: {
    '--background': '#060608',
    '--muted': '#8a8a9a',
    '--muted-dim': '#5e5e6e',
    '--border': '#202028',
    '--card': '#101012',
    '--card-hover': '#18181a',
  },
  storm: {
    '--background': '#08080a',
    '--muted': '#8a8a94',
    '--muted-dim': '#60606a',
    '--border': '#222226',
    '--card': '#121214',
    '--card-hover': '#1a1a1c',
  },
};

const DEFAULT_PREVIEW: ThemePreview = {
  bg: DEFAULT_THEME_VARS['--background'],
  accent: DEFAULT_THEME_VARS['--accent'],
  card: DEFAULT_THEME_VARS['--card'],
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
  if (normalized.length !== 6) return DEFAULT_THEME_VARS['--accent-rgb'];
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `${r} ${g} ${b}`;
};

export const createTheme = ({ id, name, base = 'default', preview, vars }: ThemeOverrides): ThemeDefinition => {
  const mergedVars: ThemeVars = {
    ...DEFAULT_THEME_VARS,
    ...THEME_BASES[base],
    ...vars,
    '--accent-rgb': vars['--accent-rgb'] ?? hexToRgbTriplet(vars['--accent']),
  };

  return {
    id,
    name,
    preview: {
      ...DEFAULT_PREVIEW,
      bg: mergedVars['--background'],
      accent: mergedVars['--accent'],
      card: mergedVars['--card'],
      ...preview,
    },
    vars: mergedVars,
  };
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
}: HighContrastThemeInput): ThemeDefinition =>
  createTheme({
    id,
    name,
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
    },
  });
