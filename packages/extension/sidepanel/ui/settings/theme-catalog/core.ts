import type { ThemeDefinition } from '../theme-definition.js';
import { createTheme } from './theme-factory.js';

export const CORE_THEMES_1: ThemeDefinition[] = [
  createTheme({
    id: 'void',
    name: 'Void',
    vars: {
      '--accent': '#818cf8',
      '--accent-light': '#a5b4fc',
      '--accent-dark': '#6366f1',
    },
  }),
  createTheme({
    id: 'ember',
    name: 'Ember',
    base: 'warm',
    vars: {
      '--foreground': '#f5f0e8',
      '--accent': '#f59e0b',
      '--accent-light': '#fbbf24',
      '--accent-dark': '#d97706',
    },
  }),
  createTheme({
    id: 'forest',
    name: 'Forest',
    base: 'cool',
    vars: {
      '--foreground': '#eef5f0',
      '--accent': '#34d399',
      '--accent-light': '#6ee7b7',
      '--accent-dark': '#10b981',
    },
  }),
  createTheme({
    id: 'ocean',
    name: 'Ocean',
    base: 'cool',
    vars: {
      '--foreground': '#eef8fa',
      '--accent': '#22d3ee',
      '--accent-light': '#67e8f9',
      '--accent-dark': '#06b6d4',
    },
  }),
  createTheme({
    id: 'sakura',
    name: 'Sakura',
    base: 'warm',
    vars: {
      '--foreground': '#faf2f6',
      '--accent': '#f472b6',
      '--accent-light': '#f9a8d4',
      '--accent-dark': '#ec4899',
    },
  }),
];

export const CORE_THEMES_2: ThemeDefinition[] = [
  createTheme({
    id: 'copper',
    name: 'Copper',
    base: 'warm',
    vars: {
      '--foreground': '#f5ede6',
      '--accent': '#d4845a',
      '--accent-light': '#e4a580',
      '--accent-dark': '#b86e44',
    },
  }),
  createTheme({
    id: 'arctic',
    name: 'Arctic',
    base: 'frost',
    vars: {
      '--foreground': '#f0f6fa',
      '--accent': '#7dd3fc',
      '--accent-light': '#bae6fd',
      '--accent-dark': '#38bdf8',
    },
  }),
  createTheme({
    id: 'neon',
    name: 'Neon',
    base: 'neon',
    vars: {
      '--foreground': '#eafaee',
      '--accent': '#4ade80',
      '--accent-light': '#86efac',
      '--accent-dark': '#22c55e',
    },
  }),
  createTheme({
    id: 'dusk',
    name: 'Dusk',
    base: 'violet',
    vars: {
      '--foreground': '#f5f3fa',
      '--accent': '#a78bfa',
      '--accent-light': '#c4b5fd',
      '--accent-dark': '#8b5cf6',
    },
  }),
  createTheme({
    id: 'rust',
    name: 'Rust',
    base: 'warm',
    vars: {
      '--foreground': '#f5ede8',
      '--accent': '#c2523c',
      '--accent-light': '#e0776a',
      '--accent-dark': '#a03828',
    },
  }),
];
