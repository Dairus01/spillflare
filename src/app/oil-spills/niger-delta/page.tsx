import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BarChart3, Database, MapPinned, TableProperties } from "lucide-react";
import { CauseDistributionChart } from "@/components/cause-analysis";
import { NigeriaMap } from "@/components/map";
import { NationalSpillTrend } from "@/components/national-spill-trend";
import { DataNote, SourceRail } from "@/components/ui";
import { getMetadata, getSpills } from "@/lib/data";
import { buildNationalSpillOverview } from "@/lib/spill-overview";
import {
  NIGER_DELTA_MAP_LIMIT,
  NIGER_DELTA_NDDC_STATES,
  buildNigerDeltaAnalysis,
  nigerDeltaStatesForRow,
  regionalCoordinates,
} from "@/lib/niger-delta";
import { formatDate, formatNumber, slugify, spillPath } from "@/lib/format";
import { parseW3cDate } from "@/lib/sitemap-date";
import { siteUrl } from "@/lib/site";
import type { MapPoint } from "@/types/domain";

const title = "Niger Delta Oil Spills: Records, Trends & Map";
const description = "Explore Niger Delta oil-spill records, state trends, reported causes and mapped locations from SpillFlare's current NOSDRA source snapshot.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/oil-spills/niger-delta" },
  openGraph: { title, description, type: "website", url: "/oil-spills/niger-delta" },
  twitter: { card: "summary", title, description },
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function percentage(value: number, total: number, decimals = 1) {
  return total ? `${((value / total) * 100).toFixed(decimals)}%` : "0%";
}

