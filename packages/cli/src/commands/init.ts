import type { AuthConfig } from '../main-helpers.js';
import { runInitFlow } from '../main-helpers.js';

export interface InitAuthDeps {
  defaultPort: number;
  generateToken: () => string;
  readAuth: () => AuthConfig | null;
  writeAuth: (config: AuthConfig) => void;
  isDaemonRunning: () => boolean;
}

export async function cmdInit(flags: Record<string, string>, authDeps: InitAuthDeps) {
  await runInitFlow({
    flags,
    authDeps,
  });
}
