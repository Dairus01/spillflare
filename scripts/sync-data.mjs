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
try {
  previousMetadata = JSON.parse(await readFile(path.join(outputDirectory, "metadata.json"), "utf8"));
} catch {
  previousMetadata = {};
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

await writeFile(path.join(outputDirectory, "metadata.json"), JSON.stringify(metadata, null, 2));

const healthy = Object.values(metadata.sources).filter((item) => item.status === "healthy").length;
console.log(`Saved ${healthy}/${entries.length} source snapshots to ${outputDirectory}`);
console.log(`Spill mirrors agree: ${metadata.spillMirrorAgreement ?? "not checked"}`);
console.log(`Refresh completed at ${retrievedAt}`);
