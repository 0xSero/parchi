import { CORE_THEMES_1 } from './theme-catalog-core-1.js';
import { CORE_THEMES_2 } from './theme-catalog-core-2.js';
import { EXTENDED_THEMES_A1 } from './theme-catalog-extended-a1.js';
import { EXTENDED_THEMES_A2 } from './theme-catalog-extended-a2.js';
import { EXTENDED_THEMES_B1 } from './theme-catalog-extended-b1.js';
import { EXTENDED_THEMES_B2 } from './theme-catalog-extended-b2.js';
import { HIGH_CONTRAST_THEMES_1 } from './theme-catalog-high-contrast-1.js';
import { HIGH_CONTRAST_THEMES_2 } from './theme-catalog-high-contrast-2.js';
import type { ThemeDefinition } from './theme-definition.js';

export type { ThemeDefinition } from './theme-definition.js';

export const THEMES: ThemeDefinition[] = [
  ...CORE_THEMES_1,
  ...CORE_THEMES_2,
  ...EXTENDED_THEMES_A1,
  ...EXTENDED_THEMES_A2,
  ...EXTENDED_THEMES_B1,
  ...EXTENDED_THEMES_B2,
  ...HIGH_CONTRAST_THEMES_1,
  ...HIGH_CONTRAST_THEMES_2,
];

export const DEFAULT_THEME_ID = 'void';

export function getThemeById(id: string): ThemeDefinition | undefined {
  return THEMES.find((t) => t.id === id);
}

export function applyTheme(id: string): void {
  const theme = getThemeById(id) || THEMES[0];
  const root = document.documentElement;
  for (const [prop, value] of Object.entries(theme.vars)) {
    root.style.setProperty(prop, value);
  }
}
