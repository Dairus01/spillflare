import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileImage, FileText, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { NigeriaMap } from "@/components/map";
import { DataNote, SourceRail } from "@/components/ui";
import {
  findSpill,
  getFlareRows,
  getMetadata,
  getSpills,
  parseAttachments,
  spillCoordinates,
} from "@/lib/data";
import { codedLabel, formatDate, formatNumber, slugify, spillPath, stateCodes } from "@/lib/format";
import type { MapPoint } from "@/types/domain";
import { isIndexableSpill, spillSeoDescription, spillSeoTitle, spillStateName, spillYear } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import { spillMentionsBlock } from "@/lib/geo-relations";
import { concessionIdentityNames } from "@/data/concession-lineage";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const row = await findSpill(id);
  return {
    title: row ? spillSeoTitle(row) : "Oil spill not found",
    description: row ? spillSeoDescription(row) : undefined,
    alternates: row ? { canonical: spillPath(row.id) } : undefined,
    robots: row && !isIndexableSpill(row) ? { index: false, follow: true } : undefined,
    openGraph: row ? {
      title: spillSeoTitle(row),
      description: spillSeoDescription(row),
      type: "article",
      url: spillPath(row.id),
    } : undefined,
  };
}
export default async function SpillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [row, metadata, allSpills, blockRows] = await Promise.all([findSpill(id), getMetadata(), getSpills(), getFlareRows("block")]);
  if (!row) notFound();
  const stateName = spillStateName(row);
  const year = spillYear(row);
  const coordinates = spillCoordinates(row);
  const attachments = parseAttachments(row);
  const point: MapPoint[] = coordinates
    ? [
        {
          id: row.id,
          ...coordinates,
          title: `Incident ${row.incidentnumber ?? row.id}`,
          subtitle: row.sitelocationname,
          kind: "spill",
        },
      ]
    : [];
  const relatedSpills = allSpills
    .filter((candidate) =>
      candidate.id !== row.id &&
      ((row.statesaffected && candidate.statesaffected === row.statesaffected) ||
        (row.company && candidate.company === row.company)),
    )
    .sort((a, b) => String(b.incidentdate ?? "").localeCompare(String(a.incidentdate ?? "")))
    .slice(0, 5);
  const relatedBlocks = [...new Set(blockRows.map((block) => block.name))]
    .filter((blockName) =>
      concessionIdentityNames(blockName).some((identity) =>
        spillMentionsBlock(row, identity),
      ),
    );
  const recordPath = spillPath(row.id);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${siteUrl}${recordPath}/#webpage`,
        url: `${siteUrl}${recordPath}`,
        name: spillSeoTitle(row),
        description: spillSeoDescription(row),
        isPartOf: { "@id": `${siteUrl}/#website` },
        datePublished: row.incidentdate || undefined,
        about: row.company ? { "@type": "Organization", name: row.company } : undefined,
        spatialCoverage: stateName ? { "@type": "AdministrativeArea", name: `${stateName} State, Nigeria` } : undefined,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Oil spills", item: `${siteUrl}/oil-spills` },
          ...(stateName ? [{ "@type": "ListItem", position: 2, name: stateName, item: `${siteUrl}/places/states/${slugify(stateName)}` }] : []),
          { "@type": "ListItem", position: stateName ? 3 : 2, name: `Incident ${row.incidentnumber ?? row.id}`, item: `${siteUrl}${recordPath}` },
        ],
      },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <section className="detail-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/oil-spills">Oil spills</Link> / {stateName ? <><Link href={`/places/states/${slugify(stateName)}`}>{stateName}</Link> / </> : null}Incident{" "}
            {row.incidentnumber ?? row.id}
          </div>
          <div className="detail-title">
            <div>
              <span className="badge">{row.status ?? "Recorded"}</span>
              <h1>Oil Spill at {row.sitelocationname ?? row.lga ?? stateName ?? "Location Not Supplied"}</h1>
              <p>Incident {row.incidentnumber ?? row.id}{row.company ? ` · ${row.company}` : ""}{row.incidentdate ? ` · ${formatDate(row.incidentdate)}` : ""}</p>
            </div>
            <Link className="button secondary" href="/oil-spills">
              <ArrowLeft size={16} />
              Back to explorer
            </Link>
          </div>
        </div>
      </section>
      <SourceRail
        label="NOSDRA Oil Spill Monitor · source record"
        observation={row.incidentdate}
        retrieved={metadata.retrievedAt}
      />
      <div className="container page-pad">
        <div className="metric-grid" style={{ marginBottom: 22 }}>
          <div className="metric">
            <span>Incident date</span>
            <strong>
              {formatDate(row.incidentdate, {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </strong>
            <small>Source field: incidentdate</small>
          </div>
          <div className="metric">
            <span>Estimated quantity</span>
            <strong>
              {row.estimatedquantity
                ? `${formatNumber(row.estimatedquantity, 2)} bbl`
                : "Not supplied"}
            </strong>
            <small>An estimate where the source supplies one</small>
          </div>
          <div className="metric">
            <span>Quantity recovered</span>
            <strong>
              {row.quantityrecovered
                ? `${formatNumber(row.quantityrecovered, 2)} bbl`
                : "Not supplied"}
            </strong>
            <small>Not assumed to be zero</small>
          </div>
          <div className="metric">
            <span>Evidence</span>
            <strong>{formatNumber(attachments.length)}</strong>
            <small>Source attachment links</small>
          </div>
        </div>
        <div className="detail-layout">
          <div>
            <div className="panel">
              <div className="panel-head">
                <h2>Incident location</h2>
                {coordinates && (
                  <span className="mono">
                    <MapPin size={13} /> {coordinates.lat.toFixed(5)},{" "}
                    {coordinates.lng.toFixed(5)}
                  </span>
                )}
              </div>
              {coordinates ? (
                <NigeriaMap
                  points={point}
                  height={420}
                  center={[coordinates.lat, coordinates.lng]}
                  zoom={12}
                />
              ) : (
                <DataNote>
                  The source does not supply usable coordinates for this
                  incident. The textual location remains available below.
                </DataNote>
              )}
            </div>
            <div className="panel" style={{ marginTop: 22 }}>
              <div className="panel-head">
                <h2>Source fields in plain language</h2>
              </div>
              <div className="facts">
                <Fact label="Company" value={row.company} />
                <Fact label="Reported" value={formatDate(row.reportdate)} />
                <Fact
                  label="State"
                  value={
                    stateCodes[row.statesaffected ?? ""] ?? row.statesaffected
                  }
                />
                <Fact label="LGA" value={row.lga} />
                <Fact
                  label="Contaminant"
                  value={codedLabel("contaminant", row.contaminant)}
                />
                <Fact label="Cause" value={codedLabel("cause", row.cause)} />
                <Fact
                  label="Facility"
                  value={codedLabel("typeoffacility", row.typeoffacility)}
                />
                <Fact
                  label="Habitat"
                  value={codedLabel("spillareahabitat", row.spillareahabitat)}
                />
                <Fact
                  label="Estimated spill area"
                  value={row.estimatedspillarea}
                />
                <Fact label="JIV date" value={formatDate(row.jivdate)} />
              </div>
            </div>
            {row.descriptionofimpact && (
              <div className="panel" style={{ marginTop: 22 }}>
                <div className="panel-head">
                  <h2>Impact description supplied by source</h2>
                </div>
                <div className="panel-body">
                  <p>{row.descriptionofimpact}</p>
                </div>
              </div>
            )}
          </div>
          <aside>
            <div className="panel">
              <div className="panel-head">
                <h3>Record timeline</h3>
              </div>
              <div className="panel-body timeline">
                <Timeline title="Incident recorded" date={row.incidentdate} />
                <Timeline title="Report date" date={row.reportdate} />
                <Timeline
                  title="Joint Investigation Visit"
                  date={row.jivdate}
                />
                <Timeline title="Spill stop date" date={row.spillstopdate} />
              </div>
            </div>
            <div className="panel" style={{ marginTop: 22 }}>
              <div className="panel-head">
                <h3>Evidence & documents</h3>
              </div>
              <div className="panel-body">
                <p style={{ color: "var(--slate)", fontSize: 12 }}>
                  Attachments are linked from the source record. Open them on
                  the official monitor.
                </p>
                {attachments.slice(0, 5).map((item, index) => (
                  <a
                    className="record-row"
                    style={{
                      gridTemplateColumns: "32px 1fr",
                      padding: "12px 0",
                    }}
                    key={`${item.url}-${index}`}
                    href={`https://oilspillmonitor.ng/${item.url.replace(/^\//, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.url.toLowerCase().endsWith(".pdf") ? (
                      <FileText size={19} />
                    ) : (
                      <FileImage size={19} />
                    )}
                    <div>
                      <strong>
                        {item.caption || `Attachment ${index + 1}`}
                      </strong>
                      <p>Open official source file</p>
                    </div>
                  </a>
                ))}
                {attachments.length > 0 && (
                  <Link
                    className="button ghost"
                    style={{ width: "100%", marginTop: 12 }}
                    href={`${spillPath(row.id)}/evidence`}
                  >
                    View all evidence
                  </Link>
                )}
              </div>
            </div>
            <DataNote>
              <strong>Source language retained.</strong> A confirmed record
              means confirmed in the source dataset; it is not an independent
              legal finding by this website.
            </DataNote>
            <div className="panel" style={{ marginTop: 22 }}>
              <div className="panel-head"><h3>Explore related records</h3></div>
              <div className="panel-body">
                <p style={{ color: "var(--slate)", fontSize: 12 }}>Continue through records connected by state or company. Similar records do not necessarily describe the same event.</p>
                <div className="button-row">
                  {stateName && <Link className="button ghost" href={`/places/states/${slugify(stateName)}`}>All {stateName} records</Link>}
                  {row.company && <Link className="button ghost" href={`/oil-spills?year=&company=${encodeURIComponent(row.company)}`}>{row.company} records</Link>}
                  {year && <Link className="button ghost" href={`/oil-spills?year=${year}`}>{year} oil spills</Link>}
                  {relatedBlocks.map((blockName) => <Link className="button ghost" href={`/oil-blocks/${slugify(blockName)}`} key={blockName}>{blockName} profile</Link>)}
                </div>
                {relatedSpills.length > 0 && <div className="record-list" style={{ marginTop: 12 }}>{relatedSpills.map((related) => <Link className="record-row" key={related.id} href={spillPath(related.id)}><time>{formatDate(related.incidentdate, { year: "numeric", month: "short" })}</time><div><strong>{related.incidentnumber ?? related.id}</strong><p>{related.sitelocationname ?? related.lga ?? "Location not supplied"}</p></div></Link>)}</div>}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="fact">
      <span>{label}</span>
      <strong>{value || "Not supplied"}</strong>
    </div>
  );
}
function Timeline({ title, date }: { title: string; date?: string | null }) {
  return (
    <div className="timeline-item">
      <h4>{title}</h4>
      <p>{formatDate(date)}</p>
    </div>
  );
}
