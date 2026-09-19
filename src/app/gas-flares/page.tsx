import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Building2, Flame, Search } from "lucide-react";
import { ExportLink } from "@/components/export-link";
import { FlareTrend } from "@/components/flare-chart";
import { NigeriaMap } from "@/components/map";
import { DataNote, Metric, SourceRail } from "@/components/ui";
import { getFlareRows, getMetadata } from "@/lib/data";
import { formatDate, formatNumber, formatVolume, numberOrNull, slugify, titleCase } from "@/lib/format";
import { datasetLicense, siteUrl } from "@/lib/site";
import type { MapPoint } from "@/types/domain";

const title = "Gas Flaring in Nigeria: Tracker, Map & Data | SpillFlare";
const openGraphTitle = "Gas Flaring in Nigeria: Tracker, Map & Data";
const description = "Explore gas flaring in Nigeria using monthly estimates by state, LGA, cluster and oil block, with interactive maps, trends and downloadable data.";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const params = await searchParams;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/gas-flares" },
    robots: Object.keys(params).length ? { index: false, follow: true } : undefined,
    openGraph: {
      title: openGraphTitle,
      description,
      url: "/gas-flares",
    },
    twitter: { card: "summary", title: openGraphTitle, description },
  };
}
const validAreas = ["state", "lga", "cluster", "block", "onshore_offshore"] as const;
const areaOptions: Record<typeof validAreas[number], string> = {
  state: "Gas flaring by state",
  lga: "Gas flaring by LGA",
  cluster: "Gas flaring by cluster",
  block: "Gas flaring by oil block",
  onshore_offshore: "Onshore/offshore gas flaring",
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GasFlaresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = firstValue(params.area) ?? "state";
  const area = validAreas.includes(requested as typeof validAreas[number])
    ? requested as typeof validAreas[number]
    : "state";
  const metadataKey = `flare${area === "lga" ? "Lga" : area === "onshore_offshore" ? "OnshoreOffshore" : area[0].toUpperCase() + area.slice(1)}`;
  const [allRows, metadata] = await Promise.all([
    getFlareRows(area),
    getMetadata(),
  ]);
  const periodRows = allRows.filter((row) => row.month && numberOrNull(row.mscf) !== null);
  const months = [...new Set(periodRows.map((row) => row.month as string))].sort();
  const latestPeriod = months.at(-1) ?? metadata.sources[metadataKey]?.latestObservation ?? "";
  const requestedPeriod = firstValue(params.period);
  const period = requestedPeriod && months.includes(requestedPeriod) ? requestedPeriod : latestPeriod;
  const rows = periodRows
    .filter((row) => row.month === period)
    .sort((a, b) => (numberOrNull(b.mscf) ?? 0) - (numberOrNull(a.mscf) ?? 0));
  const queryValue = firstValue(params.q) ?? "";
  const query = queryValue.toLowerCase();
  const requestedPage = Number(firstValue(params.page) ?? "1");
  const filtered = rows.filter((row) => !query || row.name.toLowerCase().includes(query));
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Number.isInteger(requestedPage)
    ? Math.min(Math.max(requestedPage, 1), pageCount)
    : 1;
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const pageHref = (nextPage: number) => {
    const nextParams = new URLSearchParams({ area, period });
    if (query) nextParams.set("q", query);
    nextParams.set("page", String(nextPage));
    return `/gas-flares?${nextParams.toString()}`;
  };
  const points: MapPoint[] = filtered.flatMap((row) => {
    const lat = numberOrNull(row.y);
    const lng = numberOrNull(row.x);
    return lat !== null && lng !== null
      ? [{
          id: `${area}-${row.name}`,
          lat,
          lng,
          title: row.name,
          subtitle: `${formatVolume(row.mscf)} · ${period}`,
          kind: "flare" as const,
          href: area === "cluster"
            ? `/gas-flares/clusters/${row.name}`
            : area === "block"
              ? `/oil-blocks/${row.name.toLowerCase().replace(/\s+/g, "-")}`
              : area === "state"
                ? `/places/states/${slugify(row.name)}`
              : undefined,
        }]
      : [];
  });
  const monthTotals = new Map<string, number>();
  for (const row of periodRows) {
    monthTotals.set(row.month!, (monthTotals.get(row.month!) ?? 0) + (numberOrNull(row.mscf) ?? 0));
  }
  const trend = [...monthTotals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-18)
    .map(([month, value]) => ({ month: month.slice(2), value }));
  const total = filtered.reduce((sum, row) => sum + (numberOrNull(row.mscf) ?? 0), 0);
  const latestCoverage = metadata.sources[metadataKey]?.latestObservation ?? latestPeriod;
  const companyCoverage = metadata.sources.flareCompany?.latestObservation;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": `${siteUrl}/gas-flares#webpage`, url: `${siteUrl}/gas-flares`, name: title, description, isPartOf: { "@id": `${siteUrl}/#website` }, about: { "@type": "Thing", name: "Gas flaring in Nigeria" } },
      { "@type": "Dataset", "@id": `${siteUrl}/gas-flares#dataset`, name: "Nigeria Gas Flaring Dataset", description: "Monthly Nigeria Gas Flare Tracker estimates organised by state, LGA, flare cluster, oil block and onshore/offshore aggregation.", url: `${siteUrl}/gas-flares`, spatialCoverage: { "@type": "Place", name: "Nigeria" }, temporalCoverage: months.length ? `${months[0]}/${months.at(-1)}` : undefined, isBasedOn: metadata.sources[metadataKey]?.url, publisher: { "@id": `${siteUrl}/#organization` }, isAccessibleForFree: true, ...datasetLicense, dateModified: metadata.retrievedAt, variableMeasured: ["Monthly gas flare estimate", "Geographic aggregation", "Source area name"], distribution: { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${siteUrl}/api/export?dataset=flares` } },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: siteUrl }, { "@type": "ListItem", position: 2, name: "Gas Flaring in Nigeria", item: `${siteUrl}/gas-flares` }] },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Nigeria Gas Flare Tracker</span>
          <h1>Gas Flaring in Nigeria</h1>
          <p>Explore monthly gas flare estimates across Nigeria by state, LGA, flare cluster and oil block. Compare detected flaring within one geographic level at a time, inspect recent trends and export source-backed data with dates and limitations visible.</p>
          <div className="button-row">
            <Link className="button secondary" href="/gas-flares/companies"><Building2 size={17} />Historical gas flaring by company</Link>
          </div>
        </div>
      </section>
      <SourceRail label={`Gas Flare Tracker · ${titleCase(area)} aggregation`} observation={metadata.sources[metadataKey]?.latestObservation} retrieved={metadata.retrievedAt} />
      <div className="wide-container page-pad">
        <form className="filter-bar">
          <div className="filter-group">
            <label htmlFor="area">Geographic level</label>
            <select id="area" name="area" defaultValue={area}>{validAreas.map((item) => <option key={item} value={item}>{areaOptions[item]}</option>)}</select>
          </div>
          <div className="filter-group">
            <label htmlFor="period">Month</label>
            <input id="period" name="period" type="month" defaultValue={period} min={months[0]} max={latestPeriod} />
          </div>
          <div className="filter-group">
            <label htmlFor="flare-search">Find within results</label>
            <input id="flare-search" name="q" defaultValue={queryValue} placeholder="Name" />
          </div>
          <button className="button"><Search size={16} />Apply</button>
          <div className="filter-spacer" />
          <Link className="button ghost" href="/gas-flares/companies"><Building2 size={16} />Historical company flaring</Link>
          <ExportLink href={`/api/export?dataset=flares&area=${area}&period=${period}`} label="Export gas flare data as CSV" />
        </form>
        <DataNote>
          {filtered.length > 0
            ? <><strong>{formatNumber(filtered.length)} areas have a supplied detected-flaring value for {period}.</strong> Areas absent from a successfully retrieved period are described as “no flaring detected by the tracker for this period,” not as zero.</>
            : <><strong>No supplied tracker rows matched this selection.</strong> This does not prove that no oil or gas exists there.</>}
        </DataNote>
        <div className="metric-grid" style={{ margin: "18px 0" }}>
          <Metric label="Selected geography" value={titleCase(area)} detail="Not combined with other levels" />
          <Metric label="Areas with values" value={formatNumber(filtered.length)} detail={period} />
          <Metric label="Tracker volume" value={formatVolume(total)} detail="Sum of visible rows" />
          <Metric label="Latest coverage" value={formatDate(latestCoverage, { month: "long", year: "numeric" })} detail={companyCoverage ? `Company view ends ${formatDate(companyCoverage, { month: "short", year: "numeric" })}` : "Company coverage shown separately"} />
        </div>
        <div className="split">
          <NigeriaMap points={points} height={610} center={[6.2, 5.8]} zoom={7} />
          <div className="panel">
            <div className="panel-head"><h2>Largest reported gas flare values</h2><span className="mono">{period}</span></div>
            <div className="record-list">
              {visibleRows.map((row, index) => <Link className="record-row" key={row.name} href={area === "cluster" ? `/gas-flares/clusters/${row.name}` : area === "block" ? `/oil-blocks/${row.name.toLowerCase().replace(/\s+/g, "-")}` : area === "state" ? `/places/states/${slugify(row.name)}` : `/search?q=${encodeURIComponent(row.name)}`}><time>#{String((page - 1) * pageSize + index + 1).padStart(2, "0")}</time><div><strong>{area === "state" ? `Gas flaring in ${row.name} State` : row.name}</strong><p>{formatVolume(row.mscf)}</p></div><span className="status warning"><Flame size={12} />Detected</span></Link>)}
            </div>
            <div className="flare-pagination" aria-label="Cluster pagination">
              <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span>
              <div>
                <Link className={page === 1 ? "button disabled" : "button ghost"} href={pageHref(page - 1)} aria-disabled={page === 1} tabIndex={page === 1 ? -1 : undefined}><ArrowLeft size={14} />Previous</Link>
                <Link className={page === pageCount ? "button disabled" : "button ghost"} href={pageHref(page + 1)} aria-disabled={page === pageCount} tabIndex={page === pageCount ? -1 : undefined}>Next<ArrowRight size={14} /></Link>
              </div>
            </div>
          </div>
        </div>
        <div className="panel" style={{ marginTop: 22 }}>
          <div className="panel-head"><h2>Recent Nigeria gas flare trend for this aggregation</h2><span className="mono">Values are summed within {titleCase(area)} only</span></div>
          <div className="panel-body"><FlareTrend data={trend} /></div>
        </div>
      </div>
    </>
  );
}
