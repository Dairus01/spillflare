import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.join(process.cwd(), "data", "snapshots");

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

function hash(raw) {
  return createHash("sha256").update(raw).digest("hex");
}

function countRecords(value) {
  if (Array.isArray(value)) return value.length;
  if (value && Array.isArray(value.features)) return value.features.length;
  return 0;
}

function latestObservation(key, value) {
  if (!Array.isArray(value)) return null;
  const field = key.startsWith("spills") ? "incidentdate" : "month";
  return value
    .map((row) => (typeof row?.[field] === "string" ? row[field] : ""))
    .filter((item) => /^\d{4}-\d{2}(?:-\d{2})?$/.test(item))
    .sort()
    .at(-1) ?? null;
}

async function fetchSource([key, url]) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "Nigeria-Environmental-Watch/0.1" },
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const raw = await response.text();
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) && !Array.isArray(parsed?.features)) {
    throw new Error("Unexpected response structure");
  }
  return {
    key,
    url,
    raw,
    parsed,
    sha256: hash(raw),
    count: countRecords(parsed),
    latestObservation: latestObservation(key, parsed),
  };
}

await mkdir(outputDirectory, { recursive: true });

let previousMetadata = {};
let previousSpills = [];
try {
  previousMetadata = JSON.parse(await readFile(path.join(outputDirectory, "metadata.json"), "utf8"));
} catch {
  previousMetadata = {};
}
try {
  previousSpills = JSON.parse(await readFile(path.join(outputDirectory, "spillsPrimary.json"), "utf8"));
} catch {
  previousSpills = [];
}

const retrievedAt = new Date().toISOString();
const entries = Object.entries(sources);
console.log(`Refreshing ${entries.length} live data sources at ${retrievedAt}...`);
const settled = await Promise.allSettled(entries.map(fetchSource));
const metadata = { retrievedAt, sources: {} };

for (let index = 0; index < settled.length; index += 1) {
  const [key, url] = entries[index];
  const result = settled[index];
  if (result.status === "fulfilled") {
    const item = result.value;
    // OS-2 is a fingerprinted mirror, not a second public dataset.
    if (key !== "spillsMirror") {
      await writeFile(path.join(outputDirectory, `${key}.json`), JSON.stringify(item.parsed));
    }
    metadata.sources[key] = {
      url,
      status: "healthy",
      retrievedAt,
      sha256: item.sha256,
      count: item.count,
      latestObservation: item.latestObservation,
    };
  } else {
    metadata.sources[key] = {
      ...(previousMetadata.sources?.[key] ?? {}),
      url,
      status: "degraded",
      failedAt: retrievedAt,
      error: String(result.reason?.message ?? result.reason),
      servingLastSuccessfulSnapshot: true,
    };
  }
}

const primary = metadata.sources.spillsPrimary;
const mirror = metadata.sources.spillsMirror;
metadata.spillMirrorAgreement =
  primary?.status === "healthy" && mirror?.status === "healthy"
    ? primary.sha256 === mirror.sha256
    : null;

// Create an untracked URL delta so IndexNow receives only changed records and
// affected hubs instead of the complete historical archive every ten minutes.
const primaryIndex = entries.findIndex(([key]) => key === "spillsPrimary");
const refreshedSpills = settled[primaryIndex];
const nextSpills = refreshedSpills?.status === "fulfilled" ? refreshedSpills.value.parsed : previousSpills;
const oldById = new Map(previousSpills.map((row) => [String(row.id), JSON.stringify(row)]));
const newById = new Map(nextSpills.map((row) => [String(row.id), JSON.stringify(row)]));
const added = [...newById.keys()].filter((id) => !oldById.has(id));
const changed = [...newById.keys()].filter((id) => oldById.has(id) && oldById.get(id) !== newById.get(id));
const deleted = [...oldById.keys()].filter((id) => !newById.has(id));
const anySourceChanged = Object.entries(metadata.sources).some(([key, value]) => value.sha256 && value.sha256 !== previousMetadata.sources?.[key]?.sha256);
const hubPaths = anySourceChanged ? ["/", "/explore", "/oil-spills", "/oil-spills/archive", "/oil-spills/analytics", "/oil-spills/causes", "/oil-spills/niger-delta", "/gas-flares", "/gas-flares/companies", "/places", "/sitemap.xml"] : [];
await writeFile(path.join(process.cwd(), "data", ".indexnow-changes.json"), JSON.stringify({ generatedAt: retrievedAt, paths: [...new Set([...added, ...changed, ...deleted].map((id) => `/oil-spills/${id}`).concat(hubPaths))] }, null, 2));

await writeFile(path.join(outputDirectory, "metadata.json"), JSON.stringify(metadata, null, 2));

const healthy = Object.values(metadata.sources).filter((item) => item.status === "healthy").length;
console.log(`Saved ${healthy}/${entries.length} source snapshots to ${outputDirectory}`);
console.log(`Spill mirrors agree: ${metadata.spillMirrorAgreement ?? "not checked"}`);
console.log(`Refresh completed at ${retrievedAt}`);
console.log(`IndexNow delta: ${added.length} added, ${changed.length} changed, ${deleted.length} deleted incident URLs.`);
