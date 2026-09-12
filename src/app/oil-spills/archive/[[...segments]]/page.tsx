import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getMetadata, getSpills } from "@/lib/data";
import {
  archiveGroups,
  archivePageCount,
  archivePageSize,
  archiveYearPath,
  undatedArchiveKey,
} from "@/lib/crawl-archive";
import { formatDate, formatNumber, spillPath } from "@/lib/format";
import { parseW3cDate } from "@/lib/sitemap-date";

type ArchiveSelection = { year?: string; page: number };

function parseSegments(segments: string[] | undefined): ArchiveSelection | null {
  if (!segments?.length) return { page: 1 };
  if (segments.length === 2 && segments[0] === "year") {
    return { year: segments[1], page: 1 };
  }
  if (
    segments.length === 4 &&
    segments[0] === "year" &&
    segments[2] === "page" &&
    /^\d+$/.test(segments[3])
  ) {
    return { year: segments[1], page: Number(segments[3]) };
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}): Promise<Metadata> {
  const selection = parseSegments((await params).segments);
  if (!selection) return { title: "Oil spill archive not found" };
  const canonical = selection.year
    ? archiveYearPath(selection.year, selection.page)
    : "/oil-spills/archive";
  const label = selection.year === undatedArchiveKey ? "records without a trusted year" : selection.year;
  return {
    title: selection.year
      ? `Nigeria oil spill archive: ${label}${selection.page > 1 ? `, page ${selection.page}` : ""}`
      : "Nigeria oil spill record archive",
    alternates: { canonical },
  };
}

export default async function OilSpillArchivePage({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const selection = parseSegments((await params).segments);
  if (!selection) notFound();
  const [spills, metadata] = await Promise.all([getSpills(), getMetadata()]);
  const groups = archiveGroups(spills, parseW3cDate(metadata.retrievedAt));

  if (!selection.year) {
    return <>
      <section className="page-hero"><div className="container"><span className="eyebrow">NOSDRA oil spill records</span><h1>Nigeria oil spill record archive</h1><p>Browse indexable source records by trustworthy incident year. Records without a trustworthy year remain available in a separate archive group.</p></div></section>
      <div className="container page-pad"><div className="breadcrumbs"><Link href="/oil-spills">Oil spills</Link> / Archive</div><div className="card-grid">{groups.map(([year, rows]) => <Link className="card interactive" href={archiveYearPath(year)} key={year}><h2>{year === undatedArchiveKey ? "Year not reliably supplied" : year}</h2><p>{formatNumber(rows.length)} indexable incident records</p><div className="card-meta"><span>{archivePageCount(rows)} archive {archivePageCount(rows) === 1 ? "page" : "pages"}</span><ArrowRight size={16} /></div></Link>)}</div></div>
    </>;
  }

  const rows = groups.find(([year]) => year === selection.year)?.[1];
  if (!rows) notFound();
  const totalPages = archivePageCount(rows);
  if (selection.page < 1 || selection.page > totalPages) notFound();
  const pageRows = rows.slice((selection.page - 1) * archivePageSize, selection.page * archivePageSize);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);
  const label = selection.year === undatedArchiveKey ? "Year not reliably supplied" : selection.year;

  return <>
    <section className="page-hero"><div className="container"><span className="eyebrow">Nigeria oil spill archive</span><h1>{label}</h1><p>{formatNumber(rows.length)} indexable source records across {formatNumber(totalPages)} archive pages.</p></div></section>
    <div className="container page-pad"><div className="breadcrumbs"><Link href="/oil-spills">Oil spills</Link> / <Link href="/oil-spills/archive">Archive</Link> / {label}</div><section className="panel"><div className="panel-head"><h2>Incident records</h2><span className="mono">Page {selection.page} of {totalPages}</span></div><div className="record-list">{pageRows.map((row) => <Link className="record-row" href={spillPath(row.id)} key={row.id}><time>{formatDate(row.incidentdate)}</time><div><strong>{row.incidentnumber ?? row.id} · {row.company ?? "Company not supplied"}</strong><p>{row.sitelocationname ?? "Location not supplied"}</p></div><span className="status">Record</span></Link>)}</div><nav className="state-pagination" aria-label={`${label} archive pages`}><div>{selection.page > 1 ? <Link className="button ghost" rel="prev" href={archiveYearPath(selection.year, selection.page - 1)}><ArrowLeft size={15} />Previous</Link> : <span className="button ghost disabled"><ArrowLeft size={15} />Previous</span>}{selection.page < totalPages ? <Link className="button ghost" rel="next" href={archiveYearPath(selection.year, selection.page + 1)}>Next<ArrowRight size={15} /></Link> : <span className="button ghost disabled">Next<ArrowRight size={15} /></span>}</div></nav></section><nav className="pagination-pages" aria-label="Archive page numbers">{pageNumbers.map((page) => page === selection.page ? <span aria-current="page" key={page}>{page}</span> : <Link href={archiveYearPath(selection.year!, page)} key={page}>{page}</Link>)}</nav></div>
  </>;
}
