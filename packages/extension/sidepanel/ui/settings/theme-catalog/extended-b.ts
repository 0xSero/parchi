import type { ThemeDefinition } from '../theme-definition.js';
import { createTheme } from './theme-factory.js';

export const EXTENDED_THEMES_B1: ThemeDefinition[] = [
  createTheme({
    id: 'obsidian',
    name: 'Obsidian',
    base: 'obsidian',
    vars: {
      '--foreground': '#e5e5e5',
      '--accent': '#a3a3a3',
      '--accent-light': '#d4d4d4',
      '--accent-dark': '#737373',
    },
  }),
  createTheme({
    id: 'graphite',
    name: 'Graphite',
    base: 'graphite',
    vars: {
      '--foreground': '#e8eaee',
      '--accent': '#a8b2c0',
      '--accent-light': '#c8d0dc',
      '--accent-dark': '#8890a0',
    },
  }),
  createTheme({
    id: 'mocha',
    name: 'Mocha',
    base: 'warm',
    vars: {
      '--foreground': '#f0e6dc',
      '--accent': '#a0785a',
      '--accent-light': '#c09878',
      '--accent-dark': '#806040',
    },
  }),
  createTheme({
    id: 'midnight',
    name: 'Midnight',
    base: 'midnight',
    vars: {
      '--foreground': '#eef2ff',
      '--accent': '#6366f1',
      '--accent-light': '#818cf8',
      '--accent-dark': '#4f46e5',
    },
  }),
  createTheme({
    id: 'frosted',
    name: 'Frosted',
    base: 'frost',
    vars: {
      '--foreground': '#e8f0f8',
      '--accent': '#a5c8e4',
      '--accent-light': '#c8dff0',
      '--accent-dark': '#78a8c8',
    },
  }),
];

export const EXTENDED_THEMES_B2: ThemeDefinition[] = [
  createTheme({
    id: 'charcoal',
    name: 'Charcoal',
    base: 'warm',
    vars: {
      '--foreground': '#f0ebe0',
      '--muted': '#989898',
      '--accent': '#e8a04a',
      '--accent-light': '#f0b870',
      '--accent-dark': '#c8842e',
    },
  }),
  createTheme({
    id: 'onyx',
    name: 'Onyx',
    base: 'onyx',
    vars: {
      '--foreground': '#f5f0e0',
      '--accent': '#d4af37',
      '--accent-light': '#e8c860',
      '--accent-dark': '#b89028',
    },
  }),
  createTheme({
    id: 'petrol',
    name: 'Petrol',
    base: 'cool',
    vars: {
      '--foreground': '#e8f4f2',
      '--accent': '#0d9488',
      '--accent-light': '#2dd4bf',
      '--accent-dark': '#0f766e',
    },
  }),
  createTheme({
    id: 'rosewood',
    name: 'Rosewood',
    base: 'warm',
    vars: {
      '--foreground': '#f8e8ee',
      '--accent': '#be4a6e',
      '--accent-light': '#d87090',
      '--accent-dark': '#9e3050',
    },
  }),
  createTheme({
    id: 'storm',
    name: 'Storm',
    base: 'storm',
    vars: {
      '--foreground': '#f0f0f4',
      '--accent': '#fbbf24',
      '--accent-light': '#fcd34d',
      '--accent-dark': '#f59e0b',
    },
  }),
  createTheme({
    id: 'carbon',
    name: 'Carbon',
    base: 'onyx',
    vars: {
      '--foreground': '#e8f0f8',
      '--muted-dim': '#606060',
      '--accent': '#38bdf8',
      '--accent-light': '#7dd3fc',
      '--accent-dark': '#0ea5e9',
    },
  }),
];
