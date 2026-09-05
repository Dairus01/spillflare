import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Search } from "lucide-react";
import { ExportLink } from "@/components/export-link";
import { NigeriaMap } from "@/components/map";
import { DataNote, SourceRail } from "@/components/ui";
import { getMetadata, getSpills, spillCoordinates } from "@/lib/data";
import { codedLabel, formatDate, formatNumber, stateCodes } from "@/lib/format";
import type { MapPoint } from "@/types/domain";
export const metadata: Metadata = {
  title: "Nigeria Oil Spill Tracker & Incident Records",
  description:
    "Explore reported oil spills across Nigeria by date, company and location using searchable NOSDRA incident records, maps and source evidence.",
  alternates: { canonical: "/oil-spills" },
  openGraph: {
    title: "Nigeria Oil Spill Tracker & Incident Records",
    description:
      "Search reported oil spills across Nigeria and inspect maps, source fields and official evidence.",
    url: "/oil-spills",
  },
};
export default async function OilSpillsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = String(params.q ?? "")
    .trim()
    .toLowerCase();
  const year = String(params.year ?? "2026");
  const company = String(params.company ?? "");
  const page = Math.max(1, Number(params.page ?? 1));
  const pageSize = 30;
  const [rows, metadata] = await Promise.all([getSpills(), getMetadata()]);
  const filtered = rows
    .filter(
      (row) =>
        (!year || row.incidentdate?.startsWith(year)) &&
        (!company || row.company === company) &&
        (!query ||
          [
            row.incidentnumber,
            row.sitelocationname,
            row.company,
            row.lga,
            row.statesaffected,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)),
    )
    .sort((a, b) =>
      String(b.incidentdate).localeCompare(String(a.incidentdate)),
    );
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const companies = [
    ...new Set(rows.map((row) => row.company).filter(Boolean) as string[]),
  ].sort();
  const points: MapPoint[] = filtered.slice(0, 400).flatMap((row) => {
    const c = spillCoordinates(row);
    return c
      ? [
          {
            id: row.id,
            ...c,
            title: `Incident ${row.incidentnumber ?? row.id}`,
            subtitle: row.sitelocationname,
            kind: "spill" as const,
            href: `/oil-spills/${row.incidentnumber ?? row.id}`,
          },
        ]
      : [];
  });
  const queryString = new URLSearchParams({
    year,
    ...(company ? { company } : {}),
    ...(query ? { q: query } : {}),
  }).toString();
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">NOSDRA oil spill records</span>
          <h1>Nigeria Oil Spill Tracker</h1>
          <p>
            Search reported oil spill incidents across Nigeria, inspect NOSDRA
            source fields and open evidence without treating unknown quantities
            as zero.
          </p>
          <div className="button-row">
            <Link className="button secondary" href="/oil-spills/analytics">
              <BarChart3 size={16} />
              Explore spill analytics
            </Link>
          </div>
        </div>
      </section>
      <SourceRail
        label="NOSDRA Oil Spill Monitor"
        observation={metadata.sources.spillsPrimary.latestObservation}
        retrieved={metadata.retrievedAt}
      />
      <div className="wide-container page-pad">
        <form className="filter-bar">
          <div className="filter-group">
            <label htmlFor="spill-search">Search</label>
            <input
              id="spill-search"
              name="q"
              defaultValue={String(params.q ?? "")}
              placeholder="Incident, place or company"
            />
          </div>
          <div className="filter-group">
            <label htmlFor="year">Incident year</label>
            <select id="year" name="year" defaultValue={year}>
              <option value="">All years</option>
              {Array.from({ length: 21 }, (_, i) => 2026 - i).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label htmlFor="company">Company</label>
            <select id="company" name="company" defaultValue={company}>
              <option value="">All companies</option>
              {companies.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <button className="button" type="submit">
            <Search size={16} />
            Apply filters
          </button>
          <div className="filter-spacer" />
          <ExportLink href={`/api/export?dataset=spills&${queryString}`} />
        </form>
        <DataNote>
          <strong>{formatNumber(filtered.length)} matching records.</strong>{" "}
          Offshore coordinates are valid. Records with missing or unusable
          coordinates remain in the list but are not plotted.
        </DataNote>
        <div className="split" style={{ marginTop: 18 }}>
          <NigeriaMap
            points={points}
            height={610}
            center={[6.2, 5.8]}
            zoom={7}
          />
          <div className="panel">
            <div className="panel-head">
              <h2>Matching incidents</h2>
              <span className="mono">Page {page}</span>
            </div>
            <div className="record-list">
              {paged.slice(0, 12).map((row) => (
                <Link
                  className="record-row"
                  key={row.id}
                  href={`/oil-spills/${row.incidentnumber ?? row.id}`}
                >
                  <time>
                    {formatDate(row.incidentdate, {
                      day: "2-digit",
                      month: "short",
                      year: "2-digit",
                    })}
                  </time>
                  <div>
                    <strong>
                      {row.incidentnumber ?? row.id} ·{" "}
                      {row.company ?? "Company not supplied"}
                    </strong>
                    <p>{row.sitelocationname ?? "Location not supplied"}</p>
                    <p>
                      {codedLabel("contaminant", row.contaminant)} ·{" "}
                      {row.lga ?? "LGA not supplied"},{" "}
                      {stateCodes[row.statesaffected ?? ""] ??
                        row.statesaffected ??
                        "State not supplied"}
                    </p>
                  </div>
                  <span className="status">{row.status ?? "Recorded"}</span>
                </Link>
              ))}
            </div>
            <div className="panel-head">
              <Link
                className="button ghost"
                aria-disabled={page === 1}
                href={`?${queryString}&page=${Math.max(1, page - 1)}`}
              >
                Previous
              </Link>
              <Link
                className="button ghost"
                href={`?${queryString}&page=${page + 1}`}
              >
                Next
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
