import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  FeatureCollection,
  FlareRow,
  SourceMetadata,
  SpillRow,
} from "@/types/domain";
import { numberOrNull, spillPath } from "@/lib/format";
import { parseW3cDate, trustedIncidentLastModified } from "@/lib/sitemap-date";

const snapshotDirectory = join(process.cwd(), "data", "snapshots");
const snapshotCache = new Map<string, Promise<unknown>>();

// Production snapshots are checked in and only change with a deployment. Keep
// each parsed file in memory so requests do not repeatedly read and parse the
// 15 MB spill dataset and related JSON files.
async function readSnapshot<T>(name: string): Promise<T> {
  let snapshot = snapshotCache.get(name);
  if (!snapshot) {
    snapshot = readFile(join(snapshotDirectory, `${name}.json`), "utf8").then(
      (contents) => JSON.parse(contents) as T,
    );
    snapshotCache.set(name, snapshot);
  }
  return snapshot as Promise<T>;
}

export const getMetadata = () => readSnapshot<SourceMetadata>("metadata");
export const getSpills = () => readSnapshot<SpillRow[]>("spillsPrimary");
export const getFlareRows = (
  area: "state" | "lga" | "cluster" | "block" | "company" | "onshore_offshore",
) =>
  readSnapshot<FlareRow[]>(
    `flare${area === "lga" ? "Lga" : area === "onshore_offshore" ? "OnshoreOffshore" : `${area[0].toUpperCase()}${area.slice(1)}`}`,
  );
export const getGeo = (
  area:
    | "states"
    | "lgas"
    | "blocks"
    | "clusters"
    | "onshore_offshore"
    | "locations"
    | "population"
    | "oilfields",
) =>
  readSnapshot<FeatureCollection>(
    `geo${area === "lgas" ? "Lgas" : area === "onshore_offshore" ? "OnshoreOffshore" : `${area[0].toUpperCase()}${area.slice(1)}`}`,
  );

export async function getLatestSpills(limit = 8) {
  const [spills, metadata] = await Promise.all([getSpills(), getMetadata()]);
  const retrievedAt = parseW3cDate(metadata.retrievedAt);
  return spills
    .map((row) => ({ row, date: trustedIncidentLastModified(row, retrievedAt) }))
    .filter((item): item is { row: SpillRow; date: Date } => Boolean(item.date))
    .sort((a, b) => b.date.getTime() - a.date.getTime() || String(a.row.id).localeCompare(String(b.row.id)))
    .map(({ row }) => row)
    .slice(0, limit);
}

export async function findSpill(id: string) {
  return (
    (await getSpills()).find(
      (row) => row.id === id || row.incidentnumber === id,
    ) ?? null
  );
}

export async function flarePeriod(
  area: Parameters<typeof getFlareRows>[0],
  period = "2026-05",
) {
  return (await getFlareRows(area))
    .filter((row) => row.month === period && numberOrNull(row.mscf) !== null)
    .sort((a, b) => (numberOrNull(b.mscf) ?? 0) - (numberOrNull(a.mscf) ?? 0));
}

export async function flareSeries(
  area: Parameters<typeof getFlareRows>[0],
  name: string,
) {
  return (await getFlareRows(area))
    .filter(
      (row) =>
        row.name.toLowerCase() === name.toLowerCase() &&
        row.month &&
        numberOrNull(row.mscf) !== null,
    )
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
}

export function spillCoordinates(row: SpillRow) {
  const lat = numberOrNull(row.latitude);
  const lng = numberOrNull(row.longitude);
  return lat !== null &&
    lng !== null &&
    lat >= -5 &&
    lat <= 16 &&
    lng >= -2 &&
    lng <= 16
    ? { lat, lng }
    : null;
}

export function parseAttachments(row: SpillRow) {
  if (!row.attachments) return [] as Array<{ url: string; caption: string }>;
  try {
    const parsed = JSON.parse(row.attachments);
    return Array.isArray(parsed) ? parsed.filter((item) => item?.url) : [];
  } catch {
    return [];
  }
}

export async function searchAll(query: string, limit = 30) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const [spills, state, lga, cluster, block, companies, oilfields] =
    await Promise.all([
      getSpills(),
      getFlareRows("state"),
      getFlareRows("lga"),
      getFlareRows("cluster"),
      getFlareRows("block"),
      getFlareRows("company"),
      getGeo("oilfields"),
    ]);
  const results: Array<{
    type: string;
    title: string;
    subtitle: string;
    href: string;
  }> = [];
  for (const row of spills) {
    if (
      [
        row.incidentnumber,
        row.company,
        row.sitelocationname,
        row.lga,
        row.statesaffected,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    )
      results.push({
        type: "Oil spill",
        title: `Incident ${row.incidentnumber ?? row.id}`,
        subtitle: row.sitelocationname ?? "Location not supplied",
        href: spillPath(row.id),
      });
    if (results.length >= limit) return results;
  }
  const groups = [
    ["State", state, "/places/states/"],
    ["LGA", lga, "/gas-flares?area=lga&name="],
    ["Flare cluster", cluster, "/gas-flares/clusters/"],
    ["Oil block", block, "/oil-blocks/"],
    ["Company", companies, "/gas-flares/companies?name="],
  ] as const;
  for (const [type, rows, prefix] of groups)
    for (const row of rows)
      if (
        row.name.toLowerCase().includes(needle) &&
        !results.some((item) => item.title === row.name && item.type === type)
      )
        results.push({
          type,
          title: row.name,
          subtitle: "Source-backed tracker record",
          href: `${prefix}${encodeURIComponent(row.name.toLowerCase().replace(/\s+/g, "-"))}`,
        });
  for (const feature of oilfields.features) {
    const name = String(feature.properties.name ?? "");
    if (name.toLowerCase().includes(needle))
      results.push({
        type: "Oilfield",
        title: name,
        subtitle: "Gas Flare Tracker geography",
        href: `/search?q=${encodeURIComponent(name)}`,
      });
  }
  return results.slice(0, limit);
}
