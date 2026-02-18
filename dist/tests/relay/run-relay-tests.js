#!/usr/bin/env node

// tests/relay/run-relay-tests.ts
import { spawn } from "child_process";
import crypto from "crypto";
import net from "net";
import { WebSocket } from "ws";
var ROOT = process.cwd();
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
var TestRunner = class {
  passed = 0;
  failed = 0;
  errors = [];
  async test(description, fn) {
    try {
      await fn();
      this.passed += 1;
      log(`\u2713 ${description}`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err ?? "error");
      this.failed += 1;
      this.errors.push({ test: description, error: msg });
      log(`\u2717 ${description}: ${msg}`, "error");
    }
  }
};
var getFreePort = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") return reject(new Error("Could not acquire free port"));
        resolve(address.port);
      });
    });
  });
};
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var rpc = async ({
  host,
  port,
  token,
  method,
  params,
  includeAuth = true
}) => {
  const id = crypto.randomUUID();
  const res = await fetch(`http://${host}:${port}/v1/rpc`, {
    method: "POST",
    headers: {
      ...includeAuth ? { Authorization: `Bearer ${token}` } : {},
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
  });
  const data = await res.json();
  return { status: res.status, data };
};
var waitForPing = async (host, port, token) => {
  const deadline = Date.now() + 5e3;
  while (Date.now() < deadline) {
    try {
      const res = await rpc({ host, port, token, method: "relay.ping" });
      if (res.status === 200 && res.data?.result?.ok) return;
    } catch {
    }
    await sleep(60);
  }
  throw new Error("Daemon did not become ready");
};
var main = async () => {
  log("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557", "info");
  log("\u2551        Relay Service - Test Suite      \u2551", "info");
  log("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D", "info");
  const runner = new TestRunner();
  const host = "127.0.0.1";
  const port = await getFreePort();
  const token = `test_${crypto.randomBytes(16).toString("hex")}`;
  const daemonPath = `${ROOT}/dist-relay/relay-daemon.js`;
  if (!daemonPath || !daemonPath.endsWith(".js")) {
    throw new Error("Invalid daemon path");
  }
  const child = spawn(process.execPath, [daemonPath, `--host=${host}`, `--port=${port}`, `--token=${token}`], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PARCHI_RELAY_HOST: host,
      PARCHI_RELAY_PORT: String(port),
      PARCHI_RELAY_TOKEN: token
    }
  });
  let daemonStdout = "";
  let daemonStderr = "";
  child.stdout?.on("data", (d) => daemonStdout += String(d));
  child.stderr?.on("data", (d) => daemonStderr += String(d));
  try {
    await waitForPing(host, port, token);
    await runner.test("unauthorized requests return 401", async () => {
      const res = await rpc({ host, port, token, method: "relay.ping", includeAuth: false });
      if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
    });
    await runner.test("ping works", async () => {
      const res = await rpc({ host, port, token, method: "relay.ping" });
      if (!res.data?.result?.ok) throw new Error("expected ok=true");
    });
    await runner.test("agents.list empty before any agent connects", async () => {
      const res = await rpc({ host, port, token, method: "agents.list" });
      if (!Array.isArray(res.data?.result)) throw new Error("expected array");
      if (res.data.result.length !== 0) throw new Error("expected empty list");
    });
    await runner.test("forwarded call fails when no default agent", async () => {
      const res = await rpc({ host, port, token, method: "tools.list" });
      if (!res.data?.error?.message?.includes("No default agent")) {
        throw new Error(`expected No default agent error, got ${JSON.stringify(res.data)}`);
      }
    });
    await runner.test("WS agent connects and forwarded calls resolve", async () => {
      const ws = new WebSocket(`ws://${host}:${port}/v1/extension?token=${token}`);
      const agentId = `agent_${crypto.randomUUID()}`;
      const pending = /* @__PURE__ */ new Map();
      const onMessage = (raw) => {
        const msg = JSON.parse(String(raw));
        if (msg && msg.jsonrpc === "2.0" && msg.id && (msg.result || msg.error)) {
          const fn = pending.get(msg.id);
          if (fn) {
            pending.delete(msg.id);
            fn(msg);
          }
        }
        if (msg && msg.jsonrpc === "2.0" && msg.id && msg.method) {
          const method = String(msg.method);
          if (method === "tools.list") {
            ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: [{ name: "navigate" }] }));
            return;
          }
          if (method === "tool.call") {
            ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { ok: true } }));
            return;
          }
          ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, error: { code: -32e3, message: "unknown" } }));
        }
      };
      await new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error("ws open timeout")), 3e3);
        ws.on("open", () => {
          clearTimeout(to);
          resolve();
        });
        ws.on("error", reject);
      });
      ws.on("message", (d) => onMessage(d.toString()));
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          method: "agent.hello",
          params: { agentId, name: "fake-agent", version: "0.0.0", capabilities: { tools: true, agentRun: true } }
        })
      );
      const deadline = Date.now() + 3e3;
      while (Date.now() < deadline) {
        const res = await rpc({ host, port, token, method: "agents.list" });
        if (Array.isArray(res.data?.result) && res.data.result.some((a) => a.agentId === agentId)) break;
        await sleep(60);
      }
      const toolsRes = await rpc({ host, port, token, method: "tools.list" });
      if (!Array.isArray(toolsRes.data?.result) || toolsRes.data.result[0]?.name !== "navigate") {
        throw new Error(`unexpected tools.list result: ${JSON.stringify(toolsRes.data)}`);
      }
      const toolCallRes = await rpc({
        host,
        port,
        token,
        method: "tool.call",
        params: { tool: "navigate", args: { url: "https://example.com" } }
      });
      if (!toolCallRes.data?.result?.ok) {
        throw new Error(`unexpected tool.call result: ${JSON.stringify(toolCallRes.data)}`);
      }
      ws.close();
      await sleep(50);
    });
    await runner.test("run events are stored and run.wait returns done", async () => {
      const ws = new WebSocket(`ws://${host}:${port}/v1/extension?token=${token}`);
      const agentId = `agent_${crypto.randomUUID()}`;
      const runId = `run_${crypto.randomUUID()}`;
      await new Promise((resolve, reject) => {
        const to = setTimeout(() => reject(new Error("ws open timeout")), 3e3);
        ws.on("open", () => {
          clearTimeout(to);
          resolve();
        });
        ws.on("error", reject);
      });
      ws.send(JSON.stringify({ jsonrpc: "2.0", method: "agent.hello", params: { agentId } }));
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          method: "run.event",
          params: { runId, event: { type: "run_status", phase: "executing" } }
        })
      );
      ws.send(
        JSON.stringify({
          jsonrpc: "2.0",
          method: "run.done",
          params: { runId, status: "completed", final: { type: "assistant_final", content: "ok" } }
        })
      );
      const waited = await rpc({ host, port, token, method: "run.wait", params: { runId, timeoutMs: 2e3 } });
      if (waited.data?.result?.done?.status !== "completed")
        throw new Error(`unexpected: ${JSON.stringify(waited.data)}`);
      const events = await rpc({ host, port, token, method: "run.events", params: { runId } });
      if (!Array.isArray(events.data?.result?.events) || events.data.result.events.length < 1) {
        throw new Error(`unexpected: ${JSON.stringify(events.data)}`);
      }
      ws.close();
    });
  } finally {
    try {
      child.kill("SIGTERM");
    } catch {
    }
  }
  log("\n=== Relay Test Summary ===", "info");
  log(`Tests Passed: ${runner.passed}`, "success");
  if (runner.failed) {
    log(`Tests Failed: ${runner.failed}`, "error");
    runner.errors.forEach((e) => {
      log(`  ${e.test}: ${e.error}`, "error");
    });
    log("\nDaemon output (debug):", "warning");
    if (daemonStdout.trim()) console.log(daemonStdout.trim());
    if (daemonStderr.trim()) console.error(daemonStderr.trim());
    process.exit(1);
  }
  log("\u2713 All relay tests passed!", "success");
};
await main();
//# sourceMappingURL=run-relay-tests.js.map
