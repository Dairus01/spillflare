import { createHash, randomUUID } from "node:crypto";
import { cp, lstat, mkdir, open, readFile, readdir, readlink, rename, rm, stat, symlink, unlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const exec = promisify(execFile);
const started = Date.now();
const root = path.resolve(process.env.SPILLFLARE_DATA_DIR || "/var/lib/spillflare");
const releases = path.join(root, "releases");
const currentLink = path.join(root, "current");
const statusFile = path.join(root, "status.json");
const lockFile = path.join(root, "refresh.lock");
const fixtureDir = process.env.SPILLFLARE_SOURCE_FIXTURE_DIR;
const skipHooks = process.env.SPILLFLARE_SKIP_RELOAD === "1";
const seed = path.resolve(process.env.SPILLFLARE_SEED_DIR || path.join(process.cwd(), "data", "snapshots"));

const sources = {
  spillsPrimary: "https://oilspillmonitor.ng/api/spill-data.php?dataset=nosdra&format=json",
  spillsMirror: "https://nosdra.oilspillmonitor.ng/osm-2019/api/spill-data.php?dataset=nosdra&format=json",
  flareState: "https://gasflaretracker.ng/api/mscf.php?area=state",
  flareLga: "https://gasflaretracker.ng/api/mscf.php?area=lga",
  flareCluster: "https://gasflaretracker.ng/api/mscf.php?area=cluster",
  flareBlock: "https://gasflaretracker.ng/api/mscf.php?area=block",
  flareOnshoreOffshore: "https://gasflaretracker.ng/api/mscf.php?area=onshore_offshore",
  flareCompany: "https://gasflaretracker.ng/api/mscf.php?area=company",
  geoStates: "https://gasflaretracker.ng/api/feature-collection.php?table=states",
  geoLgas: "https://gasflaretracker.ng/api/feature-collection.php?table=lgas",
  geoBlocks: "https://gasflaretracker.ng/api/feature-collection.php?table=blocks",
  geoClusters: "https://gasflaretracker.ng/api/feature-collection.php?table=clusters",
  geoOnshoreOffshore: "https://gasflaretracker.ng/api/feature-collection.php?table=onshore_offshore",
  geoLocations: "https://gasflaretracker.ng/api/feature-collection.php?table=location",
  geoPopulation: "https://gasflaretracker.ng/api/feature-collection.php?table=population",
  geoOilfields: "https://gasflaretracker.ng/api/feature-collection.php?table=oilfields",
};

const outputName = (key) => key === "spillsMirror" ? null : `${key}.json`;
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const count = (value) => Array.isArray(value) ? value.length : Array.isArray(value?.features) ? value.features.length : 0;
const latestObservation = (key, value) => !Array.isArray(value) ? null : value.map((row) => typeof row?.[key.startsWith("spills") ? "incidentdate" : "month"] === "string" ? row[key.startsWith("spills") ? "incidentdate" : "month"] : "").filter((item) => /^\d{4}-\d{2}(?:-\d{2})?$/.test(item)).sort().at(-1) ?? null;

async function atomicJson(file, value) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o640 });
  await rename(temporary, file);
}

async function priorStatus() {
  try { return JSON.parse(await readFile(statusFile, "utf8")); } catch { return {}; }
}

async function setStatus(update) {
  await atomicJson(statusFile, { ...(await priorStatus()), ...update, durationSeconds: Number(((Date.now() - started) / 1000).toFixed(2)) });
}

async function ensureBootstrap() {
  try { await lstat(currentLink); return; } catch {}
  const initial = path.join(releases, `initial-${Date.now()}`);
  await cp(seed, initial, { recursive: true, errorOnExist: true });
  const temporaryLink = path.join(root, `.current-${randomUUID()}`);
  await symlink(path.relative(root, initial), temporaryLink, process.platform === "win32" ? "junction" : "dir");
  await rename(temporaryLink, currentLink);
}

async function activateLink(nextLink) {
  if (process.platform !== "win32") {
    // POSIX rename replaces the old symlink atomically.
    await rename(nextLink, currentLink);
    return;
  }
  // Windows junctions cannot be replaced by rename. This branch exists only
  // for local test coverage; production Ubuntu always uses the atomic path.
  const previousLink = path.join(root, `.previous-${randomUUID()}`);
  await rename(currentLink, previousLink);
  try { await rename(nextLink, currentLink); } catch (error) { await rename(previousLink, currentLink); throw error; }
  await rm(previousLink, { recursive: true, force: true });
}

async function fetchSource(key, url) {
  let raw;
  if (fixtureDir) {
    const fixtureName = key === "spillsMirror" ? "spillsPrimary.json" : `${key}.json`;
    raw = await readFile(path.join(fixtureDir, fixtureName), "utf8");
  } else {
    const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "SpillFlare-Oracle-Refresh/1.0" }, signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    raw = await response.text();
  }
  return JSON.parse(raw);
}

