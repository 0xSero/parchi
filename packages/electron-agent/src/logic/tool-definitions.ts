import type { ToolDefinition } from '@parchi/shared';

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'electron.launch',
    description: 'Launch an Electron app with a remote-debugging port enabled.',
    input_schema: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'App name on macOS (`open -a`) or executable on Linux.' },
        port: { type: 'number', description: 'CDP port to expose (default 9222).' },
        waitMs: { type: 'number', description: 'Optional wait after launch before returning.' },
        extraArgs: { type: 'array', items: { type: 'string' }, description: 'Additional app launch args.' },
      },
      required: ['app'],
    },
  },
  {
    name: 'electron.connect',
    description: 'Connect agent-browser to a running Electron app via CDP endpoint or port.',
    input_schema: {
      type: 'object',
      properties: {
        cdpEndpoint: { type: 'string', description: 'Port number or ws/http CDP endpoint.' },
        sessionId: { type: 'string', description: 'Logical session name (isolates agent-browser daemon state).' },
      },
      required: ['cdpEndpoint'],
    },
  },
  {
    name: 'electron.snapshot',
    description: 'Capture the current accessibility snapshot of the connected Electron app.',
    input_schema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        cdpEndpoint: { type: 'string' },
        interactive: { type: 'boolean', description: 'Include interactive refs (default true).' },
        includeCursorInteractive: { type: 'boolean', description: 'Include cursor interactive nodes (`-C`).' },
      },
    },
  },
  {
    name: 'electron.click',
    description: 'Click an element ref/selector in the Electron app.',
    input_schema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Element ref (e.g. @e4) or selector.' },
        sessionId: { type: 'string' },
        cdpEndpoint: { type: 'string' },
      },
      required: ['target'],
    },
  },
  {
    name: 'electron.type',
    description: 'Type or fill text into an element.',
    input_schema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Element ref/selector.' },
        text: { type: 'string', description: 'Text to type.' },
        fill: { type: 'boolean', description: 'Use fill instead of type.' },
        sessionId: { type: 'string' },
        cdpEndpoint: { type: 'string' },
      },
      required: ['target', 'text'],
    },
  },
  {
    name: 'electron.press',
    description: 'Press a key in the current Electron app context.',
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Keyboard key (Enter, Tab, Control+a, etc).' },
        sessionId: { type: 'string' },
        cdpEndpoint: { type: 'string' },
      },
      required: ['key'],
    },
  },
  {
    name: 'electron.tab',
    description: 'List/switch tabs or webviews in the Electron app.',
    input_schema: {
      type: 'object',
      properties: {
        index: { type: 'number', description: 'Switch to a tab index.' },
        urlPattern: { type: 'string', description: 'Switch using --url pattern.' },
        sessionId: { type: 'string' },
        cdpEndpoint: { type: 'string' },
      },
    },
  },
  {
    name: 'electron.screenshot',
    description: 'Capture screenshot from Electron app context.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Optional output path.' },
        full: { type: 'boolean', description: 'Capture full page.' },
        annotate: { type: 'boolean', description: 'Annotated screenshot with refs.' },
        sessionId: { type: 'string' },
        cdpEndpoint: { type: 'string' },
      },
    },
  },
  {
    name: 'electron.command',
    description: 'Run a raw agent-browser command for advanced control.',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'array', items: { type: 'string' }, description: 'Raw agent-browser command tokens.' },
        sessionId: { type: 'string' },
        cdpEndpoint: { type: 'string' },
        json: { type: 'boolean', description: 'Include --json global flag (default true).' },
      },
      required: ['command'],
    },
  },
];
