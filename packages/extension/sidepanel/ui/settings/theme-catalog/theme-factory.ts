import type { ThemeDefinition } from '../theme-definition.js';
import { hexToRgbTriplet } from './theme-factory-color.js';
import { DEFAULT_PREVIEW, DEFAULT_THEME_VARS, THEME_BASES } from './theme-factory-defaults.js';
import type { HighContrastThemeInput, ThemeOverrides, ThemeVars } from './theme-factory-types.js';

export type {
  HighContrastThemeInput,
  ThemeBaseName,
  ThemeOverrides,
  ThemePreview,
  ThemeVars,
} from './theme-factory-types.js';
export { hexToRgbTriplet } from './theme-factory-color.js';

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
