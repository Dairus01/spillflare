import { notFound, redirect } from "next/navigation";
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
  redirect(`${spillPath(row.id)}${wantsEvidence ? "/evidence" : ""}`);
}
