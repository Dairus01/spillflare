import { afterAll, describe, expect, it } from "vitest";
import { cp, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";

const exec = promisify(execFile);
const temporaryRoots: string[] = [];
const script = path.join(process.cwd(), "scripts", "refresh-production-data.mjs");

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "spillflare-refresh-"));
  const source = path.join(root, "fixtures");
  await cp(path.join(process.cwd(), "data", "snapshots"), source, { recursive: true });
  temporaryRoots.push(root);
  return { root: path.join(root, "runtime"), source };
}

async function run(root: string, source: string) {
  return exec(process.execPath, [script], {
    cwd: process.cwd(),
    env: { ...process.env, SPILLFLARE_DATA_DIR: root, SPILLFLARE_SOURCE_FIXTURE_DIR: source, SPILLFLARE_SKIP_RELOAD: "1" },
    timeout: 120_000,
  });
}

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

afterAll(async () => Promise.all(temporaryRoots.map((root) => rm(root, { recursive: true, force: true }))));

describe("production snapshot refresh", () => {
  it("skips an overlapping refresh", async () => {
    const { root, source } = await fixture();
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, "refresh.lock"), "active\n");
    const result = await run(root, source);
    expect(result.stdout).toContain("LOCKED refresh_already_running=true");
  });

  it("advances live retrieval metadata without promoting or reloading unchanged data", async () => {
    const { root, source } = await fixture();
    await run(root, source);
    const initialTarget = await readlink(path.join(root, "current"));
    const initialRows = JSON.parse(await readFile(path.resolve(root, initialTarget, "spillsPrimary.json"), "utf8"));
    const initialRuntime = JSON.parse(await readFile(path.join(root, "runtime-metadata.json"), "utf8"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    const result = await run(root, source);
    const nextRuntime = JSON.parse(await readFile(path.join(root, "runtime-metadata.json"), "utf8"));
    const status = JSON.parse(await readFile(path.join(root, "status.json"), "utf8"));
    expect(result.stdout).toContain("NO_CHANGE");
    expect(result.stdout).toContain("content_hash_same=true");
    expect(result.stdout).toContain("pm2_reload=false");
    expect(await readlink(path.join(root, "current"))).toBe(initialTarget);
    expect(hash(JSON.parse(await readFile(path.resolve(root, initialTarget, "spillsPrimary.json"), "utf8")))).toBe(hash(initialRows));
    expect(new Date(nextRuntime.retrievedAt).getTime()).toBeGreaterThan(new Date(initialRuntime.retrievedAt).getTime());
    expect(nextRuntime.sources.spillsPrimary.latestObservation).toBe(initialRuntime.sources.spillsPrimary.latestObservation);
    expect(status.pm2ReloadRequested).toBe(false);
    expect(status.revalidationRequested).toBe(true);
  }, 120_000);

  it("atomically promotes a valid delta and preserves it after a failed fetch", async () => {
    const { root, source } = await fixture();
    await run(root, source);
    const fixtureFile = path.join(source, "spillsPrimary.json");
    const rows = JSON.parse(await readFile(fixtureFile, "utf8"));
    rows.push({ ...rows[0], id: "refresh-test-real-shape", incidentnumber: "REFRESH-TEST" });
    await writeFile(fixtureFile, JSON.stringify(rows));
    const changed = await run(root, source);
    expect(changed.stdout).toContain("DATA_UPDATED");
    expect(changed.stdout).toContain("added=1");
    const promotedTarget = await readlink(path.join(root, "current"));
    const promoted = JSON.parse(await readFile(path.resolve(root, promotedTarget, "spillsPrimary.json"), "utf8"));
    expect(promoted.some((row: { id: string }) => row.id === "refresh-test-real-shape")).toBe(true);
    const runtimeMetadata = JSON.parse(await readFile(path.join(root, "runtime-metadata.json"), "utf8"));
    const changedStatus = JSON.parse(await readFile(path.join(root, "status.json"), "utf8"));
    expect(runtimeMetadata.retrievedAt).toBe(runtimeMetadata.lastDataChangeAt);
    expect(runtimeMetadata.contentHash).toBeTruthy();
    expect(changedStatus.pm2ReloadRequested).toBe(true);
    expect(changedStatus.revalidationRequested).toBe(true);

    await writeFile(fixtureFile, "not-json");
    const failed = await run(root, source);
    expect(failed.stdout).toContain("NO_CHANGE_WITH_DEGRADED_SOURCES");
    expect(await readlink(path.join(root, "current"))).toBe(promotedTarget);
  }, 120_000);
});
