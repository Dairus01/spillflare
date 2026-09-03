import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ExternalLink, FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { DataNote } from "@/components/ui";
import { findSpill, parseAttachments } from "@/lib/data";
export const metadata: Metadata = { title: "Oil spill evidence" };
export default async function EvidencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const row = await findSpill(id);
  if (!row) notFound();
  const attachments = parseAttachments(row);
  return (
    <>
      <section className="page-hero">
        <div className="container">
          <div className="breadcrumbs">
            <Link href={`/oil-spills/${row.incidentnumber ?? row.id}`}>
              Incident {row.incidentnumber ?? row.id}
            </Link>{" "}
            / Evidence
          </div>
          <span className="eyebrow">Source attachments</span>
          <h1>Evidence & documents</h1>
          <p>
            Files listed in the NOSDRA source record for{" "}
            {row.sitelocationname ?? "this incident"}.
          </p>
        </div>
      </section>
      <div className="container page-pad">
        <DataNote>
          These files are hosted by the source website. Captions are reproduced
          as supplied, and attachment availability can change independently of
          this product.
        </DataNote>
        <div className="card-grid" style={{ marginTop: 22 }}>
          {attachments.map((item, index) => {
            const href = `https://oilspillmonitor.ng/${item.url.replace(/^\//, "")}`;
            const image = /\.(jpg|jpeg|png)$/i.test(item.url);
            return (
              <a
                className="card interactive"
                key={`${item.url}-${index}`}
                href={href}
                target="_blank"
                rel="noreferrer"
              >
                {image ? (
                  <Image
                    src={href}
                    alt={item.caption || `Incident evidence ${index + 1}`}
                    width={640}
                    height={430}
                    unoptimized
                    style={{
                      width: "100%",
                      height: 210,
                      objectFit: "cover",
                      borderRadius: 8,
                      marginBottom: 18,
                    }}
                  />
                ) : (
                  <div className="card-icon">
                    <FileText size={22} />
                  </div>
                )}
                <h3>{item.caption || `Attachment ${index + 1}`}</h3>
                <p>
                  {image
                    ? "Photograph linked by the source record."
                    : "Joint Investigation Visit document linked by the source record."}
                </p>
                <span className="text-link">
                  Open original <ExternalLink size={14} />
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </>
  );
}
