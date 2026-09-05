import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BarChart3, CalendarRange, TableProperties } from "lucide-react";
import { CompanyPerformanceTable, SpillAnalyticsCharts } from "@/components/spill-analytics";
import { DataNote, SourceRail } from "@/components/ui";
import { getMetadata, getSpills } from "@/lib/data";
import { formatNumber } from "@/lib/format";
import { buildSpillAnalytics, spillYears } from "@/lib/spill-analytics";

export const metadata: Metadata = {
  title: "Oil spill analytics",
  description: "Compare Nigeria's reported oil spills by company, cause, month and state using NOSDRA source records.",
  alternates: { canonical: "/oil-spills/analytics" },
};

export default async function OilSpillAnalyticsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const params = await searchParams;
  const [rows, sourceMetadata] = await Promise.all([getSpills(), getMetadata()]);
  const years = spillYears(rows);
  const requestedYear = String(params.year ?? "2025");
  const year = years.includes(requestedYear) ? requestedYear : years[0] ?? "2025";
  const analytics = buildSpillAnalytics(rows, year);
  const isCurrentPartialYear = year === new Date().getUTCFullYear().toString();

  return (
    <>
      <section className="analytics-hero">
        <div className="container">
          <div className="breadcrumbs"><Link href="/oil-spills">Oil spills</Link> / Analytics</div>
          <div className="analytics-hero-grid">
            <div>
              <span className="eyebrow">NOSDRA source analysis</span>
              <h1>Oil spill patterns, compared clearly.</h1>
              <p>Explore reported incidents by company, cause, month and state. Every total is calculated from the selected year&apos;s source rows.</p>
            </div>
            <div className="analytics-hero-actions">
              <Link className="button secondary" href="/oil-spills"><ArrowLeft size={16} />Incident explorer</Link>
            </div>
          </div>
        </div>
      </section>
      <SourceRail label="NOSDRA Oil Spill Monitor · calculated from incident rows" observation={sourceMetadata.sources.spillsPrimary.latestObservation} retrieved={sourceMetadata.retrievedAt} />

      <main className="wide-container analytics-page">
        <form className="analytics-toolbar">
          <div><CalendarRange size={18} /><div><label htmlFor="analytics-year">Reporting year</label><span>Change every table and chart together</span></div></div>
          <select id="analytics-year" name="year" defaultValue={year}>
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button className="button" type="submit">Update analysis</button>
        </form>

        {isCurrentPartialYear && <DataNote><strong>{year} is still in progress.</strong> These totals cover only records presently supplied by the source and should not be compared with full calendar years as if coverage were equal.</DataNote>}

        <section className="analytics-summary" aria-label={`${year} summary`}>
          <div><span>Reported spills</span><strong>{formatNumber(analytics.totalSpills)}</strong><small>incident rows</small></div>
          <div><span>Estimated quantity</span><strong>{formatNumber(analytics.totalVolume, 2)}</strong><small>bbl, supplied values only</small></div>
          <div><span>Quantity supplied</span><strong>{formatNumber(analytics.quantitySupplied)}</strong><small>of {formatNumber(analytics.totalSpills)} records</small></div>
          <div><span>JIV date supplied</span><strong>{formatNumber(analytics.jivSupplied)}</strong><small>{formatNumber(analytics.noJiv)} records without a date</small></div>
        </section>

        <section className="analytics-section">
          <div className="analytics-section-head">
            <div><span className="section-icon"><TableProperties size={19} /></span><div><span className="eyebrow">Company comparison</span><h2>Reporting completeness and spill totals, {year}</h2><p>Click a column heading to reorder the table. Company names remain exactly as supplied, so historical operators are not silently merged.</p></div></div>
          </div>
          <CompanyPerformanceTable rows={analytics.companies} />
          <p className="analytics-footnote"><strong>Reading this table:</strong> “No JIV date” means the date field is blank in the source row. “No quantity” means no estimated quantity was supplied. Neither is a legal finding or a company compliance score.</p>
        </section>

        <section className="analytics-section">
          <div className="analytics-section-head">
            <div><span className="section-icon teal"><BarChart3 size={19} /></span><div><span className="eyebrow">Patterns over time and place</span><h2>Four views of the same {year} records</h2><p>Counts and estimated quantities are kept separate so a missing quantity never erases a reported incident.</p></div></div>
          </div>
          <SpillAnalyticsCharts monthly={analytics.monthly} states={analytics.states} />
        </section>

        <DataNote><strong>Cause grouping used here:</strong> “Sabotage / theft” is source code <span className="mono">sab</span>. “Operational issues” combines equipment failure, corrosion and operational/maintenance error codes. Every other or blank cause remains “Other / unspecified.”</DataNote>
      </main>
    </>
  );
}
