import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { findSpill } from "@/lib/data";
import { spillPath } from "@/lib/format";

/**
 * Compatibility route for incident numbers such as 2026/LAR/025. Those
 * numbers are labels, not safe single URL segments, so canonical pages use
 * the source record ID instead.
 */
export default async function LegacySpillRoute({
  params,
}: {
  params: Promise<{ legacy: string[] }>;
}) {
  const { legacy } = await params;
  const wantsEvidence = legacy.at(-1) === "evidence";
  const incidentNumber = (wantsEvidence ? legacy.slice(0, -1) : legacy).join("/");
  const row = await findSpill(incidentNumber);

  if (!row) notFound();
  const canonicalPath = `${spillPath(row.id)}${wantsEvidence ? "/evidence" : ""}`;
  return (
    <section className="page-pad">
      <div className="container prose">
        <span className="eyebrow">NOSDRA oil-spill record</span>
        <h1>Oil spill incident {row.incidentnumber ?? row.id}</h1>
        <p>
          This record is available at its canonical SpillFlare page. The source
          incident number remains visible so older links continue to work.
        </p>
        <Link className="button" href={canonicalPath}>
          View the canonical record <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ legacy: string[] }>;
}): Promise<Metadata> {
  const { legacy } = await params;
  const wantsEvidence = legacy.at(-1) === "evidence";
  const incidentNumber = (wantsEvidence ? legacy.slice(0, -1) : legacy).join("/");
  const row = await findSpill(incidentNumber);
  if (!row) return { title: "Oil spill record not found" };
  return {
    title: `Oil spill incident ${row.incidentnumber ?? row.id}`,
    alternates: { canonical: `${spillPath(row.id)}${wantsEvidence ? "/evidence" : ""}` },
  };
}
