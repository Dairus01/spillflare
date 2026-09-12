import { getFlareRows, getGeo, getMetadata, getSpills, parseAttachments } from "@/lib/data";
import { archiveGroups, archivePageCount, archiveYearPath } from "@/lib/crawl-archive";
import { slugify, spillPath } from "@/lib/format";
import { isIndexableSpill } from "@/lib/seo";
import { parseW3cDate } from "@/lib/sitemap-date";
import { siteUrl } from "@/lib/site";

export type SitemapEntry = { url: string; lastmod?: Date };
export type SitemapGroup = { name: string; entries: SitemapEntry[] };

const absolute = (path: string) => `${siteUrl}${path}`;
const entry = (path: string, lastmod?: Date): SitemapEntry => ({ url: absolute(path), lastmod });

/**
 * lastmod policy:
 * - Incident and evidence pages omit lastmod: an incident date is not a page-change date.
 * - Collection pages use the validated snapshot retrieval time because their rendered
 *   counts/listings change when that deployed snapshot changes.
 * - Editorial/static pages omit lastmod because the repository has no per-page edit date.
 */
async function createSitemapGroups(): Promise<SitemapGroup[]> {
  const [metadata, spills, states, clusters, blocks] = await Promise.all([
    getMetadata(), getSpills(), getGeo("states"), getFlareRows("cluster"), getFlareRows("block"),
  ]);
  const snapshotChanged = parseW3cDate(metadata.retrievedAt);
  const groups = archiveGroups(spills, snapshotChanged);
  const uniqueNames = (rows: Array<{ name: string }>) => [...new Set(rows.map((row) => row.name).filter(Boolean))];

  const corePaths = ["", "/oil-spills", "/gas-flares", "/explore", "/places", "/oil-spills/analytics", "/oil-spills/causes", "/oil-spills/niger-delta", "/gas-flares/companies", "/data-and-methods", "/data-license", "/about", "/help"];
  const archiveEntries = [entry("/oil-spills/archive", snapshotChanged)];
  for (const [year, rows] of groups) {
    for (let page = 1; page <= archivePageCount(rows); page += 1) archiveEntries.push(entry(archiveYearPath(year, page), snapshotChanged));
  }

  const result: SitemapGroup[] = [
    { name: "core", entries: corePaths.map((path) => entry(path, path === "" || path.includes("oil-spills") || path.includes("gas-flares") || path === "/explore" || path === "/places" ? snapshotChanged : undefined)) },
    { name: "archive", entries: archiveEntries },
    { name: "states", entries: states.features.map((feature) => String(feature.properties.admin1name ?? feature.properties.name ?? "")).filter(Boolean).map((name) => entry(`/places/states/${slugify(name)}`, snapshotChanged)) },
    { name: "gas-flares", entries: uniqueNames(clusters).map((name) => entry(`/gas-flares/clusters/${encodeURIComponent(name)}`, snapshotChanged)) },
    { name: "oil-blocks", entries: uniqueNames(blocks).map((name) => entry(`/oil-blocks/${slugify(name)}`, snapshotChanged)) },
  ];

  for (const [year, rows] of groups) {
    result.push({ name: `incidents-${year}`, entries: rows.map((row) => entry(spillPath(row.id))) });
  }
  const evidence = spills.filter(isIndexableSpill).filter((row) => parseAttachments(row).length > 0).map((row) => entry(`${spillPath(row.id)}/evidence`));
  if (evidence.length) result.push({ name: "evidence", entries: evidence });
  return result.filter((group) => group.entries.length > 0);
}

let sitemapCache: { expires: number; value: Promise<SitemapGroup[]> } | undefined;

export function buildSitemapGroups(): Promise<SitemapGroup[]> {
  // Every child sitemap shares the same 21k-record membership calculation.
  // Keep it once per process/TTL rather than repeating parsing/grouping per file.
  if (!sitemapCache || sitemapCache.expires <= Date.now()) {
    sitemapCache = { expires: Date.now() + 300_000, value: createSitemapGroups() };
  }
  return sitemapCache.value;
}

export function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function sitemapXml(entries: SitemapEntry[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(({ url, lastmod }) => `  <url><loc>${escapeXml(url)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>\n`;
}

export function sitemapIndexXml(groups: SitemapGroup[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${groups.map(({ name }) => `  <sitemap><loc>${escapeXml(absolute(`/sitemaps/${name}.xml`))}</loc></sitemap>`).join("\n")}\n</sitemapindex>\n`;
}
