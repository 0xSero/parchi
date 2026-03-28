import { spawn } from 'node:child_process';
import { sleep } from '@parchi/shared';

export type LaunchElectronAppArgs = {
  app: string;
  port: number;
  waitMs: number;
  extraArgs: string[];
};

const launchMacApp = async ({ app, port, extraArgs }: LaunchElectronAppArgs) => {
  const child = spawn('open', ['-a', app, '--args', `--remote-debugging-port=${port}`, ...extraArgs], {
    detached: true,
    stdio: 'ignore',
  });

  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('spawn', () => resolve());
  });

  child.unref();
};

const launchLinuxApp = async ({ app, port, extraArgs }: LaunchElectronAppArgs) => {
  const child = spawn(app, [`--remote-debugging-port=${port}`, ...extraArgs], {
    detached: true,
    stdio: 'ignore',
  });

  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('spawn', () => resolve());
  });

  child.unref();
};

export const launchElectronApp = async (args: LaunchElectronAppArgs) => {
  if (process.platform === 'darwin') {
    await launchMacApp(args);
  } else if (process.platform === 'linux') {
    await launchLinuxApp(args);
  } else {
    throw new Error(
      `Unsupported platform (${process.platform}) for electron.launch. Use electron.command with a manual launcher.`,
    );
  }

  if (args.waitMs > 0) {
    await sleep(args.waitMs);
  }

  return {
    app: args.app,
    port: args.port,
    waitMs: args.waitMs,
    extraArgs: args.extraArgs,
    platform: process.platform,
  };
};
