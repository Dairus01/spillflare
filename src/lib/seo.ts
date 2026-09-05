import type { SpillRow } from "@/types/domain";
import { formatDate, stateCodes } from "@/lib/format";

export function spillStateName(row: SpillRow) {
  return stateCodes[row.statesaffected ?? ""] ?? row.statesaffected ?? null;
}

export function spillYear(row: SpillRow) {
  return row.incidentdate?.match(/^\d{4}/)?.[0] ?? null;
}

export function isIndexableSpill(row: SpillRow) {
  return Boolean(row.incidentdate || row.sitelocationname || row.company);
}

export function spillSeoTitle(row: SpillRow) {
  const location = row.sitelocationname || row.lga || spillStateName(row);
  const year = spillYear(row);
  const subject = location ? `Oil Spill at ${location}` : "Nigeria Oil Spill Record";
  const context = [row.company, year].filter(Boolean).join(", ");
  return context ? `${subject} – ${context}` : `${subject} ${row.incidentnumber ?? row.id}`;
}

export function spillSeoDescription(row: SpillRow) {
  const location = row.sitelocationname || row.lga || "an unspecified location";
  const state = spillStateName(row);
  const details = [
    `View the NOSDRA oil spill record for ${location}${state ? `, ${state} State` : ""}`,
    row.company ? `involving ${row.company}` : null,
    row.incidentdate ? `dated ${formatDate(row.incidentdate)}` : null,
    row.cause ? `including reported cause, facility, quantity and source evidence where supplied` : `including source fields and evidence where supplied`,
  ].filter(Boolean);
  return `${details.join(" ")}.`;
}
