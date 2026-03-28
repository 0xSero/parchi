import type { ThemeDefinition } from '../theme-definition.js';
import { createTheme } from './theme-factory.js';

export const EXTENDED_THEMES_A1: ThemeDefinition[] = [
  createTheme({
    id: 'crimson',
    name: 'Crimson',
    base: 'cool',
    vars: {
      '--foreground': '#fae8e8',
      '--accent': '#dc2626',
      '--accent-light': '#f87171',
      '--accent-dark': '#b91c1c',
    },
  }),
  createTheme({
    id: 'gold',
    name: 'Gold',
    base: 'frost',
    vars: {
      '--foreground': '#faf8ea',
      '--accent': '#eab308',
      '--accent-light': '#facc15',
      '--accent-dark': '#ca8a04',
    },
  }),
  createTheme({
    id: 'jade',
    name: 'Jade',
    base: 'cool',
    vars: {
      '--foreground': '#eefaf5',
      '--accent': '#059669',
      '--accent-light': '#34d399',
      '--accent-dark': '#047857',
    },
  }),
  createTheme({
    id: 'cobalt',
    name: 'Cobalt',
    base: 'cool',
    vars: {
      '--foreground': '#eff4ff',
      '--accent': '#3b82f6',
      '--accent-light': '#60a5fa',
      '--accent-dark': '#2563eb',
    },
  }),
  createTheme({
    id: 'coral',
    name: 'Coral',
    base: 'warm',
    vars: {
      '--foreground': '#fff1f2',
      '--accent': '#fb7185',
      '--accent-light': '#fda4af',
      '--accent-dark': '#f43f5e',
    },
  }),
];

export const EXTENDED_THEMES_A2: ThemeDefinition[] = [
  createTheme({
    id: 'lavender',
    name: 'Lavender',
    base: 'violet',
    vars: {
      '--foreground': '#faf5ff',
      '--accent': '#c084fc',
      '--accent-light': '#d8b4fe',
      '--accent-dark': '#a855f7',
    },
  }),
  createTheme({
    id: 'mint',
    name: 'Mint',
    base: 'cool',
    vars: {
      '--foreground': '#f0faf8',
      '--accent': '#2dd4bf',
      '--accent-light': '#5eead4',
      '--accent-dark': '#14b8a6',
    },
  }),
  createTheme({
    id: 'slate',
    name: 'Slate',
    base: 'slate',
    vars: {
      '--foreground': '#f1f5f9',
      '--accent': '#94a3b8',
      '--accent-light': '#cbd5e1',
      '--accent-dark': '#64748b',
    },
  }),
  createTheme({
    id: 'tangerine',
    name: 'Tangerine',
    base: 'warm',
    vars: {
      '--foreground': '#fff7ed',
      '--accent': '#f97316',
      '--accent-light': '#fb923c',
      '--accent-dark': '#ea580c',
    },
  }),
  createTheme({
    id: 'plum',
    name: 'Plum',
    base: 'frost',
    vars: {
      '--foreground': '#fdf4ff',
      '--accent': '#d946ef',
      '--accent-light': '#e879f9',
      '--accent-dark': '#c026d3',
    },
  }),
  createTheme({
    id: 'parchment',
    name: 'Parchment',
    base: 'warm',
    vars: {
      '--foreground': '#f5eed8',
      '--accent': '#d4a76a',
      '--accent-light': '#e4c08a',
      '--accent-dark': '#b8884a',
    },
  }),
];
