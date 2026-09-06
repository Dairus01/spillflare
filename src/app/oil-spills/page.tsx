import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BarChart3, Database, Search } from "lucide-react";
import { ExportLink } from "@/components/export-link";
import { NigeriaMap } from "@/components/map";
import { NationalSpillTrend } from "@/components/national-spill-trend";
import { DataNote, Metric, SectionHeading, SourceRail } from "@/components/ui";
import { getMetadata, getSpills, spillCoordinates } from "@/lib/data";
import { codedLabel, formatDate, formatNumber, slugify, spillPath, stateCodes } from "@/lib/format";
import { datasetLicense, siteUrl } from "@/lib/site";
import { parseW3cDate, trustedIncidentYear } from "@/lib/sitemap-date";
import { buildNationalSpillOverview } from "@/lib/spill-overview";
import type { MapPoint } from "@/types/domain";

const title = "Nigeria Oil Spill Tracker & Records Database";
const description = "Explore Nigeria's public oil spill records by state, operator, location and year. Search incident data, maps, trends and source-backed records with SpillFlare.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/oil-spills" },
  openGraph: { title, description, type: "website", url: "/oil-spills" },
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OilSpillsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const queryValue = firstValue(params.q) ?? "";
  const query = queryValue.trim().toLowerCase();
  const requestedYear = firstValue(params.year);
  const company = firstValue(params.company) ?? "";
  const requestedPage = Number(firstValue(params.page) ?? 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const pageSize = 30;
  const [rows, sourceMetadata] = await Promise.all([getSpills(), getMetadata()]);
  const retrievedAt = parseW3cDate(sourceMetadata.retrievedAt);
  const overview = buildNationalSpillOverview(rows, retrievedAt);
  const year = requestedYear ?? overview.latestYear ?? "";
  const filtered = rows
    .filter((row) => (!year || trustedIncidentYear(row, retrievedAt) === year) && (!company || row.company === company) && (!query || [row.incidentnumber, row.sitelocationname, row.company, row.lga, row.statesaffected].join(" ").toLowerCase().includes(query)))
    .sort((a, b) => String(b.incidentdate).localeCompare(String(a.incidentdate)));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const companies = overview.operators.map((item) => item.name).sort();
  const years = overview.yearly.map((item) => item.year).reverse();
  const points: MapPoint[] = filtered.slice(0, 400).flatMap((row) => {
    const coordinates = spillCoordinates(row);
    return coordinates ? [{ id: row.id, ...coordinates, title: `Incident ${row.incidentnumber ?? row.id}`, subtitle: row.sitelocationname, kind: "spill" as const, href: spillPath(row.id) }] : [];
  });
  const queryString = new URLSearchParams({ year, ...(company ? { company } : {}), ...(query ? { q: queryValue.trim() } : {}) }).toString();
  const topStates = overview.states.slice(0, 10);
  const topOperators = overview.operators.slice(0, 10);
  const latestYears = overview.yearly.slice(-12).reverse();
  const coverage = overview.earliestYear && overview.latestYear ? `${overview.earliestYear}–${overview.latestYear}` : "Not supplied";
  const faq = [
    { question: "How many oil spill records are available for Nigeria?", answer: `The current source snapshot contains ${formatNumber(overview.rawRecords)} rows. ${formatNumber(overview.indexableRecords)} have enough incident context for indexable detail pages; the remaining ${formatNumber(overview.rawRecords - overview.indexableRecords)} stay available in the explorer but are excluded from the sitemap. These counts are not measures of environmental severity.` },
    { question: "Which Nigerian states have the most oil spill records?", answer: `${topStates.slice(0, 3).map((item) => item.name).join(", ")} have the largest record counts in the current SpillFlare dataset. Record frequency should not be interpreted as a ranking of pollution or environmental harm.` },
    { question: "Can I search Nigerian oil spill records by company?", answer: `Yes. The explorer can filter the ${formatNumber(overview.representedOperators)} operator or company labels represented in the source records. A named operator is a source field, not by itself a finding of legal responsibility.` },
    { question: "Can I search oil spills by year?", answer: `Yes. Trustworthy incident dates in the current dataset cover ${coverage}. Records without a trustworthy incident date remain searchable through other fields but do not enter yearly comparisons.` },
    { question: "Where does SpillFlare's oil spill data come from?", answer: "The records come from the public NOSDRA Oil Spill Monitor dataset. SpillFlare reorganises those source fields for search, mapping and comparison while keeping missing values visible." },
    { question: "Does a record prove that a company was responsible for a spill?", answer: "No. The presence of a company or operator name describes the field supplied in the record. It should not automatically be read as a legal finding of liability or responsibility." },
    { question: "How current is the oil spill database?", answer: `The source snapshot was retrieved ${formatDate(sourceMetadata.retrievedAt.slice(0, 10))}, and its latest supplied observation is ${formatDate(sourceMetadata.sources.spillsPrimary.latestObservation)}. Incident dates and retrieval dates describe different things.` },
  ];
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": `${siteUrl}/oil-spills#webpage`, url: `${siteUrl}/oil-spills`, name: title, description, isPartOf: { "@id": `${siteUrl}/#website` }, about: { "@type": "Thing", name: "Oil spills in Nigeria" } },
      { "@type": "Dataset", "@id": `${siteUrl}/oil-spills#dataset`, name: "Nigeria oil spill records", description, url: `${siteUrl}/oil-spills`, spatialCoverage: { "@type": "Place", name: "Nigeria" }, temporalCoverage: overview.earliestYear && overview.latestYear ? `${overview.earliestYear}/${overview.latestYear}` : undefined, creator: { "@id": `${siteUrl}/#organization` }, isAccessibleForFree: true, ...datasetLicense, dateModified: sourceMetadata.retrievedAt, variableMeasured: ["Incident date", "Report date", "Operator or company", "Location", "State", "Cause", "Status", "Estimated quantity where supplied"], distribution: { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${siteUrl}/api/export?dataset=spills` } },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: siteUrl }, { "@type": "ListItem", position: 2, name: "Oil spills", item: `${siteUrl}/oil-spills` }] },
      { "@type": "FAQPage", mainEntity: faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) },
    ],
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
    <section className="page-hero oil-spill-hero"><div className="container"><span className="eyebrow">NOSDRA oil spill records · Nigeria</span><h1>Nigeria Oil Spill Records and Tracker</h1><p>Search public Nigerian oil spill records by location, state, operator and year. Examine reported incidents on the map, inspect the fields supplied for each record and follow stable record pages back to their source context.</p><div className="button-row"><a className="button" href="#incident-explorer"><Search size={16} />Search the records</a><Link className="button secondary" href="/oil-spills/analytics"><BarChart3 size={16} />Explore detailed analytics</Link><Link className="button secondary" href="/oil-spills/causes"><BarChart3 size={16} />Explore reported causes</Link></div></div></section>
    <SourceRail label="NOSDRA Oil Spill Monitor" observation={sourceMetadata.sources.spillsPrimary.latestObservation} retrieved={sourceMetadata.retrievedAt} />
    <div className="wide-container oil-spill-page">
      <section className="metric-grid oil-spill-summary" aria-label="Nigeria oil spill dataset summary"><Metric label="Source records" value={formatNumber(overview.rawRecords)} detail={`${formatNumber(overview.indexableRecords)} indexable incident pages`} /><Metric label="Trusted date coverage" value={coverage} detail={`${formatNumber(overview.missingDate)} indexable records excluded from date analysis`} /><Metric label="States represented" value={formatNumber(overview.representedStates)} detail={`${formatNumber(overview.missingState)} blank · ${formatNumber(overview.unrecognizedState)} unrecognised state fields`} /><Metric label="Operator labels" value={formatNumber(overview.representedOperators)} detail={`${formatNumber(overview.missingOperator)} indexable records without a company`} /></section>
      <DataNote><strong>{formatNumber(overview.rawRecords)} source rows are available through the all-years explorer.</strong> {formatNumber(overview.indexableRecords)} contain an incident date, location or company and therefore have indexable detail pages; {formatNumber(overview.rawRecords - overview.indexableRecords)} context-free rows are excluded from the sitemap. Record counts do not measure spill volume, environmental severity or legal responsibility.</DataNote>

      <section id="incident-explorer" className="oil-spill-explorer" aria-labelledby="explorer-heading">
        <SectionHeading eyebrow="Search and map the source records" title="Nigeria oil spill explorer" body="Filter the incident database without losing records that have missing quantities or unusable coordinates." />
        <form className="filter-bar"><div className="filter-group"><label htmlFor="spill-search">Search</label><input id="spill-search" name="q" defaultValue={queryValue} placeholder="Incident, place or company" /></div><div className="filter-group"><label htmlFor="year">Incident year</label><select id="year" name="year" defaultValue={year}><option value="">All years</option>{years.map((item) => <option key={item}>{item}</option>)}</select></div><div className="filter-group"><label htmlFor="company">Company or operator</label><select id="company" name="company" defaultValue={company}><option value="">All companies</option>{companies.map((item) => <option key={item}>{item}</option>)}</select></div><button className="button" type="submit"><Search size={16} />Apply filters</button><div className="filter-spacer" /><ExportLink href={`/api/export?dataset=spills&${queryString}`} /></form>
        <DataNote><strong>{formatNumber(filtered.length)} matching records.</strong> Offshore coordinates can be valid. Records with missing or unusable coordinates remain in the list but are not plotted.</DataNote>
        <div className="split" style={{ marginTop: 18 }}><NigeriaMap points={points} height={610} center={[6.2, 5.8]} zoom={7} /><div className="panel"><div className="panel-head"><h2 id="explorer-heading">Matching incidents</h2><span className="mono">Page {page}</span></div><div className="record-list">{paged.slice(0, 12).map((row) => <Link className="record-row" key={row.id} href={spillPath(row.id)}><time>{formatDate(row.incidentdate, { day: "2-digit", month: "short", year: "2-digit" })}</time><div><strong>{row.incidentnumber ?? row.id} · {row.company ?? "Company not supplied"}</strong><p>{row.sitelocationname ?? "Location not supplied"}</p><p>{codedLabel("contaminant", row.contaminant)} · {row.lga ?? "LGA not supplied"}, {stateCodes[row.statesaffected ?? ""] ?? row.statesaffected ?? "State not supplied"}</p></div><span className="status">{row.status ?? "Recorded"}</span></Link>)}</div><div className="panel-head"><Link className="button ghost" aria-disabled={page === 1} href={`?${queryString}&page=${Math.max(1, page - 1)}`}>Previous</Link>{page * pageSize < filtered.length ? <Link className="button ghost" href={`?${queryString}&page=${page + 1}`}>Next</Link> : <span className="button ghost disabled">Next</span>}</div></div></div>
      </section>

      <section className="oil-spill-authority" aria-labelledby="national-trend-heading"><SectionHeading eyebrow="National record overview" title="Nigeria oil spill records by year" body="Counts use only trustworthy incident dates. Reporting practices and source coverage can affect comparisons between years." action={{ label: "Open full spill analytics", href: "/oil-spills/analytics" }} /><div className="trend-layout"><div className="analytics-card"><div className="analytics-card-head"><h2 id="national-trend-heading">Dated incident records</h2><p>{coverage} · malformed and internally inconsistent dates excluded</p></div><NationalSpillTrend data={overview.yearly} /></div><div className="panel"><div className="panel-head"><h2>Latest annual counts</h2></div><div className="compact-ranking">{latestYears.map((item) => <div key={item.year}><span>{item.year}</span><strong>{formatNumber(item.count)}</strong></div>)}</div></div></div></section>

      <section className="oil-spill-authority"><div className="ranking-grid"><div><SectionHeading eyebrow="Geographic coverage" title="Oil spill records by Nigerian state" body="States with the most records in the current SpillFlare dataset—not a ranking of pollution or environmental harm." action={{ label: "Explore all places", href: "/places" }} /><ol className="authority-ranking">{topStates.map((item, index) => <li key={item.name}><span>{index + 1}</span><Link href={`/places/states/${slugify(item.name)}`}>{item.name} State</Link><strong>{formatNumber(item.count)} records</strong></li>)}</ol></div><div><SectionHeading eyebrow="Source operator field" title="Operators named most often in the records" body="Company names are preserved as supplied. Frequency does not establish causation, fault or legal liability." /><ol className="authority-ranking">{topOperators.map((item, index) => <li key={item.name}><span>{index + 1}</span><Link href={`/oil-spills?year=&company=${encodeURIComponent(item.name)}`}>{item.name}</Link><strong>{formatNumber(item.count)} records</strong></li>)}</ol></div></div></section>

      <section className="oil-spill-authority"><SectionHeading eyebrow="Latest trustworthy incident dates" title="Recent Nigerian oil spill records" body="These are the latest valid incident dates in the source snapshot, ordered by date and stable record ID." /><div className="panel record-list">{overview.recentRecords.map((row) => <Link className="record-row" key={row.id} href={spillPath(row.id)}><time>{formatDate(row.incidentdate, { day: "2-digit", month: "short", year: "numeric" })}</time><div><strong>{row.sitelocationname ?? row.lga ?? "Location not supplied"}</strong><p>{row.company ?? "Company not supplied"} · {stateCodes[row.statesaffected ?? ""] ?? row.statesaffected ?? "State not supplied"}</p><p>Incident {row.incidentnumber ?? row.id}</p></div><span className="status">Record</span></Link>)}</div></section>

      <section className="oil-spill-authority authority-explainer"><div className="card"><div className="card-icon"><Database size={21} /></div><h2>What does an oil spill record mean?</h2><p>An entry represents a reported incident in the underlying public source. Records differ in completeness: incident and reporting dates may differ, and fields such as location, cause or estimated quantity can be absent. An operator name is presented as supplied and does not by itself establish legal responsibility. SpillFlare organises source-backed data for public use; it does not independently verify every incident.</p><p>Estimated quantity is usable in {formatNumber(overview.volumeSupplied)} of {formatNumber(overview.indexableRecords)} indexable records, so this landing page does not present an incomplete national volume total.</p></div><div className="card"><div className="card-icon"><ArrowRight size={21} /></div><h2>Where the Nigeria oil spill data comes from</h2><p>Oil-spill records come from the public NOSDRA Oil Spill Monitor. SpillFlare preserves source fields, excludes untrustworthy dates from time-based summaries and labels missing values instead of treating them as zero. State totals use the explicit source state field and can include a record in more than one state where the source supplies multiple state codes.</p><p><Link className="text-link" href="/data-and-methods">Read SpillFlare&apos;s data and methods <ArrowRight size={15} /></Link></p><p><Link className="text-link" href="/about">About the public environmental data platform <ArrowRight size={15} /></Link></p><p><Link className="text-link" href="/gas-flares">Explore Nigeria gas flare data <ArrowRight size={15} /></Link></p></div></section>

      <section className="oil-spill-authority oil-spill-faq"><SectionHeading eyebrow="Using the database" title="Questions about oil spills in Nigeria" /><div className="faq">{faq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>
    </div>
  </>;
}
