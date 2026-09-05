import type { SpillRow } from "@/types/domain";
import { numberOrNull } from "@/lib/format";
import { isIndexableSpill } from "@/lib/seo";
import { trustedIncidentLastModified } from "@/lib/sitemap-date";
import { spillStateNames } from "@/lib/spill-state";

export type RankedSpillGroup = { name: string; count: number };
export type YearlySpillCount = { year: string; count: number };

function ranked(map: Map<string, number>): RankedSpillGroup[] {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function supplied(value?: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

export function buildNationalSpillOverview(
  rows: SpillRow[],
  retrievedAt?: Date,
) {
  const records = rows.filter(isIndexableSpill);
  const states = new Map<string, number>();
  const operators = new Map<string, number>();
  const years = new Map<string, number>();
  const trustedRecords: Array<{ row: SpillRow; date: Date }> = [];
  let missingDate = 0;
  let missingState = 0;
  let unrecognizedState = 0;
  let missingOperator = 0;
  let volumeSupplied = 0;
  let missingIncidentNumber = 0;

  for (const row of records) {
    const date = trustedIncidentLastModified(row, retrievedAt);
    if (date) {
      const year = String(date.getUTCFullYear());
      years.set(year, (years.get(year) ?? 0) + 1);
      trustedRecords.push({ row, date });
    } else {
      missingDate += 1;
    }

    const rowStates = spillStateNames(row);
    for (const state of rowStates) states.set(state, (states.get(state) ?? 0) + 1);
    if (!supplied(row.statesaffected)) missingState += 1;
    else if (!rowStates.length) unrecognizedState += 1;

    const operator = supplied(row.company);
    if (operator) operators.set(operator, (operators.get(operator) ?? 0) + 1);
    else missingOperator += 1;

    if (numberOrNull(row.estimatedquantity) !== null) volumeSupplied += 1;
    if (!supplied(row.incidentnumber)) missingIncidentNumber += 1;
  }

  trustedRecords.sort(
    (a, b) =>
      b.date.getTime() - a.date.getTime() ||
      String(a.row.id).localeCompare(String(b.row.id)),
  );
  const yearly = [...years.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year.localeCompare(b.year));

  return {
    rawRecords: rows.length,
    indexableRecords: records.length,
    yearly,
    earliestYear: yearly[0]?.year ?? null,
    latestYear: yearly.at(-1)?.year ?? null,
    representedStates: states.size,
    representedOperators: operators.size,
    states: ranked(states),
    operators: ranked(operators),
    recentRecords: trustedRecords.slice(0, 8).map(({ row }) => row),
    latestIncidentDate: trustedRecords[0]?.row.incidentdate ?? null,
    missingDate,
    missingState,
    unrecognizedState,
    missingOperator,
    volumeSupplied,
    missingIncidentNumber,
  };
}
