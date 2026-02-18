#!/usr/bin/env node

// tests/run-tests.ts
import { exec } from "child_process";
import { promisify } from "util";
var execAsync = promisify(exec);
var colors = {
  info: "\x1B[36m",
  success: "\x1B[32m",
  error: "\x1B[31m",
  warning: "\x1B[33m",
  reset: "\x1B[0m"
};
function log(message, type = "info") {
  console.log(`${colors[type]}${message}${colors.reset}`);
}
async function runCommand(command, description) {
  log(`
\u25B6 ${description}...`, "info");
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    log(`\u2713 ${description} completed`, "success");
    return true;
  } catch (error) {
    log(`\u2717 ${description} failed`, "error");
    console.error(error.stdout || error.stderr || error.message);
    return false;
  }
}
async function main() {
  log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557", "info");
  log("\u2551           Parchi - Test Suite         \u2551", "info");
  log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D", "info");
  let allPassed = true;
  allPassed = await runCommand("node dist/tests/validate-extension.js", "Extension Validation") && allPassed;
  allPassed = await runCommand("node dist/tests/unit/run-unit-tests.js", "Unit Tests") && allPassed;
  allPassed = await runCommand("node dist/tests/relay/run-relay-tests.js", "Relay Service Tests") && allPassed;
  log("\n" + "\u2550".repeat(40), "info");
  if (allPassed) {
    log("\u2713 All tests passed!", "success");
    log("Extension is ready to use.", "success");
    process.exit(0);
  } else {
    log("\u2717 Some tests failed", "error");
    log("Please fix the issues above.", "error");
    process.exit(1);
  }
}
main();
//# sourceMappingURL=run-tests.js.map
