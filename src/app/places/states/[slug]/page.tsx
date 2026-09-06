import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Filter, Search } from "lucide-react";
import { notFound } from "next/navigation";
import { FlareTrend } from "@/components/flare-chart";
import { NigeriaMap } from "@/components/map";
import { DataNote, Metric, SourceRail } from "@/components/ui";
import { flareSeries, getGeo, getMetadata, getSpills, spillCoordinates } from "@/lib/data";
import { formatDate, formatNumber, formatVolume, numberOrNull, slugify, spillPath } from "@/lib/format";
import type { GeoFeature, MapPoint } from "@/types/domain";
import { datasetLicense, siteUrl } from "@/lib/site";
import { spillMatchesState } from "@/lib/spill-state";
import { parseW3cDate, trustedIncidentLastModified, trustedIncidentYear } from "@/lib/sitemap-date";

async function findState(slug: string) {
  const states = await getGeo("states");
  return states.features.find(
    (item) =>
      slugify(String(item.properties.admin1name ?? item.properties.name ?? "")) ===
      slugify(slug),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const feature = await findState(slug);
  if (!feature) return { title: "State environmental profile not found" };
  const stateName = String(feature.properties.admin1name ?? feature.properties.name);
  const [spills, flares] = await Promise.all([getSpills(), flareSeries("state", stateName)]);
  const spillCount = spills.filter((row) => spillMatchesState(row, stateName)).length;
  const latestFlare = flares.at(-1);
  const title = `${stateName} Oil Spills & Gas Flaring Data`;
  const description = `Explore ${formatNumber(spillCount)} recorded oil spills in ${stateName} State, Nigeria${latestFlare ? ` and monthly gas flaring data through ${formatDate(latestFlare.month, { month: "long", year: "numeric" })}` : ""}. View maps, companies, locations and source records.`;
  return {
    title,
    description,
    alternates: { canonical: `/places/states/${slugify(stateName)}` },
    openGraph: { title, description, type: "website", url: `/places/states/${slugify(stateName)}` },
  };
}

const pageSize = 10;
const layerValues = ["both", "spills", "flares"] as const;
type Layer = typeof layerValues[number];

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function mapCenter(feature: GeoFeature): [number, number] {
  const pairs: Array<[number, number]> = [];
  function collect(value: unknown) {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
      pairs.push([value[0], value[1]]);
      return;
    }
    for (const item of value) collect(item);
  }
  if ("coordinates" in feature.geometry) collect(feature.geometry.coordinates);
  if (!pairs.length) return [6.2, 5.8];
  const [lng, lat] = pairs.reduce(([lngSum, latSum], [pointLng, pointLat]) => [lngSum + pointLng, latSum + pointLat], [0, 0]);
  return [lat / pairs.length, lng / pairs.length];
}

function queryHref(slug: string, values: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return `/places/states/${slug}?${query.toString()}`;
}

