import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CalendarRange, Info, TableProperties } from "lucide-react";
import { CompanyFlareHistory } from "@/components/company-flare-history";
import { ExportLink } from "@/components/export-link";
import { DataNote, SourceRail } from "@/components/ui";
import { getFlareRows, getMetadata } from "@/lib/data";
import { formatDate, formatNumber, formatVolume, numberOrNull } from "@/lib/format";

export const metadata: Metadata = {
  title: "Historical company flare estimates",
  description: "Explore source-supplied historical gas flare estimates by company through October 2020.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function selectedValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CompanyPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [rows, metadata] = await Promise.all([getFlareRows("company"), getMetadata()]);
  const usableRows = rows.filter((row) => row.month && numberOrNull(row.mscf) !== null);
  const months = [...new Set(usableRows.map((row) => row.month as string))].sort();
  const firstMonth = months[0];
  const finalMonth = months.at(-1) as string;
  const requestedMonth = selectedValue(params.month);
  const month = requestedMonth && months.includes(requestedMonth) ? requestedMonth : finalMonth;
  const requestedTop = Number(selectedValue(params.top) ?? 8);
  const top = [5, 8, 10, 15].includes(requestedTop) ? requestedTop : 8;

  const monthRows = usableRows
    .filter((row) => row.month === month)
    .sort((a, b) => (numberOrNull(b.mscf) ?? 0) - (numberOrNull(a.mscf) ?? 0));
  const visibleRows = monthRows.slice(0, top);
  const visibleCompanies = visibleRows.map((row) => row.name);
  const companyCoverage = new Map<string, { first: string; last: string }>();

  for (const row of usableRows) {
    const period = row.month as string;
    const coverage = companyCoverage.get(row.name);
    if (!coverage) companyCoverage.set(row.name, { first: period, last: period });
    else {
      if (period < coverage.first) coverage.first = period;
      if (period > coverage.last) coverage.last = period;
    }
  }

  const valuesByMonth = new Map<string, Map<string, number>>();
  for (const row of usableRows) {
    if (!visibleCompanies.includes(row.name)) continue;
    const period = row.month as string;
    if (!valuesByMonth.has(period)) valuesByMonth.set(period, new Map());
    valuesByMonth.get(period)?.set(row.name, numberOrNull(row.mscf) as number);
  }
  const history = months.map((period) => {
    const point: { month: string } & Record<string, string | number> = { month: period };
    for (const company of visibleCompanies) {
      const value = valuesByMonth.get(period)?.get(company);
      if (value !== undefined) point[company] = value;
    }
    return point;
  });

  const selectedTotal = monthRows.reduce((sum, row) => sum + (numberOrNull(row.mscf) ?? 0), 0);
  const selectedMonthLabel = formatDate(month, { month: "long", year: "numeric" });
  const firstMonthLabel = formatDate(firstMonth, { month: "short", year: "numeric" });
  const finalMonthLabel = formatDate(finalMonth, { month: "short", year: "numeric" });

  return (
    <>
      <section className="analytics-hero company-analytics-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/">Home</Link> / <Link href="/gas-flares">Gas flares</Link> / Historical company data
          </div>
          <div className="analytics-hero-grid">
            <div>
              <span className="eyebrow">Source-supplied company associations</span>
              <h1>Historical company flare estimates</h1>
              <p>Compare monthly tracker estimates by company across the complete supplied period. This is historical evidence, not a current company ranking.</p>
            </div>
            <ExportLink href="/api/export?dataset=flares&area=company" label="Download historical data" />
          </div>
        </div>
      </section>
      <SourceRail
        label="Nigeria Gas Flare Tracker · company aggregation"
        observation={metadata.sources.flareCompany.latestObservation}
        retrieved={metadata.retrievedAt}
      />

      <div className="wide-container company-analytics-page">
        <DataNote>
          <strong>Source coverage ends {finalMonthLabel}.</strong> This page does not infer, extend or rank company values after that month.
        </DataNote>

        <form className="company-toolbar">
          <div className="company-toolbar-intro">
            <CalendarRange size={19} />
            <div><strong>Choose a historical month</strong><span>Every option comes directly from supplied rows.</span></div>
          </div>
          <label>
            Month
            <select name="month" defaultValue={month}>
              {months.map((period) => <option key={period} value={period}>{formatDate(period, { month: "long", year: "numeric" })}</option>)}
            </select>
          </label>
          <label>
            Companies shown
            <select name="top" defaultValue={String(top)}>
              {[5, 8, 10, 15].map((count) => <option key={count} value={count}>Top {count}</option>)}
            </select>
          </label>
          <button className="button" type="submit">Apply view</button>
        </form>

        <div className="company-summary" aria-label="Historical company data summary">
          <div><span>Coverage period</span><strong>{firstMonthLabel}–{finalMonthLabel}</strong><small>{formatNumber(months.length)} supplied months</small></div>
          <div><span>Companies in dataset</span><strong>{formatNumber(companyCoverage.size)}</strong><small>Source names, including “Unknown”</small></div>
          <div><span>{selectedMonthLabel} total</span><strong>{formatVolume(selectedTotal)}</strong><small>Sum of {formatNumber(monthRows.length)} supplied company rows</small></div>
          <div><span>Current company ranking</span><strong>Not available</strong><small>No company rows after {finalMonthLabel}</small></div>
        </div>

        <section className="company-section" aria-labelledby="company-history-heading">
          <div className="analytics-section-head">
            <div><span className="section-icon teal"><BarChart3 size={19} /></span><div><span className="eyebrow">Monthly history</span><h2 id="company-history-heading">How the selected companies changed</h2><p>The lines follow the top {top} companies in {selectedMonthLabel} back through all months where each company has a supplied value.</p></div></div>
          </div>
          <div className="company-history-grid">
            <div className="analytics-card company-chart-card">
              <div className="analytics-card-head"><h2>Monthly gas flare estimate (MSCF)</h2><p>{firstMonthLabel} to {finalMonthLabel} · gaps remain gaps when the source has no row</p></div>
              <div className="chart-frame"><CompanyFlareHistory data={history} companies={visibleCompanies} /></div>
            </div>
            <aside className="company-ranking" aria-label={`${selectedMonthLabel} company ranking`}>
              <div className="panel-head"><div><span className="eyebrow">Selected month</span><h2>{selectedMonthLabel}</h2></div></div>
              <ol>
                {visibleRows.map((row, index) => <li key={row.name}><span>{index + 1}</span><strong>{row.name === "UNKNOWN" ? "Unknown" : row.name}</strong><b>{formatVolume(row.mscf)}</b></li>)}
              </ol>
              <p><Info size={15} /> “Unknown” is preserved because that is the company label supplied by the source.</p>
            </aside>
          </div>
        </section>

        <section className="company-section" aria-labelledby="company-table-heading">
          <div className="analytics-section-head">
            <div><span className="section-icon"><TableProperties size={19} /></span><div><span className="eyebrow">Company table</span><h2 id="company-table-heading">Published values for {selectedMonthLabel}</h2><p>First and last source month make each company&apos;s available historical window visible.</p></div></div>
            <ExportLink href={`/api/export?dataset=flares&area=company&period=${month}`} label="Download selected month" />
          </div>
          <div className="table-wrap company-table-wrap">
            <table className="analytics-table company-table">
              <thead><tr><th>Rank</th><th>Company</th><th className="numeric">{selectedMonthLabel} estimate</th><th>First source month</th><th>Last source month</th><th>Coverage status</th></tr></thead>
              <tbody>
                {monthRows.map((row, index) => {
                  const coverage = companyCoverage.get(row.name);
                  return <tr key={row.name}><td>{index + 1}</td><td><strong>{row.name === "UNKNOWN" ? "Unknown" : row.name}</strong></td><td className="numeric">{formatVolume(row.mscf)}</td><td>{formatDate(coverage?.first, { month: "short", year: "numeric" })}</td><td>{formatDate(coverage?.last, { month: "short", year: "numeric" })}</td><td><span className="coverage-ended">Historical coverage ended</span></td></tr>;
                })}
              </tbody>
            </table>
          </div>
          <p className="analytics-footnote"><strong>How to read this:</strong> company association is supplied or presumed by the source and does not establish legal responsibility. Values are estimates in MSCF.</p>
        </section>
      </div>
    </>
  );
}
