import { readPid, removePid } from '../auth.js';

export function cmdStop() {
  const pid = readPid();
  if (!pid) {
    console.log('Daemon is not running.');
    return;
  }
  try {
    process.kill(pid, 'SIGTERM');
    removePid();
    console.log(`Daemon (PID ${pid}) stopped.`);
  } catch {
    removePid();
    console.log('Daemon was not running (stale PID removed).');
  }
}
