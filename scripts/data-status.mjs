import { readFile, readlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const exec = promisify(execFile);
const root = path.resolve(process.env.SPILLFLARE_DATA_DIR || path.join(process.cwd(), "data"));
const snapshotDirectory = process.env.SPILLFLARE_DATA_DIR ? path.join(root, "current") : path.join(root, "snapshots");
const metadata = JSON.parse(await readFile(path.join(snapshotDirectory, "metadata.json"), "utf8"));
const spills = JSON.parse(await readFile(path.join(snapshotDirectory, "spillsPrimary.json"), "utf8"));
let refresh = null;
try { refresh = JSON.parse(await readFile(path.join(root, "status.json"), "utf8")); } catch {}
let release = "repository snapshots";
try { release = await readlink(path.join(root, "current")); } catch {}
let pm2 = "not checked";
let nextRun = "not checked";
try { const { stdout } = await exec("pm2", ["jlist"]); const app = JSON.parse(stdout).find((item) => item.name === "spillflare"); pm2 = app?.pm2_env?.status ?? "not found"; } catch {}
try { const { stdout } = await exec("systemctl", ["list-timers", "spillflare-data-refresh.timer", "--no-pager", "--no-legend"]); nextRun = stdout.trim() || "timer not found"; } catch {}
const healthSources = refresh?.sources ?? metadata.sources ?? {};
console.log(JSON.stringify({ dataRoot: root, release, lastSuccessfulRefresh: refresh?.lastSuccessfulRefresh ?? metadata.retrievedAt, lastCheckAt: refresh?.lastCheckAt ?? null, lastResult: refresh?.lastResult ?? "repository snapshot", latestSpillObservation: metadata.sources?.spillsPrimary?.latestObservation ?? null, spillCount: spills.length, snapshotHash: metadata.sources?.spillsPrimary?.sha256 ?? null, degradedSources: Object.entries(healthSources).filter(([, value]) => value.status === "degraded").map(([key]) => key), pm2, nextRun }, null, 2));
