import { launchElectronApp } from '../helpers/launch.js';
import type { ElectronToolContext, JsonRecord } from '../types.js';
import { buildGlobalArgs, runAgentCommand } from './command-helpers.js';
import { asBoolean, asNumber, asString, asStringArray, withRequiredString } from './type-guards.js';

const DEFAULT_WAIT_MS = 3000;

export const toolHandlers: Record<string, (args: JsonRecord, context: ElectronToolContext) => Promise<unknown>> = {
  'electron.launch': async (args) => {
    const app = withRequiredString(args, 'app');
    const port = Math.max(1, Math.floor(asNumber(args.port) || 9222));
    const waitMs = Math.max(0, Math.floor(asNumber(args.waitMs) || DEFAULT_WAIT_MS));
    const extraArgs = asStringArray(args.extraArgs);
    const launch = await launchElectronApp({ app, port, waitMs, extraArgs });
    return { ok: true, launch };
  },

  'electron.connect': async (args, context) => {
    const cdpEndpoint = withRequiredString(args, 'cdpEndpoint');
    return await runAgentCommand(context, [...buildGlobalArgs(args), 'connect', cdpEndpoint]);
  },

  'electron.snapshot': async (args, context) => {
    const command = [...buildGlobalArgs(args), 'snapshot'];
    if (asBoolean(args.interactive) !== false) command.push('-i');
    if (asBoolean(args.includeCursorInteractive) === true) command.push('-C');
    return await runAgentCommand(context, command);
  },

  'electron.click': async (args, context) => {
    const target = withRequiredString(args, 'target');
    return await runAgentCommand(context, [...buildGlobalArgs(args), 'click', target]);
  },

  'electron.type': async (args, context) => {
    const target = withRequiredString(args, 'target');
    const text = withRequiredString(args, 'text');
    const verb = asBoolean(args.fill) === true ? 'fill' : 'type';
    return await runAgentCommand(context, [...buildGlobalArgs(args), verb, target, text]);
  },

  'electron.press': async (args, context) => {
    const key = withRequiredString(args, 'key');
    return await runAgentCommand(context, [...buildGlobalArgs(args), 'press', key]);
  },

  'electron.tab': async (args, context) => {
    const index = asNumber(args.index);
    const urlPattern = asString(args.urlPattern);
    if (urlPattern) return await runAgentCommand(context, [...buildGlobalArgs(args), 'tab', '--url', urlPattern]);
    if (index != null)
      return await runAgentCommand(context, [...buildGlobalArgs(args), 'tab', String(Math.floor(index))]);
    return await runAgentCommand(context, [...buildGlobalArgs(args), 'tab']);
  },

  'electron.screenshot': async (args, context) => {
    const command = [...buildGlobalArgs(args), 'screenshot'];
    if (asBoolean(args.full) === true) command.push('--full');
    if (asBoolean(args.annotate) === true) command.push('--annotate');
    const path = asString(args.path);
    if (path) command.push(path);
    return await runAgentCommand(context, command);
  },

  'electron.command': async (args, context) => {
    const command = asStringArray(args.command);
    if (command.length === 0) throw new Error('electron.command requires non-empty command array');
    const includeJson = asBoolean(args.json) !== false;
    return await runAgentCommand(context, [...buildGlobalArgs(args, includeJson), ...command]);
  },
};
