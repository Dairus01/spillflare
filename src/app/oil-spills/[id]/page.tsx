import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileImage, FileText, MapPin } from "lucide-react";
import { notFound } from "next/navigation";
import { NigeriaMap } from "@/components/map";
import { DataNote, SourceRail } from "@/components/ui";
import {
  findSpill,
  getMetadata,
  parseAttachments,
  spillCoordinates,
} from "@/lib/data";
import { codedLabel, formatDate, formatNumber, stateCodes } from "@/lib/format";
import type { MapPoint } from "@/types/domain";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const row = await findSpill(id);
  return {
    title: row
      ? `Oil spill ${row.incidentnumber ?? row.id}`
      : "Oil spill not found",
  };
}
export default async function SpillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [row, metadata] = await Promise.all([findSpill(id), getMetadata()]);
  if (!row) notFound();
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
  return (
    <>
      <section className="detail-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href="/oil-spills">Oil spills</Link> / Incident{" "}
            {row.incidentnumber ?? row.id}
          </div>
          <div className="detail-title">
            <div>
              <span className="badge">{row.status ?? "Recorded"}</span>
              <h1>Incident {row.incidentnumber ?? row.id}</h1>
              <p>{row.sitelocationname ?? "Location not supplied"}</p>
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
                    href={`/oil-spills/${row.incidentnumber ?? row.id}/evidence`}
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