function validate(key, value, oldCount) {
  const expectedArray = !key.startsWith("geo");
  if (expectedArray ? !Array.isArray(value) : !Array.isArray(value?.features)) throw new Error("unexpected JSON structure");
  const nextCount = count(value);
  if (nextCount === 0) throw new Error("unexpected empty dataset");
  if (oldCount >= 100 && nextCount < Math.floor(oldCount * 0.7)) throw new Error(`drastic count decrease (${oldCount} to ${nextCount})`);
  if (key.startsWith("spills")) {
    const withIds = value.filter((row) => row && String(row.id ?? "").trim()).length;
    if (withIds < Math.floor(nextCount * 0.95)) throw new Error("too many spill records without identifiers");
  }
}

function rowDelta(oldRows, newRows) {
  const oldMap = new Map(oldRows.map((row) => [String(row.id), digest(row)]));
  const newMap = new Map(newRows.map((row) => [String(row.id), digest(row)]));
  return {
    added: [...newMap.keys()].filter((id) => !oldMap.has(id)),
    changed: [...newMap.keys()].filter((id) => oldMap.has(id) && oldMap.get(id) !== newMap.get(id)),
    removed: [...oldMap.keys()].filter((id) => !newMap.has(id)),
  };
}

async function synchronizeApplication() {
  if (skipHooks) return { pm2Reload: false, revalidated: false, indexNow: false };
  await exec("pm2", ["reload", "spillflare", "--update-env"], { cwd: process.cwd() });
  let healthy = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try { const response = await fetch("http://127.0.0.1:3000/", { signal: AbortSignal.timeout(3_000) }); if (response.ok) { healthy = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!healthy) throw new Error("PM2 reloaded but the local health check failed");
  const token = process.env.SPILLFLARE_REVALIDATE_TOKEN;
  if (!token) throw new Error("SPILLFLARE_REVALIDATE_TOKEN is not configured");
  const revalidated = await fetch("http://127.0.0.1:3000/api/internal/revalidate-data", { method: "POST", headers: { "x-spillflare-revalidate-token": token }, signal: AbortSignal.timeout(10_000) });
  if (!revalidated.ok) throw new Error(`route-cache invalidation failed with HTTP ${revalidated.status}`);
  let indexNow = false;
  try {
    await exec(process.execPath, [path.join(process.cwd(), "scripts", "submit-indexnow.mjs")], { cwd: process.cwd(), env: { ...process.env, INDEXNOW_MANIFEST: path.join(root, "indexnow-changes.json") } });
    indexNow = true;
  } catch {}
  return { pm2Reload: true, revalidated: true, indexNow };
}

async function pruneReleases(keep = 12) {
  const active = path.basename(await readlink(currentLink));
  const names = (await readdir(releases)).filter((name) => !name.startsWith(".staging-")).sort().reverse();
  const retained = new Set([active, ...names.slice(0, keep)]);
  const removable = names.filter((name) => !retained.has(name));
  await Promise.all(removable.map((name) => rm(path.join(releases, name), { recursive: true, force: true })));
  return removable.length;
}

await mkdir(releases, { recursive: true, mode: 0o750 });
let lock;
try {
  lock = await open(lockFile, "wx", 0o600);
  await lock.writeFile(`${process.pid}\n`);
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  const lockAge = Date.now() - (await stat(lockFile)).mtimeMs;
  if (lockAge > 10 * 60_000) {
    await unlink(lockFile);
    lock = await open(lockFile, "wx", 0o600);
    await lock.writeFile(`${process.pid}\n`);
  } else {
    console.log("LOCKED refresh_already_running=true");
    process.exit(0);
  }
}

let staging;
try {
  await ensureBootstrap();
  const previousDirectory = await readlink(currentLink).then((target) => path.resolve(root, target));
  const previousMetadata = JSON.parse(await readFile(path.join(previousDirectory, "metadata.json"), "utf8"));
  const previousSpills = JSON.parse(await readFile(path.join(previousDirectory, "spillsPrimary.json"), "utf8"));
  const previousHashes = new Map();
  for (const key of Object.keys(sources)) {
    const file = outputName(key);
    if (file) previousHashes.set(key, digest(JSON.parse(await readFile(path.join(previousDirectory, file), "utf8"))));
  }
  const checkedAt = new Date().toISOString();
  const results = await Promise.allSettled(Object.entries(sources).map(async ([key, url]) => ({ key, url, value: await fetchSource(key, url) })));
  const accepted = new Map();
  const sourceStatus = {};
  const failures = [];
  for (let index = 0; index < results.length; index += 1) {
    const [key, url] = Object.entries(sources)[index];
    const result = results[index];
    try {
      if (result.status === "rejected") throw result.reason;
      const oldCount = previousMetadata.sources?.[key]?.count ?? 0;
      validate(key, result.value.value, oldCount);
      accepted.set(key, result.value.value);
      sourceStatus[key] = { url, status: "healthy", retrievedAt: checkedAt, checkedAt, sha256: digest(result.value.value), count: count(result.value.value), latestObservation: latestObservation(key, result.value.value) };
    } catch (error) {
      failures.push(`${key}: ${error.message}`);
      sourceStatus[key] = { ...previousMetadata.sources?.[key], url, status: "degraded", checkedAt, error: error.message, servingLastSuccessfulSnapshot: true };
    }
  }
  if (accepted.has("spillsPrimary") && accepted.has("spillsMirror") && digest(accepted.get("spillsPrimary")) !== digest(accepted.get("spillsMirror"))) {
    failures.push("spillsMirror: fingerprint differs from primary");
    accepted.delete("spillsMirror");
    sourceStatus.spillsMirror = { ...previousMetadata.sources.spillsMirror, status: "degraded", checkedAt, error: "fingerprint differs from primary", servingLastSuccessfulSnapshot: true };
  }
  const changedKeys = [...accepted.keys()].filter((key) => outputName(key) && sourceStatus[key].sha256 !== previousHashes.get(key));
  const status = await priorStatus();
  if (!changedKeys.length) {
    const hooks = status.applicationSynchronized === false ? await synchronizeApplication() : { pm2Reload: false, revalidated: false, indexNow: false };
    await setStatus({ lastCheckAt: checkedAt, lastResult: failures.length ? "NO_CHANGE_WITH_DEGRADED_SOURCES" : "NO_CHANGE", failures, sources: sourceStatus, applicationSynchronized: true, ...hooks });
    console.log(`${failures.length ? "NO_CHANGE_WITH_DEGRADED_SOURCES" : "NO_CHANGE"} sources_healthy=${accepted.size}/${Object.keys(sources).length} sources_degraded=${failures.length} spill_records=${previousSpills.length} pm2_reload=${hooks.pm2Reload} duration_seconds=${((Date.now() - started) / 1000).toFixed(2)}`);
    await lock.close();
    lock = undefined;
    await unlink(lockFile).catch(() => {});
    process.exit(0);
  }

  const releaseId = `${checkedAt.replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  staging = path.join(releases, `.staging-${releaseId}`);
  await cp(previousDirectory, staging, { recursive: true });
  for (const key of changedKeys) await atomicJson(path.join(staging, outputName(key)), accepted.get(key));
  const nextSpills = accepted.get("spillsPrimary") ?? previousSpills;
  const delta = rowDelta(previousSpills, nextSpills);
  const metadata = { retrievedAt: checkedAt, sources: sourceStatus, spillMirrorAgreement: sourceStatus.spillsPrimary?.sha256 === sourceStatus.spillsMirror?.sha256 };
  await atomicJson(path.join(staging, "metadata.json"), metadata);
  const release = path.join(releases, releaseId);
  await rename(staging, release);
  staging = undefined;
  const nextLink = path.join(root, `.current-${randomUUID()}`);
  await symlink(path.relative(root, release), nextLink, process.platform === "win32" ? "junction" : "dir");
  await activateLink(nextLink);
  const changedPaths = [...delta.added, ...delta.changed, ...delta.removed].map((id) => `/oil-spills/${id}`);
  const sitemapYears = [...new Set([...delta.added, ...delta.changed].map((id) => nextSpills.find((row) => String(row.id) === id)?.incidentdate?.slice(0, 4)).filter(Boolean))];
  const hubs = ["/", "/explore", "/oil-spills", "/oil-spills/archive", "/oil-spills/analytics", "/oil-spills/causes", "/oil-spills/niger-delta", "/gas-flares", "/gas-flares/companies", "/places", "/sitemap.xml", ...sitemapYears.map((year) => `/sitemaps/incidents-${year}.xml`)];
  await atomicJson(path.join(root, "indexnow-changes.json"), { generatedAt: checkedAt, paths: [...new Set(changedPaths.concat(hubs))] });
  await setStatus({ lastCheckAt: checkedAt, lastSuccessfulRefresh: checkedAt, lastResult: "DATA_PROMOTED", changedSources: changedKeys, failures, sources: sourceStatus, oldSpillCount: previousSpills.length, newSpillCount: nextSpills.length, added: delta.added.length, changed: delta.changed.length, removed: delta.removed.length, currentRelease: releaseId, applicationSynchronized: false });
  const hooks = await synchronizeApplication();
  const releasesPruned = await pruneReleases();
  await setStatus({ lastResult: "DATA_UPDATED", applicationSynchronized: true, releasesPruned, ...hooks });
  console.log(`DATA_UPDATED sources_healthy=${accepted.size}/${Object.keys(sources).length} sources_degraded=${failures.length} old_records=${previousSpills.length} new_records=${nextSpills.length} added=${delta.added.length} changed=${delta.changed.length} removed=${delta.removed.length} pm2_reload=${hooks.pm2Reload} indexnow=${hooks.indexNow} releases_pruned=${releasesPruned} duration_seconds=${((Date.now() - started) / 1000).toFixed(2)}`);
} catch (error) {
  await setStatus({ lastCheckAt: new Date().toISOString(), lastResult: "FAILED", applicationSynchronized: false, error: error.message });
  console.error(`REFRESH_FAILED reason=${JSON.stringify(error.message)}`);
  process.exitCode = 1;
} finally {
  if (staging) await rm(staging, { recursive: true, force: true });
  await lock?.close();
  await unlink(lockFile).catch(() => {});
}