function signedPercentage(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export default async function NigerDeltaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const [rows, sourceMetadata] = await Promise.all([getSpills(), getMetadata()]);
  const retrievedAt = parseW3cDate(sourceMetadata.retrievedAt);
  const overview = buildNationalSpillOverview(rows, retrievedAt);
  const requestedYear = firstValue(params.year);
  const analysis = buildNigerDeltaAnalysis(rows, retrievedAt, requestedYear, overview.yearly.reduce((sum, item) => sum + item.count, 0));
  const selectedYear = analysis.selected.year ?? analysis.years.at(-1) ?? "—";
  const currentYear = new Date().getUTCFullYear().toString();
  const isCurrentPartialYear = selectedYear === currentYear;
  const selectedYearIndex = analysis.yearly.findIndex((item) => item.year === selectedYear);
  const previousYear = selectedYearIndex > 0 ? analysis.yearly[selectedYearIndex - 1] : null;
  const selectedChange = previousYear ? analysis.selected.consideredRecords - previousYear.count : null;
  const snapshotDate = formatDate(sourceMetadata.retrievedAt.slice(0, 10));
  const mapPoints: MapPoint[] = analysis.selected.mapRecords.slice(0, NIGER_DELTA_MAP_LIMIT).flatMap(({ row }) => {
    const coordinates = regionalCoordinates(row);
    if (!coordinates) return [];
    const state = nigerDeltaStatesForRow(row)[0];
    return [{ id: row.id, ...coordinates, title: `Oil-spill record ${row.id}`, subtitle: `${state ?? "Niger Delta"} · ${row.sitelocationname ?? "Location not supplied"}`, kind: "spill" as const, href: spillPath(row.id) }];
  });
  const faq = [
    { question: "How does SpillFlare define the Niger Delta on this page?", answer: `For this analysis, SpillFlare uses the nine-state regional definition used by the Niger Delta Development Commission: ${NIGER_DELTA_NDDC_STATES.join(", ")}. This administrative region is not presented as identical to every ecological or geographical definition of the physical delta.` },
    { question: "How are Niger Delta oil-spill statistics calculated?", answer: "Counts use source incident records whose explicit state field resolves to at least one of the nine regional states and whose incident date passes SpillFlare's shared trusted-date checks. The regional total counts each source record once." },
    { question: "Does one record represent one unique spill event?", answer: "Not necessarily. One row is a source incident record, and repeated incident numbers or similar records can occur. SpillFlare reports source-record counts rather than independently deduplicated physical events." },
    { question: "Why can a record appear in more than one state total?", answer: "A small number of source rows explicitly name more than one state. Those rows count once in the regional total but can contribute to each resolved state row, so state totals are not expected to sum to the regional total." },
    { question: "What do the reported causes mean?", answer: "Cause values are classifications supplied by the underlying public source. SpillFlare summarizes them and does not independently verify technical cause, fault or legal responsibility." },
    { question: "Is the latest year complete?", answer: `${currentYear} is an incomplete current source snapshot. Its value reflects records supplied so far, not a completed calendar-year total.` },
    { question: "Where can I inspect the underlying records?", answer: "Recent records on this page link to stable SpillFlare incident pages. The full national explorer and source methodology are also linked below." },
  ];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": `${siteUrl}/oil-spills/niger-delta#webpage`, url: `${siteUrl}/oil-spills/niger-delta`, name: title, description, isPartOf: { "@id": `${siteUrl}/#website` }, about: { "@id": `${siteUrl}/oil-spills#dataset` }, mainEntity: { "@id": `${siteUrl}/oil-spills#dataset` } },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: siteUrl }, { "@type": "ListItem", position: 2, name: "Oil spills", item: `${siteUrl}/oil-spills` }, { "@type": "ListItem", position: 3, name: "Niger Delta", item: `${siteUrl}/oil-spills/niger-delta` }] },
      { "@type": "FAQPage", mainEntity: faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) },
    ],
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <section className="analytics-hero"><div className="container"><div className="breadcrumbs"><Link href="/oil-spills">Oil spills</Link> / Niger Delta</div><div className="analytics-hero-grid"><div><span className="eyebrow">NOSDRA regional source analysis</span><h1>Oil Spills in the Niger Delta: Records, Trends and Locations</h1><p>Explore public oil-spill records across the nine states used by the Niger Delta Development Commission&apos;s regional definition. SpillFlare connects current source-record counts, annual trends, state patterns, reported causes, mapped locations and underlying evidence.</p></div><div className="analytics-hero-actions"><Link className="button secondary" href="/oil-spills"><ArrowLeft size={16} />Incident explorer</Link></div></div></div></section>
    <SourceRail label="NOSDRA Oil Spill Monitor · Niger Delta source records" observation={sourceMetadata.sources.spillsPrimary.latestObservation} retrieved={sourceMetadata.retrievedAt} />
    <main className="wide-container analytics-page niger-delta-page">
      <section className="analytics-intro panel" aria-label="Niger Delta statistics scope"><div><span className="eyebrow">Current source snapshot</span><h2>How to read this regional analysis</h2><p>Snapshot retrieved {snapshotDate}. The figures below describe public source incident records with explicit regional state fields and trusted incident dates; they are not independently deduplicated counts of unique physical spill events.</p></div><div className="analytics-intro-links"><Link className="text-link" href="/oil-spills">Search the national oil-spill records</Link><Link className="text-link" href="/oil-spills/analytics">Compare national yearly trends</Link><Link className="text-link" href="/oil-spills/causes">Read the full reported-cause analysis</Link><Link className="text-link" href="/data-and-methods">Review data and methods</Link></div></section>

      <section className="analytics-summary niger-delta-summary" aria-label="Niger Delta headline statistics"><div><span>Trusted regional records</span><strong>{formatNumber(analysis.regionTrustedRecords)}</strong><small>incident-date source rows</small></div><div><span>Share of national trusted records</span><strong>{percentage(analysis.regionTrustedRecords, analysis.nationalTrustedRecords, 2)}</strong><small>{formatNumber(analysis.nationalTrustedRecords)} nationally</small></div><div><span>Usable coordinates</span><strong>{percentage(analysis.selected.withCoordinates, analysis.selected.consideredRecords)}</strong><small>{formatNumber(analysis.selected.withCoordinates)} in the selected year</small></div><div><span>NDDC states represented</span><strong>{formatNumber(analysis.regionStatesRepresented)}</strong><small>{formatNumber(NIGER_DELTA_NDDC_STATES.length)} in the regional definition</small></div></section>
      <DataNote><strong>Source-record safeguard:</strong> {formatNumber(analysis.regionRawRecords)} raw rows resolve to at least one regional state, including {formatNumber(analysis.regionNoindexRecords)} context-free/noindex rows. Each row is counted once in the regional total; {formatNumber(analysis.stateMultiRecordCount)} trusted rows explicitly name multiple regional states and can contribute to more than one state total.</DataNote>

      <section className="analytics-section" aria-labelledby="definition-heading"><div className="analytics-section-head"><div><span className="section-icon teal"><MapPinned size={19} /></span><div><span className="eyebrow">Regional definition</span><h2 id="definition-heading">What SpillFlare means by “Niger Delta”</h2><p>For this analysis, SpillFlare uses the nine-state regional definition used by the Niger Delta Development Commission.</p></div></div></div><div className="panel niger-delta-definition"><p>{NIGER_DELTA_NDDC_STATES.join(", ")}. This administrative definition should not be interpreted as identical to every ecological or geographical definition of the physical Niger Delta.</p><div className="niger-delta-state-links">{NIGER_DELTA_NDDC_STATES.map((state) => <Link key={state} href={`/places/states/${slugify(state)}`}>{state}</Link>)}</div></div></section>

      <section className="analytics-section" aria-labelledby="map-heading"><div className="analytics-section-head"><div><span className="section-icon"><MapPinned size={19} /></span><div><span className="eyebrow">Recorded locations</span><h2 id="map-heading">Recorded oil-spill locations across the Niger Delta</h2><p>Points represent source records with usable coordinates; point density is not a measure of contamination severity or pollution extent.</p></div></div></div><div className="niger-delta-map-panel"><NigeriaMap points={mapPoints} height={560} center={[5.8, 6.2]} zoom={7} /><div className="panel niger-delta-map-note"><strong>Selected-year map: {formatNumber(analysis.mapRecordsShown)} of {formatNumber(analysis.selected.withCoordinates)} trusted records with usable coordinates are rendered.</strong><p>The map has a maximum of {formatNumber(NIGER_DELTA_MAP_LIMIT)} markers and prioritizes the most recent mapped records for performance. {analysis.mapRecordsOmitted > 0 ? `${formatNumber(analysis.mapRecordsOmitted)} additional selected-year mapped records remain in the statistics.` : "All selected-year mapped records are shown."} Across the full trusted regional snapshot, {formatNumber(analysis.mapCoordinateRecords)} records have usable coordinates; all mapped records remain included in the statistics, while records without coordinates remain in the tables and counts.</p></div></div></section>

      <section className="analytics-section" aria-labelledby="state-heading"><div className="analytics-section-head"><div><span className="section-icon"><TableProperties size={19} /></span><div><span className="eyebrow">State comparison</span><h2 id="state-heading">Oil-spill records by Niger Delta state</h2><p>Counts use only explicit, resolvable source state fields. State totals can exceed the regional total because explicit multi-state rows contribute to each named state.</p></div></div></div><div className="table-wrap analytics-table-wrap"><table className="analytics-table niger-delta-state-table"><caption>Trusted Niger Delta source records by state for {selectedYear}</caption><thead><tr><th scope="col">State</th><th scope="col" className="numeric">Trusted records</th><th scope="col" className="numeric">Share of region</th><th scope="col">Trusted-date coverage</th><th scope="col" className="numeric">Coordinates</th><th scope="col" className="numeric">Cause supplied</th></tr></thead><tbody>{analysis.selected.states.map((state) => <tr key={state.name}><th scope="row"><Link href={`/places/states/${state.slug}`}>{state.name}</Link></th><td className="numeric"><strong>{formatNumber(state.count)}</strong></td><td className="numeric">{percentage(state.count, analysis.selected.consideredRecords)}</td><td>{state.earliestDate && state.latestDate ? `${formatDate(state.earliestDate)} – ${formatDate(state.latestDate)}` : "Not supplied"}</td><td className="numeric">{percentage(state.coordinateCount, state.count)}</td><td className="numeric">{percentage(state.causeCount, state.count)}</td></tr>)}</tbody></table></div></section>

      <section className="analytics-section" aria-labelledby="trend-heading"><div className="analytics-section-head"><div><span className="section-icon teal"><BarChart3 size={19} /></span><div><span className="eyebrow">Trusted incident-year trends</span><h2 id="trend-heading">Niger Delta oil-spill records by year</h2><p>Annual values reuse SpillFlare&apos;s trusted incident-date logic. The latest year is a current source snapshot, not a completed calendar year.</p></div></div></div><div className="analytics-card"><div className="analytics-card-head"><h2>Regional trusted source records</h2><p>{analysis.earliestTrustedDate ? `${formatDate(analysis.earliestTrustedDate)} – ${formatDate(analysis.latestTrustedDate)}` : "No trusted dates supplied"}</p></div><NationalSpillTrend data={analysis.yearly} scope="Niger Delta" /></div><div className="analytics-year-table table-wrap"><table className="analytics-table"><caption>Trusted Niger Delta source records by year</caption><thead><tr><th scope="col">Year</th><th scope="col" className="numeric">Records</th><th scope="col">Status</th></tr></thead><tbody>{analysis.yearly.slice().reverse().map((item) => <tr key={item.year}><th scope="row">{item.year}</th><td className="numeric"><strong>{formatNumber(item.count)}</strong></td><td>{item.year === currentYear ? "Current snapshot / incomplete" : "Trusted incident-date records"}</td></tr>)}</tbody></table></div>{isCurrentPartialYear && <p className="analytics-footnote"><strong>{currentYear} is incomplete.</strong> Its count reflects records currently supplied by the source and should not be compared with a completed year as if coverage were equal.</p>}{previousYear && <div className="analytics-comparison"><strong>{selectedYear}: {formatNumber(analysis.selected.consideredRecords)} trusted records</strong><span>Previous year ({previousYear.year}): {formatNumber(previousYear.count)}</span>{isCurrentPartialYear ? <span>Percentage comparison is withheld for the incomplete current-year snapshot.</span> : <span className={selectedChange! >= 0 ? "positive" : "negative"}>{signedPercentage((selectedChange! / previousYear.count) * 100)} change in trusted source-record count</span>}</div>}</section>

      <section className="analytics-section" aria-labelledby="causes-heading"><div className="analytics-section-head"><div><span className="section-icon"><BarChart3 size={19} /></span><div><span className="eyebrow">Reported cause classifications</span><h2 id="causes-heading">Reported causes in Niger Delta source records</h2><p>These are source-record classifications. They do not independently establish technical cause, fault or legal responsibility.</p></div></div><Link className="text-link" href="/oil-spills/causes">Full national cause analysis</Link></div><div className="analytics-charts"><CauseDistributionChart data={analysis.regional.causes} scopeLabel="Niger Delta" /><div className="table-wrap analytics-table-wrap"><table className="analytics-table"><caption>Reported causes across all trusted Niger Delta source records</caption><thead><tr><th scope="col">Displayed category</th><th scope="col" className="numeric">Records</th><th scope="col" className="numeric">Share of all</th></tr></thead><tbody>{analysis.regional.causes.map((cause) => <tr key={cause.category}><th scope="row">{cause.label}</th><td className="numeric">{formatNumber(cause.count)}</td><td className="numeric">{percentage(cause.count, analysis.regional.consideredRecords)}</td></tr>)}</tbody></table></div></div><div className="table-wrap analytics-table-wrap niger-delta-selected-cause-table"><table className="analytics-table"><caption>Reported causes in the selected year, {selectedYear}</caption><thead><tr><th scope="col">Selected-year category</th><th scope="col" className="numeric">Records</th><th scope="col" className="numeric">Share of selected year</th></tr></thead><tbody>{analysis.selected.causes.map((cause) => <tr key={cause.category}><th scope="row">{cause.label}</th><td className="numeric">{formatNumber(cause.count)}</td><td className="numeric">{percentage(cause.count, analysis.selected.consideredRecords)}</td></tr>)}</tbody></table></div><p className="analytics-footnote">Cause not supplied is shown separately from the explicit “Yet to determine” source value. See the <Link className="text-link" href="/oil-spills/causes">national cause taxonomy and raw-label audit</Link> for the mapping.</p></section>

      <section className="analytics-section" aria-labelledby="records-heading"><div className="analytics-section-head"><div><span className="section-icon teal"><Database size={19} /></span><div><span className="eyebrow">Underlying evidence</span><h2 id="records-heading">Recent Niger Delta oil-spill records</h2><p>These representative records are ordered by trusted incident date and use stable record IDs.</p></div></div></div><div className="analytics-record-list">{analysis.selected.recentRecords.map(({ row }) => <Link className="record-row" href={spillPath(row.id)} key={row.id}><span><strong>{row.sitelocationname || "Location not supplied"}</strong><small>{row.company || "Operator not supplied"} · {row.statesaffected || "State not supplied"} · {row.incidentnumber || "Incident number not supplied"}</small></span><time dateTime={row.incidentdate ?? undefined}>{formatDate(row.incidentdate)}</time></Link>)}</div><div className="analytics-resource-links"><Link className="button secondary" href="/oil-spills">Search all oil-spill records</Link><Link className="button secondary" href="/data-and-methods">Read the methodology</Link></div></section>

      <section className="analytics-section" aria-labelledby="quality-heading"><div className="analytics-section-head"><div><span className="section-icon"><TableProperties size={19} /></span><div><span className="eyebrow">Data completeness</span><h2 id="quality-heading">What is supplied in the selected records?</h2><p>Completeness describes the source fields available for analysis; it is not a score for any state, operator or incident.</p></div></div></div><div className="analytics-completeness-grid">{[["Coordinates", analysis.selected.withCoordinates], ["Reported cause", analysis.selected.withCause], ["Estimated quantity", analysis.selected.withQuantity], ["Operator label", analysis.selected.withOperator], ["Incident number", analysis.selected.withIncidentNumber]].map(([label, value]) => <div key={label as string}><span>{label}</span><strong>{percentage(value as number, analysis.selected.consideredRecords)}</strong><small>{formatNumber(value)} of {formatNumber(analysis.selected.consideredRecords)} records</small></div>)}</div><p className="analytics-footnote">Quantity values are kept as a completeness measure only; this page does not publish a regional volume total because source coverage and semantics are not sufficient for a defensible aggregate.</p></section>

      <section className="analytics-section authority-explainer" aria-labelledby="context-heading"><div className="card"><div className="card-icon"><Database size={21} /></div><h2 id="context-heading">Historical and environmental context</h2><p>SpillFlare&apos;s map and counts describe the source records currently available; they do not model contamination footprints, health effects or ecological change. For field-based context on Ogoniland&apos;s environmental and public-health assessment, see the United Nations Environment Programme&apos;s published assessment.</p><p><a className="text-link" href="https://www.unep.org/topics/disasters-and-conflicts/country-presence/nigeria/environmental-assessment-ogoniland-report" target="_blank" rel="noreferrer">Read the UNEP Ogoniland assessment</a></p></div><div className="card"><div className="card-icon"><MapPinned size={21} /></div><h2>Ogoniland and cleanup context</h2><p>Ogoniland is one part of the wider nine-state administrative region used here. Cleanup-program information is separate from SpillFlare&apos;s incident-record statistics; consult HYPREP&apos;s official updates for that programme&apos;s current scope and reports.</p><p><a className="text-link" href="https://hyprep.gov.ng/" target="_blank" rel="noreferrer">Visit HYPREP&apos;s official site</a></p></div></section>

      <section className="analytics-section authority-explainer" aria-labelledby="interpret-heading"><div className="card"><div className="card-icon"><Database size={21} /></div><h2 id="interpret-heading">How to interpret the regional figures</h2><p>SpillFlare is a search, mapping and analysis layer over public NOSDRA records. A trusted incident-date count tells you how many source rows currently meet the stated filters; it does not estimate contamination area, environmental severity, health effects or a unique-event total.</p><p>Cause values and operator labels are preserved as supplied. Their frequency is not a finding of fault, liability or performance.</p></div><div className="card"><div className="card-icon"><MapPinned size={21} /></div><h2>Source and context</h2><p>The public source may be revised, so current snapshot totals can differ from earlier publications or other regional definitions. This page intentionally avoids substituting historical estimates or cleanup claims for the reproducible source-record analysis.</p><p><Link className="text-link" href="/data-and-methods">Read the data and methods</Link> · <Link className="text-link" href="/data-license">Review reuse and attribution terms</Link></p></div></section>

      <section className="analytics-section analytics-faq" aria-labelledby="faq-heading"><div className="analytics-section-head"><div><span className="section-icon teal"><TableProperties size={19} /></span><div><span className="eyebrow">Questions researchers ask</span><h2 id="faq-heading">Niger Delta oil-spill data FAQ</h2></div></div></div><div className="faq">{faq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>
    </main>
  </>;
}
