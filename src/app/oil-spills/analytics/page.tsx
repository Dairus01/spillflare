import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BarChart3, CalendarRange, Database, Download, TableProperties } from "lucide-react";
import { CompanyPerformanceTable, SpillAnalyticsCharts } from "@/components/spill-analytics";
import { NationalSpillTrend } from "@/components/national-spill-trend";
import { DataNote, SourceRail } from "@/components/ui";
import { getMetadata, getSpills } from "@/lib/data";
import { formatDate, formatNumber, slugify, spillPath } from "@/lib/format";
import { buildNationalSpillOverview } from "@/lib/spill-overview";
import { buildSpillAnalytics, spillYears } from "@/lib/spill-analytics";
import { parseW3cDate } from "@/lib/sitemap-date";
import { siteUrl } from "@/lib/site";

const title = "Nigeria Oil Spill Statistics & Trends";
const description = "Explore Nigeria oil spill statistics and yearly trends from public NOSDRA records. Compare trusted incident-date source records by year, state, operator and reported cause with SpillFlare.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/oil-spills/analytics" },
  openGraph: { title, description, url: "/oil-spills/analytics" },
};

function percent(value: number, total: number) {
  return total ? `${Math.round((value / total) * 100)}%` : "0%";
}

function signedPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export default async function OilSpillAnalyticsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const params = await searchParams;
  const [rows, sourceMetadata] = await Promise.all([getSpills(), getMetadata()]);
  const retrievedAt = parseW3cDate(sourceMetadata.retrievedAt);
  const overview = buildNationalSpillOverview(rows, retrievedAt);
  const years = spillYears(rows, retrievedAt);
  const requestedYear = String(params.year ?? "2025");
  const year = years.includes(requestedYear) ? requestedYear : years[0] ?? "2025";
  const analytics = buildSpillAnalytics(rows, year, retrievedAt);
  const yearIndex = overview.yearly.findIndex((item) => item.year === year);
  const previous = yearIndex > 0 ? overview.yearly[yearIndex - 1] : null;
  const yearChange = previous ? analytics.totalSpills - previous.count : null;
  const yearChangePercent = previous?.count ? (yearChange! / previous.count) * 100 : null;
  const currentYear = new Date().getUTCFullYear().toString();
  const isCurrentPartialYear = year === currentYear;
  const snapshotDate = formatDate(sourceMetadata.retrievedAt.slice(0, 10));
  const completeness = analytics.completeness;

  const faq = [
    { question: "How does SpillFlare calculate yearly oil spill statistics?", answer: "Yearly totals count indexable source records whose incident date passes SpillFlare's trusted-date checks and falls in the selected calendar year. SpillFlare does not substitute a report date when a trusted incident date is unavailable." },
    { question: "Why can SpillFlare's annual totals differ from previously published figures?", answer: "The public source can be revised over time, and historical publications may use an earlier snapshot or a different counting method. SpillFlare reports what is present in its current source snapshot and documents the date used." },
    { question: "Does one SpillFlare record always represent one unique oil spill?", answer: "No. One row is a source incident record. Incident numbers can repeat and the dataset is not currently a reliable model of independently verified unique physical spill events." },
    { question: "What is the difference between incident date and report date?", answer: "Incident date describes when the source says an incident occurred, while report date describes when it was reported. Analytics group records by trusted incident date; the two fields can differ." },
    { question: "Where does SpillFlare's oil spill data come from?", answer: "SpillFlare organizes public oil-spill records sourced from the Nigerian Oil Spill Monitor (NOSDRA), then provides search, maps and derived summaries with the source context available on each record." },
    { question: "Can I download the records behind these statistics?", answer: "Yes. The oil-spill explorer provides a CSV export of the source records, including the selected-year view where available." },
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": `${siteUrl}/oil-spills/analytics#webpage`, url: `${siteUrl}/oil-spills/analytics`, name: title, description, isPartOf: { "@id": `${siteUrl}/#website` }, about: { "@id": `${siteUrl}/oil-spills#dataset` }, mainEntity: { "@id": `${siteUrl}/oil-spills#dataset` } },
      { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: siteUrl }, { "@type": "ListItem", position: 2, name: "Oil spills", item: `${siteUrl}/oil-spills` }, { "@type": "ListItem", position: 3, name: "Analytics", item: `${siteUrl}/oil-spills/analytics` }] },
      { "@type": "FAQPage", mainEntity: faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <section className="analytics-hero"><div className="container"><div className="breadcrumbs"><Link href="/oil-spills">Oil spills</Link> / Analytics</div><div className="analytics-hero-grid"><div><span className="eyebrow">NOSDRA source analysis</span><h1>Nigeria Oil Spill Statistics and Trends</h1><p>Explore yearly patterns in Nigeria&apos;s public oil-spill records using SpillFlare&apos;s current NOSDRA source snapshot. Annual figures count source records carrying trusted incident dates; they are not independently deduplicated counts of unique physical spill events.</p></div><div className="analytics-hero-actions"><Link className="button secondary" href="/oil-spills"><ArrowLeft size={16} />Incident explorer</Link></div></div></div></section>
      <SourceRail label="NOSDRA Oil Spill Monitor · calculated from trusted incident-date records" observation={sourceMetadata.sources.spillsPrimary.latestObservation} retrieved={sourceMetadata.retrievedAt} />

      <main className="wide-container analytics-page">
        <section className="analytics-intro panel" aria-label="Statistics scope"><div><span className="eyebrow">Current source snapshot</span><h2>How to read these statistics</h2><p>Snapshot retrieved {snapshotDate}. The public source may be revised, so historical totals can change when the source is updated. SpillFlare preserves the source row as supplied and does not treat an operator label or reported cause as an independent finding of liability or fault.</p></div><div className="analytics-intro-links"><Link className="text-link" href="/data-and-methods">Read the data and methods</Link><Link className="text-link" href="/data-license">Review data reuse terms</Link></div></section>

        <section className="analytics-section analytics-national" aria-labelledby="national-trend-heading"><div className="analytics-section-head"><div><span className="section-icon"><BarChart3 size={19} /></span><div><span className="eyebrow">National yearly overview</span><h2 id="national-trend-heading">Nigeria oil spill records by year</h2><p>Trusted incident-date source record counts across the current snapshot ({overview.earliestYear ?? "—"}–{overview.latestYear ?? "—"}).</p></div></div></div><NationalSpillTrend data={overview.yearly} /><div className="analytics-year-table table-wrap"><table className="analytics-table"><caption>Trusted incident-date source records by year</caption><thead><tr><th>Year</th><th className="numeric">Records</th><th>Explore</th></tr></thead><tbody>{overview.yearly.map((item) => <tr key={item.year}><th scope="row">{item.year}{item.year === currentYear && <small className="current-year-note">Current snapshot</small>}</th><td className="numeric"><strong>{formatNumber(item.count)}</strong></td><td><Link className="text-link" href={`/oil-spills/analytics?year=${item.year}`}>View {item.year}</Link></td></tr>)}</tbody></table></div>{overview.yearly.some((item) => item.year === currentYear) && <p className="analytics-footnote"><strong>{currentYear} is an incomplete current-year snapshot.</strong> Its count reflects records currently supplied by the source, not a completed calendar-year total.</p>}</section>

        <form className="analytics-toolbar"><div><CalendarRange size={18} /><div><label htmlFor="analytics-year">Analysis year</label><span>Change every table, chart and metric together</span></div></div><select id="analytics-year" name="year" defaultValue={year}>{years.map((item) => <option key={item} value={item}>{item}</option>)}</select><button className="button" type="submit">Update analysis</button></form>
        {isCurrentPartialYear && <DataNote><strong>{year} is still in progress.</strong> These totals cover only records presently supplied by the source and should not be compared with full calendar years as if coverage were equal.</DataNote>}

        <section className="analytics-section" aria-labelledby="selected-year-heading"><div className="analytics-section-head"><div><span className="section-icon teal"><Database size={19} /></span><div><span className="eyebrow">Selected-year summary</span><h2 id="selected-year-heading">{year} Nigeria oil spill record statistics</h2><p>{formatNumber(analytics.totalSpills)} indexable source records carry a trusted {year} incident date in this snapshot.</p></div></div></div><div className="analytics-summary" aria-label={`${year} headline statistics`}><div><span>Trusted incident-date records</span><strong>{formatNumber(analytics.totalSpills)}</strong><small>source rows</small></div><div><span>Incident number supplied</span><strong>{formatNumber(analytics.incidentNumbersSupplied)}</strong><small>{formatNumber(analytics.missingIncidentNumbers)} missing</small></div><div><span>Distinct normalized incident-number strings</span><strong>{formatNumber(analytics.uniqueIncidentNumbers)}</strong><small>not unique event identifiers</small></div><div><span>Report date supplied</span><strong>{formatNumber(completeness.reportDateSupplied)}</strong><small>{formatNumber(completeness.reportYearMismatch)} differ in year</small></div></div>{previous && <div className="analytics-comparison"><strong>{year}: {formatNumber(analytics.totalSpills)} records{isCurrentPartialYear ? " (current snapshot)" : ""}</strong><span>Previous trusted year ({previous.year}): {formatNumber(previous.count)}</span>{isCurrentPartialYear ? <span>Percentage comparison is withheld because {year} is an incomplete current-year snapshot.</span> : <span className={yearChange! >= 0 ? "positive" : "negative"}>{signedPercent(yearChangePercent!)} ({yearChange! >= 0 ? "increase" : "decrease"} in source-record count)</span>}</div>}</section>

        <section className="analytics-section" aria-labelledby="completeness-heading"><div className="analytics-section-head"><div><span className="section-icon"><TableProperties size={19} /></span><div><span className="eyebrow">Data quality context</span><h2 id="completeness-heading">Completeness of the selected records</h2><p>These measures describe whether source fields are supplied; they are not a score for a company, state or incident.</p></div></div></div><div className="analytics-completeness-grid">{[["Incident number", completeness.incidentNumberSupplied], ["Report date", completeness.reportDateSupplied], ["JIV date", completeness.jivDateSupplied], ["Estimated quantity", completeness.quantitySupplied], ["Resolved state", completeness.stateResolved], ["Operator label", completeness.operatorSupplied], ["Reported cause", completeness.causeSupplied]].map(([label, value]) => <div key={label as string}><span>{label}</span><strong>{percent(value as number, analytics.totalSpills)}</strong><small>{formatNumber(value)} of {formatNumber(analytics.totalSpills)} records</small></div>)}</div><p className="analytics-footnote"><strong>Incident date and report date are different source fields.</strong> Yearly grouping uses the trusted incident date only; a report date is not used as a fallback when the incident date is missing or rejected.</p></section>

        <section className="analytics-section"><div className="analytics-section-head"><div><span className="section-icon"><TableProperties size={19} /></span><div><span className="eyebrow">Operator labels</span><h2>Source records by operator label, {year}</h2><p>Labels are shown as supplied. Frequency in the source dataset is not a finding of responsibility or environmental performance.</p></div></div></div><CompanyPerformanceTable rows={analytics.companies} /><p className="analytics-footnote"><strong>Reading this table:</strong> “No JIV date” means the date field is blank in the source row. “No quantity” means no estimated quantity was supplied.</p></section>

        <section className="analytics-section"><div className="analytics-section-head"><div><span className="section-icon teal"><BarChart3 size={19} /></span><div><span className="eyebrow">Patterns over time and place</span><h2>Reported causes and state distribution, {year}</h2><p>Counts and estimated quantities remain separate so a missing quantity never erases a source record.</p></div></div></div><SpillAnalyticsCharts monthly={analytics.monthly} states={analytics.states} /><div className="analytics-ranking-grid"><div><h3>States with the most source records</h3><ol className="compact-ranking">{analytics.states.map((state) => <li key={state.name}><Link href={`/places/states/${slugify(state.name)}`}>{state.name}</Link><strong>{formatNumber(state.value)}</strong></li>)}</ol><p className="analytics-footnote">State counts use explicit, resolvable source state fields. Location prose is not used to infer state membership.</p></div><div><h3>Reported cause groups</h3><ul className="compact-ranking">{[["Sabotage / theft", analytics.causeTotals.sabotage], ["Operational issues", analytics.causeTotals.operational], ["Other / unspecified", analytics.causeTotals.other]].map(([label, value]) => <li key={label as string}><span>{label}</span><strong>{formatNumber(value)}</strong></li>)}</ul><p className="analytics-footnote">Cause groups reflect the source codes used by this page; “other / unspecified” includes blank or unclassified values.</p></div></div></section>

        <section className="analytics-section"><div className="analytics-section-head"><div><span className="section-icon"><Database size={19} /></span><div><span className="eyebrow">Evidence behind the totals</span><h2>Recent {year} source records</h2><p>Open a stable record page to inspect the underlying fields and source context.</p></div></div></div><div className="analytics-record-list">{analytics.recentRecords.map((row) => <Link className="record-row" href={spillPath(row.id)} key={row.id}><span><strong>{row.sitelocationname || "Location not supplied"}</strong><small>{row.company || "Operator not supplied"} · {row.incidentnumber || "Incident number not supplied"}</small></span><time dateTime={row.incidentdate ?? undefined}>{formatDate(row.incidentdate)}</time></Link>)}</div><div className="analytics-resource-links"><Link className="button secondary" href="/oil-spills">Search all oil spill records</Link><a className="button secondary" href={`/api/export?dataset=spills&year=${year}`}><Download size={16} />Download {year} CSV</a></div></section>

        <section className="analytics-section analytics-methods" aria-labelledby="methods-heading"><div className="analytics-section-head"><div><span className="section-icon"><Database size={19} /></span><div><span className="eyebrow">Methodology</span><h2 id="methods-heading">What these annual statistics represent</h2></div></div></div><p>SpillFlare is a search, mapping and analysis layer over public environmental records. One row represents a source incident record, not necessarily an independently verified unique physical event. Repeated incident numbers and similar-looking records can occur, so normalized incident-number counts are shown for context rather than presented as unique spill totals.</p><p>The current snapshot may differ from historical figures published from earlier source snapshots or different definitions. That does not by itself mean either figure is incorrect. Review the full <Link className="text-link" href="/data-and-methods">data and methods documentation</Link> and the <Link className="text-link" href="/data-license">data reuse policy</Link> before reusing the numbers.</p></section>

        <section className="analytics-section analytics-faq" aria-labelledby="faq-heading"><div className="analytics-section-head"><div><span className="section-icon teal"><TableProperties size={19} /></span><div><span className="eyebrow">Questions researchers ask</span><h2 id="faq-heading">Nigeria oil spill statistics FAQ</h2></div></div></div><div className="faq">{faq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>
      </main>
    </>
  );
}