export default async function StatePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [feature, spills, metadata] = await Promise.all([findState(slug), getSpills(), getMetadata()]);
  if (!feature) notFound();

  const stateName = String(feature.properties.admin1name ?? feature.properties.name);
  const retrievedAt = parseW3cDate(metadata.retrievedAt);
  const stateSpills = spills
    .filter((row) => spillMatchesState(row, stateName))
    .sort((a, b) => (trustedIncidentLastModified(b, retrievedAt)?.getTime() ?? -1) - (trustedIncidentLastModified(a, retrievedAt)?.getTime() ?? -1) || String(b.id).localeCompare(String(a.id)));
  const datedStateSpills = stateSpills.filter((row) => trustedIncidentLastModified(row, retrievedAt));
  const earliestStateSpill = datedStateSpills.at(-1)?.incidentdate;
  const latestStateSpill = datedStateSpills.at(0)?.incidentdate;
  const series = await flareSeries("state", stateName);
  const latestFlare = series.at(-1);

  const years = [...new Set(stateSpills.map((row) => trustedIncidentYear(row, retrievedAt)).filter((year): year is string => Boolean(year)))].sort().reverse();
  const latestYear = years[0] ?? String(new Date().getFullYear());
  const requestedYear = firstValue(query.year) ?? latestYear;
  const year = requestedYear === "all" || years.includes(requestedYear) ? requestedYear : latestYear;
  const companies = [...new Set(stateSpills.map((row) => row.company).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b));
  const requestedCompany = firstValue(query.company) ?? "";
  const company = companies.includes(requestedCompany) ? requestedCompany : "";
  const requestedLayer = firstValue(query.layer) as Layer | undefined;
  const layer: Layer = requestedLayer && layerValues.includes(requestedLayer) ? requestedLayer : "both";
  const search = (firstValue(query.q) ?? "").trim();
  const searchNeedle = search.toLowerCase();

  const flareMonths = series.flatMap((row) => row.month ? [row.month] : []);
  const availableFlareMonths = flareMonths.filter((item) => year === "all" || item.startsWith(year));
  const requestedFlareMonth = firstValue(query.flareMonth);
  const defaultFlareMonth = availableFlareMonths.at(-1) ?? "";
  const flareMonth = requestedFlareMonth && availableFlareMonths.includes(requestedFlareMonth) ? requestedFlareMonth : defaultFlareMonth;
  const selectedFlare = series.find((row) => row.month === flareMonth);

  const filteredSpills = stateSpills.filter((row) => {
    if (year !== "all" && trustedIncidentYear(row, retrievedAt) !== year) return false;
    if (company && row.company !== company) return false;
    if (searchNeedle && ![row.incidentnumber, row.company, row.sitelocationname, row.lga].join(" ").toLowerCase().includes(searchNeedle)) return false;
    return true;
  });
  const requestedPage = Math.max(1, Number.parseInt(firstValue(query.page) ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil(filteredSpills.length / pageSize));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleSpills = filteredSpills.slice(pageStart, pageStart + pageSize);

  const points: MapPoint[] = [];
  if (layer !== "flares") {
    points.push(...filteredSpills.slice(0, 300).flatMap((row) => {
      const coordinates = spillCoordinates(row);
      return coordinates ? [{
        id: row.id,
        ...coordinates,
        title: `Spill ${row.incidentnumber ?? row.id}`,
        subtitle: `${formatDate(row.incidentdate)} · ${row.sitelocationname ?? "Location not supplied"}`,
        kind: "spill" as const,
        href: spillPath(row.id),
      }] : [];
    }));
  }
  if (layer !== "spills" && selectedFlare) {
    const lat = numberOrNull(selectedFlare.y);
    const lng = numberOrNull(selectedFlare.x);
    if (lat !== null && lng !== null) points.push({
      id: `flare-${stateName}-${flareMonth}`,
      lat,
      lng,
      title: `${stateName} state flare estimate`,
      subtitle: `${formatVolume(selectedFlare.mscf)} · ${flareMonth}`,
      kind: "flare",
    });
  }

  const flareChartLabel = year === "all" ? "All supplied months" : year;
  const yearlyFlareRows = year === "all" ? series : series.filter((row) => row.month?.startsWith(year));
  const trend = yearlyFlareRows.map((row) => ({
    month: formatDate(row.month, year === "all" ? { month: "short", year: "2-digit" } : { month: "short" }),
    value: numberOrNull(row.mscf) ?? 0,
  }));
  const persistedQuery = { year, company, layer, flareMonth, q: search };
  const topCompanies = companies
    .map((name) => ({
      name,
      count: stateSpills.filter((row) => row.company === name).length,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 5);
  const statePath = `/places/states/${slugify(stateName)}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${siteUrl}${statePath}/#webpage`,
        url: `${siteUrl}${statePath}`,
        name: `${stateName} Oil Spills & Gas Flaring Data`,
        description: `Source-backed oil spill records and monthly gas flare estimates for ${stateName} State, Nigeria.`,
        isPartOf: { "@id": `${siteUrl}/#website` },
        about: { "@type": "AdministrativeArea", name: `${stateName} State, Nigeria` },
      },
      {
        "@type": "Dataset",
        name: `${stateName} oil spill and gas flare records`,
        description: `${formatNumber(stateSpills.length)} oil spill records and ${formatNumber(series.length)} monthly state gas flare observations for ${stateName}.`,
        url: `${siteUrl}${statePath}`,
        spatialCoverage: { "@type": "AdministrativeArea", name: `${stateName} State, Nigeria` },
        creator: { "@id": `${siteUrl}/#organization` },
        isAccessibleForFree: true,
        ...datasetLicense,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Places", item: `${siteUrl}/places` },
          { "@type": "ListItem", position: 2, name: stateName, item: `${siteUrl}${statePath}` },
        ],
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <section className="detail-hero state-hero">
        <div className="container">
          <div className="breadcrumbs"><Link href="/places">Places</Link> / {stateName}</div>
          <div className="detail-title">
            <div><span className="badge">State profile</span><h1>Oil Spills and Gas Flaring in {stateName} State</h1><p>Explore {formatNumber(stateSpills.length)} oil spill records and {formatNumber(series.length)} monthly state-level gas flare observations for {stateName}, with source dates and limitations kept visible.</p></div>
          </div>
        </div>
      </section>
      <SourceRail label="NOSDRA spills + Gas Flare Tracker state aggregation" observation={latestFlare?.month ?? metadata.sources.spillsPrimary.latestObservation} retrieved={metadata.retrievedAt} />

      <div className="wide-container state-page">
        <form className="state-filter-panel">
          <div className="state-filter-heading"><Filter size={18} /><div><strong>Filter {stateName} records</strong><span>Choose what the map, list and monthly chart should show.</span></div></div>
          <div className="state-filter-grid">
            <label>Year<select name="year" defaultValue={year}><option value="all">All years</option>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Spill company<select name="company" defaultValue={company}><option value="">All companies</option>{companies.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Data shown<select name="layer" defaultValue={layer}><option value="both">Oil spills + gas flares</option><option value="spills">Oil spills only</option><option value="flares">Gas flares only</option></select></label>
            {layer !== "spills" && <label>Flare month<select name="flareMonth" defaultValue={flareMonth} disabled={!availableFlareMonths.length}>{!availableFlareMonths.length && <option value="">No supplied month</option>}{[...availableFlareMonths].reverse().map((item) => <option key={item} value={item}>{formatDate(item, { month: "long", year: "numeric" })}</option>)}</select></label>}
            {layer !== "flares" && <label className="state-search-field">Search spills<input name="q" defaultValue={search} placeholder="Incident, facility or LGA" /></label>}
          </div>
          <div className="state-filter-actions"><button className="button" type="submit"><Search size={16} />Search state data</button><Link className="button ghost" href={`/places/states/${slugify(stateName)}`}>Reset filters</Link></div>
          <p className="state-filter-note">The company filter applies to oil spills. The state flare endpoint supplies monthly state totals without a company field.</p>
        </form>

        <div className="metric-grid state-metrics">
          <Metric label={year === "all" ? "Matching spill records" : `Spills dated ${year}`} value={formatNumber(filteredSpills.length)} detail={company || "All spill companies"} />
          <Metric
            label="Dated records"
            value={formatNumber(datedStateSpills.length)}
            detail={earliestStateSpill && latestStateSpill
              ? `${formatDate(earliestStateSpill, { month: "short", year: "numeric" })}–${formatDate(latestStateSpill, { month: "short", year: "numeric" })} · all dated state records`
              : "No dated state records supplied"}
          />
          <Metric label="Selected flare month" value={selectedFlare ? formatVolume(selectedFlare.mscf) : "No supplied row"} detail={flareMonth ? formatDate(flareMonth, { month: "long", year: "numeric" }) : "No state flare month"} />
          <Metric label="Data on map" value={layer === "both" ? "Both" : layer === "spills" ? "Oil spills" : "Gas flares"} detail={`${formatNumber(points.length)} visible source locations`} />
        </div>

        <section className="panel" style={{ marginBottom: 22 }}>
          <div className="panel-head"><h2>{stateName} environmental record summary</h2></div>
          <div className="panel-body prose">
            <p>The SpillFlare profile for {stateName} brings together two separate public datasets: NOSDRA oil spill incident records and monthly state-level estimates from the Nigeria Gas Flare Tracker. The profile currently contains <strong>{formatNumber(stateSpills.length)} oil spill records</strong>{earliestStateSpill && latestStateSpill ? <> dated from {formatDate(earliestStateSpill, { month: "long", year: "numeric" })} to {formatDate(latestStateSpill, { month: "long", year: "numeric" })}</> : null}.</p>
            {topCompanies.length > 0 && <p>Companies appearing most often in the supplied {stateName} spill records include {topCompanies.map((item, index) => <span key={item.name}>{index > 0 ? index === topCompanies.length - 1 ? " and " : ", " : ""}<Link href={`${statePath}?year=all&company=${encodeURIComponent(item.name)}`}>{item.name} ({formatNumber(item.count)})</Link></span>)}. These are record counts, not a finding of legal responsibility.</p>}
            <p>Browse the incident list below, compare the state&apos;s monthly flare estimates, or continue to the national <Link href="/oil-spills">oil spill tracker</Link> and <Link href="/gas-flares">gas flaring tracker</Link>.</p>
          </div>
        </section>

        <div className="state-map-layout">
          <NigeriaMap points={points} polygons={{ type: "FeatureCollection", features: [feature] }} height={650} center={mapCenter(feature)} zoom={8} />
          {layer !== "flares" ? (
            <section className="panel state-record-panel">
              <div className="panel-head"><div><h2>Oil spill records</h2><span className="mono">Newest dated records first</span></div></div>
              {visibleSpills.length ? <div className="record-list">{visibleSpills.map((row) => <Link className="record-row" key={row.id} href={spillPath(row.id)}><time>{formatDate(row.incidentdate, { day: "2-digit", month: "short", year: "numeric" })}</time><div><strong>{row.incidentnumber ?? row.id} · {row.company ?? "Company not supplied"}</strong><p>{row.sitelocationname ?? "Location not supplied"}</p></div><span className="status">Record</span></Link>)}</div> : <div className="empty-state"><h3>No spill records match these filters</h3><p>Try another year, company or a broader search.</p></div>}
              <div className="state-pagination">
                <span>{filteredSpills.length ? `${formatNumber(pageStart + 1)}–${formatNumber(Math.min(pageStart + pageSize, filteredSpills.length))} of ${formatNumber(filteredSpills.length)}` : "0 records"}</span>
                <div>{currentPage > 1 ? <Link className="button ghost" href={queryHref(slugify(stateName), { ...persistedQuery, page: currentPage - 1 })}><ArrowLeft size={15} />Previous</Link> : <span className="button ghost disabled"><ArrowLeft size={15} />Previous</span>}{currentPage < totalPages ? <Link className="button ghost" href={queryHref(slugify(stateName), { ...persistedQuery, page: currentPage + 1 })}>Next<ArrowRight size={15} /></Link> : <span className="button ghost disabled">Next<ArrowRight size={15} /></span>}</div>
              </div>
            </section>
          ) : (
            <section className="panel state-flare-focus"><div className="panel-head"><h2>{formatDate(flareMonth, { month: "long", year: "numeric" })}</h2></div><div className="panel-body"><span className="eyebrow">State flare estimate</span><strong>{selectedFlare ? formatVolume(selectedFlare.mscf) : "No supplied row"}</strong><p>One state-level monthly estimate from the Gas Flare Tracker. It is not a count of individual flare sites.</p></div></section>
          )}
        </div>

        {layer !== "spills" && (
          <section className="panel state-flare-chart">
            <div className="panel-head"><div><h2>Monthly gas flare estimates for {stateName}</h2><span className="mono">{flareChartLabel} · state aggregation · MSCF</span></div></div>
            {trend.length ? <div className="panel-body"><FlareTrend data={trend} /></div> : <div className="empty-state"><h3>No monthly state rows supplied for {year}</h3><p>Select another year to inspect the available flare series.</p></div>}
          </section>
        )}

        <DataNote>Oil spills and flare volumes describe different events and measurement systems. The map can show either dataset or both, but their values are never added into one impact score.</DataNote>
      </div>
    </>
  );
}
