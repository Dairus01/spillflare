import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const nextCli = require.resolve("next/dist/bin/next");
const syncScript = fileURLToPath(new URL("./sync-data.mjs", import.meta.url));
const requestedInterval = Number(process.env.DATA_SYNC_INTERVAL_MS ?? 60_000);
const refreshInterval = Number.isFinite(requestedInterval)
  ? Math.max(requestedInterval, 10_000)
  : 60_000;

let refreshInProgress = false;
let shuttingDown = false;
let refreshChild;

function runRefresh() {
  if (shuttingDown) return;
  if (refreshInProgress) {
    console.log("[data-sync] Previous refresh is still running; this minute's overlapping refresh was skipped.");
    return;
  }

  refreshInProgress = true;
  console.log(`[data-sync] Starting background refresh at ${new Date().toISOString()}`);
  const child = spawn(process.execPath, [syncScript], {
    env: process.env,
    stdio: "inherit",
  });
  refreshChild = child;
  child.once("error", (error) => {
    console.error(`[data-sync] Could not start refresh: ${error.message}`);
  });
  child.once("close", (code) => {
    refreshInProgress = false;
    if (refreshChild === child) refreshChild = undefined;
    if (code !== 0) console.error(`[data-sync] Refresh ended with code ${code ?? "unknown"}; the last successful snapshots remain available.`);
  });
}

console.log(`[data-sync] Background refresh is enabled every ${Math.round(refreshInterval / 1000)} seconds.`);
runRefresh();
const interval = setInterval(runRefresh, refreshInterval);

const server = spawn(process.execPath, [nextCli, "start", ...process.argv.slice(2)], {
  env: process.env,
  stdio: "inherit",
});

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(interval);
  refreshChild?.kill(signal);
  server.kill(signal);
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));

server.once("error", (error) => {
  console.error(`[server] Could not start: ${error.message}`);
  clearInterval(interval);
  refreshChild?.kill();
  process.exitCode = 1;
});
server.once("close", (code, signal) => {
  clearInterval(interval);
  refreshChild?.kill();
  process.exitCode = code ?? (signal ? 1 : 0);
});
