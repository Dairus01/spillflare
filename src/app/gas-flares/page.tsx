import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Flame, Search } from "lucide-react";
import { ExportLink } from "@/components/export-link";
import { FlareTrend } from "@/components/flare-chart";
import { NigeriaMap } from "@/components/map";
import { DataNote, Metric, SourceRail } from "@/components/ui";
import { flarePeriod, getFlareRows, getMetadata } from "@/lib/data";
import { formatNumber, formatVolume, numberOrNull, titleCase } from "@/lib/format";
import type { MapPoint } from "@/types/domain";

export const metadata: Metadata = { title: "Gas flares" };
const validAreas = ["state", "lga", "cluster", "block", "onshore_offshore"] as const;

export default async function GasFlaresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = String(params.area ?? "state");
  const area = validAreas.includes(requested as typeof validAreas[number])
    ? requested as typeof validAreas[number]
    : "state";
  const period = String(params.period ?? "2026-05");
  const query = String(params.q ?? "").toLowerCase();
  const [rows, allRows, metadata] = await Promise.all([
    flarePeriod(area, period),
    getFlareRows(area),
    getMetadata(),
  ]);
  const filtered = rows.filter((row) => !query || row.name.toLowerCase().includes(query));
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
              : undefined,
        }]
      : [];
  });
  const periodRows = allRows.filter((row) => row.month && numberOrNull(row.mscf) !== null);
  const monthTotals = new Map<string, number>();
  for (const row of periodRows) {
    monthTotals.set(row.month!, (monthTotals.get(row.month!) ?? 0) + (numberOrNull(row.mscf) ?? 0));
  }
  const trend = [...monthTotals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-18)
    .map(([month, value]) => ({ month: month.slice(2), value }));
  const total = filtered.reduce((sum, row) => sum + (numberOrNull(row.mscf) ?? 0), 0);
  const metadataKey = `flare${area === "lga" ? "Lga" : area === "onshore_offshore" ? "OnshoreOffshore" : area[0].toUpperCase() + area.slice(1)}`;

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Nigeria Gas Flare Tracker</span>
          <h1>Gas flare explorer</h1>
          <p>Compare detected flaring within one geographic level at a time. States, LGAs, clusters and oil blocks remain distinct.</p>
          <div className="button-row">
            <Link className="button secondary" href="/gas-flares/companies"><Building2 size={17} />Historical company data</Link>
          </div>
        </div>
      </section>
      <SourceRail label={`Gas Flare Tracker · ${titleCase(area)} aggregation`} observation={metadata.sources[metadataKey]?.latestObservation} retrieved={metadata.retrievedAt} />
      <div className="wide-container page-pad">
        <form className="filter-bar">
          <div className="filter-group">
            <label htmlFor="area">Geographic level</label>
            <select id="area" name="area" defaultValue={area}>{validAreas.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}</select>
          </div>
          <div className="filter-group">
            <label htmlFor="period">Month</label>
            <input id="period" name="period" type="month" defaultValue={period} min="2012-03" max="2026-05" />
          </div>
          <div className="filter-group">
            <label htmlFor="flare-search">Find within results</label>
            <input id="flare-search" name="q" defaultValue={String(params.q ?? "")} placeholder="Name" />
          </div>
          <button className="button"><Search size={16} />Apply</button>
          <div className="filter-spacer" />
          <Link className="button ghost" href="/gas-flares/companies"><Building2 size={16} />Company history</Link>
          <ExportLink href={`/api/export?dataset=flares&area=${area}&period=${period}`} />
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
          <Metric label="Latest coverage" value="May 2026" detail="Company view ends Oct 2020" />
        </div>
        <div className="split">
          <NigeriaMap points={points} height={610} center={[6.2, 5.8]} zoom={7} />
          <div className="panel">
            <div className="panel-head"><h2>Largest reported values</h2><span className="mono">{period}</span></div>
            <div className="record-list">
              {filtered.slice(0, 12).map((row, index) => <Link className="record-row" key={row.name} href={area === "cluster" ? `/gas-flares/clusters/${row.name}` : area === "block" ? `/oil-blocks/${row.name.toLowerCase().replace(/\s+/g, "-")}` : `/search?q=${encodeURIComponent(row.name)}`}><time>#{String(index + 1).padStart(2, "0")}</time><div><strong>{row.name}</strong><p>{formatVolume(row.mscf)}</p></div><span className="status warning"><Flame size={12} />Detected</span></Link>)}
            </div>
          </div>
        </div>
        <div className="panel" style={{ marginTop: 22 }}>
          <div className="panel-head"><h2>Recent national trend for this aggregation</h2><span className="mono">Values are summed within {titleCase(area)}</span></div>
          <div className="panel-body"><FlareTrend data={trend} /></div>
        </div>
      </div>
    </>
  );
}
