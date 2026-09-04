import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findSpill } from "@/lib/data";
import { spillPath } from "@/lib/format";
import SpillDetailPage from "../[id]/page";
import EvidencePage from "../[id]/evidence/page";

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
  return wantsEvidence
    ? EvidencePage({ params: Promise.resolve({ id: row.id }) })
    : SpillDetailPage({ params: Promise.resolve({ id: row.id }) });
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
