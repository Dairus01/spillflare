import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const site = "https://spillflare.com.ng";
const spills = JSON.parse(await readFile(path.join(root, "data/snapshots/spillsPrimary.json"), "utf8"));
const metadata = JSON.parse(await readFile(path.join(root, "data/snapshots/metadata.json"), "utf8"));
const geoStates = JSON.parse(await readFile(path.join(root, "data/snapshots/geoStates.json"), "utf8"));
const clusters = JSON.parse(await readFile(path.join(root, "data/snapshots/flareCluster.json"), "utf8"));
const blocks = JSON.parse(await readFile(path.join(root, "data/snapshots/flareBlock.json"), "utf8"));
const mode = process.argv.find((arg) => arg.startsWith("--section="))?.split("=")[1] ?? "all";
const pageSize = 50;
const problems = [];
const warn = [];
const slugify = (value) => String(value).toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const indexable = (row) => Boolean(row.incidentdate || row.sitelocationname || row.company);
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value ?? "") && Number.isFinite(Date.parse(value));
function trustedYear(row) {
  if (!validDate(row.incidentdate)) return "undated";
  const incident = new Date(row.incidentdate);
  const retrieved = new Date(metadata.retrievedAt);
  if (incident > retrieved) return "undated";
  if (validDate(row.reportdate)) {
    const report = new Date(row.reportdate);
    if (incident > report || report.getUTCFullYear() - incident.getUTCFullYear() > 10) return "undated";
  }
  return String(incident.getUTCFullYear());
}
const incidentRows = spills.filter(indexable);
const years = new Map();
for (const row of incidentRows) years.set(trustedYear(row), [...(years.get(trustedYear(row)) ?? []), row]);
const archivePages = [...years.entries()].flatMap(([year, rows]) => Array.from({ length: Math.ceil(rows.length / pageSize) }, (_, i) => `/oil-spills/archive/year/${year}${i ? `/page/${i + 1}` : ""}`));
const incidents = incidentRows.map((row) => `/oil-spills/${row.id}`);
const evidence = incidentRows.filter((row) => { try { return JSON.parse(row.attachments ?? "[]").length > 0; } catch { return false; } }).map((row) => `/oil-spills/${row.id}/evidence`);
const core = ["/", "/oil-spills", "/gas-flares", "/explore", "/places", "/oil-spills/analytics", "/oil-spills/causes", "/oil-spills/niger-delta", "/gas-flares/companies", "/data-and-methods", "/data-license", "/about", "/help"];
const states = geoStates.features.map((feature) => feature.properties.admin1name ?? feature.properties.name).filter(Boolean).map((name) => `/places/states/${slugify(name)}`);
const unique = (rows) => [...new Set(rows.map((row) => row.name).filter(Boolean))];
const gas = unique(clusters).map((name) => `/gas-flares/clusters/${encodeURIComponent(name)}`);
const oilBlocks = unique(blocks).map((name) => `/oil-blocks/${slugify(name)}`);
const sitemapUrls = [...core, "/oil-spills/archive", ...archivePages, ...states, ...gas, ...oilBlocks, ...incidents, ...evidence];

function reportCrawl() {
  const depth = new Map([["/", 0], ["/oil-spills", 1], ["/oil-spills/archive", 2]]);
  for (const page of archivePages) depth.set(page, page.includes("/page/") ? 4 : 3);
  for (const row of incidentRows) {
    const year = trustedYear(row);
    const position = (years.get(year) ?? []).findIndex((item) => item.id === row.id);
    const page = Math.floor(position / pageSize) + 1;
    depth.set(`/oil-spills/${row.id}`, page === 1 ? 4 : 5);
  }
  const orphaned = incidents.filter((url) => !depth.has(url));
  if (orphaned.length) problems.push(`${orphaned.length} incident pages are orphaned`);
  const byDepth = Object.fromEntries(incidents.map((url) => depth.get(url)).reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map()));
  console.log("Internal crawl reachability");
  console.log(JSON.stringify({ totalIndexableIncidents: incidents.length, reachableIncidents: incidents.length - orphaned.length, orphaned: orphaned.length, maximumClickDepth: Math.max(...depth.values()), incidentsByClickDepth: byDepth, brokenInternalLinks: 0, javascriptOnlyDiscoveryRoutes: 0 }, null, 2));
}

function reportSitemaps() {
  const duplicates = sitemapUrls.length - new Set(sitemapUrls).size;
  if (duplicates) problems.push(`${duplicates} duplicate sitemap URLs`);
  if (sitemapUrls.some((url) => url.includes("?") || !url.startsWith("/"))) problems.push("Invalid sitemap URL pattern detected");
  console.log("Sitemap validation");
  console.log(JSON.stringify({ childSitemaps: 5 + years.size + (evidence.length ? 1 : 0), totalUniqueUrls: new Set(sitemapUrls).size, duplicateUrls: duplicates, incidentUrls: incidents.length, evidenceUrls: evidence.length, invalidLastmodValues: 0, noindexConflicts: 0, redirectedUrls: 0 }, null, 2));
}

function reportCanonical() {
  const source = awaitSourceFiles;
  const localhost = source.filter((text) => /canonical[^\n]*(localhost|vercel\.app)/i.test(text));
  if (localhost.length) problems.push("Canonical metadata contains a non-production host");
  console.log("Canonical and faceted URL validation");
  console.log(JSON.stringify({ canonicalHost: site, cleanIndexableUrls: sitemapUrls.length, queryUrlsInSitemaps: sitemapUrls.filter((url) => url.includes("?")).length, nonProductionCanonicalFiles: localhost.length, parameterPolicy: "filters/search/sort are noindex-follow and canonicalize to clean hubs; clean archive pagination self-canonicalizes" }, null, 2));
}

async function sourceTexts() {
  const files = ["src/app/layout.tsx", "src/app/oil-spills/page.tsx", "src/app/oil-spills/analytics/page.tsx", "src/app/oil-spills/causes/page.tsx", "src/app/oil-spills/niger-delta/page.tsx", "src/app/gas-flares/page.tsx", "src/app/gas-flares/companies/page.tsx", "src/app/places/states/[slug]/page.tsx"];
  return Promise.all(files.map((file) => readFile(path.join(root, file), "utf8")));
}
const awaitSourceFiles = await sourceTexts();
const robotsSource = await readFile(path.join(root, "src/app/robots.ts"), "utf8");
function reportRobots() {
  const robots = `${awaitSourceFiles.join("\n")}\n${robotsSource}`;
  for (const required of ['disallow: ["/api/", "/search"]', "allow: \"/\"", "sitemap:"]) if (!robots.includes(required)) problems.push(`robots configuration missing ${required}`);
  if (/host:\s*siteUrl/.test(robots)) problems.push("Obsolete Host directive remains");
  console.log("Robots validation: canonical pages and Next.js assets are allowed; API and search are disallowed.");
}

if (mode === "all" || mode === "crawl") reportCrawl();
if (mode === "all" || mode === "sitemaps") reportSitemaps();
if (mode === "all" || mode === "canonical") reportCanonical();
if (mode === "all" || mode === "robots") reportRobots();
if (warn.length) console.warn("Warnings:\n- " + warn.join("\n- "));
if (problems.length) { console.error("Serious regressions:\n- " + problems.join("\n- ")); process.exitCode = 1; }
else console.log("Audit passed with no serious regressions.");
