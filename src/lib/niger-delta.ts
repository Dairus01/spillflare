import type { SpillRow } from "@/types/domain";
import { numberOrNull, slugify } from "@/lib/format";
import { isIndexableSpill } from "@/lib/seo";
import { trustedIncidentLastModified } from "@/lib/sitemap-date";
import { spillStateNames } from "@/lib/spill-state";
import {
  causeCategoryLabels,
  causeCategoryOrder,
  classifyCause,
  type CauseCategory,
} from "@/lib/spill-causes";

/** The nine-state administrative region used by the Niger Delta Development Commission. */
export const NIGER_DELTA_NDDC_STATES = [
  "Abia",
  "Akwa Ibom",
  "Bayelsa",
  "Cross River",
  "Delta",
  "Edo",
  "Imo",
  "Ondo",
  "Rivers",
] as const;

export type NigerDeltaState = (typeof NIGER_DELTA_NDDC_STATES)[number];
const nigerDeltaStates = new Set<string>(NIGER_DELTA_NDDC_STATES);

export const NIGER_DELTA_MAP_LIMIT = 1200;

export type RegionalRecord = { row: SpillRow; date: Date };
export type RegionalYear = { year: string; count: number };
export type RegionalCause = {
  category: CauseCategory;
  label: string;
  count: number;
  shareOfAll: number;
  shareOfPopulated: number;
};
export type RegionalStateSummary = {
  name: NigerDeltaState;
  slug: string;
  count: number;
  share: number;
  earliestDate: string | null;
  latestDate: string | null;
  coordinateCount: number;
  causeCount: number;
  quantityCount: number;
  operatorCount: number;
};
export type RegionalSummary = {
  year: string | null;
  consideredRecords: number;
  withCoordinates: number;
  withoutCoordinates: number;
  withCause: number;
  missingCause: number;
  withQuantity: number;
  missingQuantity: number;
  withOperator: number;
  missingOperator: number;
  withIncidentNumber: number;
  missingIncidentNumber: number;
  states: RegionalStateSummary[];
  causes: RegionalCause[];
  recentRecords: RegionalRecord[];
  mapRecords: RegionalRecord[];
};
export type NigerDeltaAnalysis = {
  regionRawRecords: number;
  regionIndexableRecords: number;
  regionNoindexRecords: number;
  regionTrustedRecords: number;
  regionMissingTrustedDate: number;
  regionStatesRepresented: number;
  years: string[];
  yearly: RegionalYear[];
  nationalTrustedRecords: number;
  nationalShare: number;
  regional: RegionalSummary;
  selected: RegionalSummary;
  latestTrustedDate: string | null;
  earliestTrustedDate: string | null;
  stateMultiRecordCount: number;
  stateRowsTotal: number;
  mapCoordinateRecords: number;
  mapRecordsShown: number;
  mapRecordsOmitted: number;
};

function supplied(value?: string | null) {
  return Boolean(value?.trim());
}

function coordinates(row: SpillRow) {
  const lat = numberOrNull(row.latitude);
  const lng = numberOrNull(row.longitude);
  return lat !== null && lng !== null && !(lat === 0 && lng === 0) && lat >= -5 && lat <= 16 && lng >= -2 && lng <= 16
    ? { lat, lng }
    : null;
}

export function nigerDeltaStatesForRow(row: SpillRow): NigerDeltaState[] {
  return spillStateNames(row).filter((state): state is NigerDeltaState => nigerDeltaStates.has(state));
}

export function isNigerDeltaRecord(row: SpillRow) {
  return nigerDeltaStatesForRow(row).length > 0;
}

function summary(items: RegionalRecord[], year: string | null): RegionalSummary {
  const selected = year ? items.filter(({ date }) => String(date.getUTCFullYear()) === year) : items;
  const causeCounts = new Map<CauseCategory, number>();
  const stateCounts = new Map<NigerDeltaState, number>();
  const stateItems = new Map<NigerDeltaState, RegionalRecord[]>();
  let withCoordinates = 0;
  let withCause = 0;
  let withQuantity = 0;
  let withOperator = 0;
  let withIncidentNumber = 0;

  for (const item of selected) {
    const classification = classifyCause(item.row.cause);
    causeCounts.set(classification.category, (causeCounts.get(classification.category) ?? 0) + 1);
    if (classification.raw) withCause += 1;
    if (coordinates(item.row)) withCoordinates += 1;
    if (numberOrNull(item.row.estimatedquantity) !== null) withQuantity += 1;
    if (supplied(item.row.company)) withOperator += 1;
    if (supplied(item.row.incidentnumber)) withIncidentNumber += 1;

    for (const state of nigerDeltaStatesForRow(item.row)) {
      stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1);
      const records = stateItems.get(state) ?? [];
      records.push(item);
      stateItems.set(state, records);
    }
  }

  const consideredRecords = selected.length;
  const causes = causeCategoryOrder.map((category) => {
    const count = causeCounts.get(category) ?? 0;
    return {
      category,
      label: causeCategoryLabels[category],
      count,
      shareOfAll: consideredRecords ? (count / consideredRecords) * 100 : 0,
      shareOfPopulated: category === "missing" || !withCause ? 0 : (count / withCause) * 100,
    };
  });
  const states = NIGER_DELTA_NDDC_STATES.map((name) => {
    const records = stateItems.get(name) ?? [];
    const dates = records.map(({ date }) => date).sort((a, b) => a.getTime() - b.getTime());
    return {
      name,
      slug: slugify(name),
      count: stateCounts.get(name) ?? 0,
      share: consideredRecords ? ((stateCounts.get(name) ?? 0) / consideredRecords) * 100 : 0,
      earliestDate: dates[0]?.toISOString().slice(0, 10) ?? null,
      latestDate: dates.at(-1)?.toISOString().slice(0, 10) ?? null,
      coordinateCount: records.filter(({ row }) => Boolean(coordinates(row))).length,
      causeCount: records.filter(({ row }) => supplied(row.cause)).length,
      quantityCount: records.filter(({ row }) => numberOrNull(row.estimatedquantity) !== null).length,
      operatorCount: records.filter(({ row }) => supplied(row.company)).length,
    };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const recentRecords = selected
    .slice()
    .sort((a, b) => b.date.getTime() - a.date.getTime() || String(a.row.id).localeCompare(String(b.row.id)))
    .slice(0, 10);
  const mapRecords = selected
    .filter(({ row }) => Boolean(coordinates(row)))
    .sort((a, b) => b.date.getTime() - a.date.getTime() || String(a.row.id).localeCompare(String(b.row.id)));

  return {
    year,
    consideredRecords,
    withCoordinates,
    withoutCoordinates: consideredRecords - withCoordinates,
    withCause,
    missingCause: consideredRecords - withCause,
    withQuantity,
    missingQuantity: consideredRecords - withQuantity,
    withOperator,
    missingOperator: consideredRecords - withOperator,
    withIncidentNumber,
    missingIncidentNumber: consideredRecords - withIncidentNumber,
    states,
    causes,
    recentRecords,
    mapRecords,
  };
}

export function buildNigerDeltaAnalysis(
  rows: SpillRow[],
  retrievedAt?: Date,
  selectedYear?: string,
  nationalTrustedRecords?: number,
): NigerDeltaAnalysis {
  const rawRegional = rows.filter(isNigerDeltaRecord);
  const indexableRegional = rawRegional.filter(isIndexableSpill);
  const trustedRegional = indexableRegional
    .map((row) => ({ row, date: trustedIncidentLastModified(row, retrievedAt) }))
    .filter((item): item is RegionalRecord => Boolean(item.date));
  const years = [...new Set(trustedRegional.map(({ date }) => String(date.getUTCFullYear())))].sort((a, b) => a.localeCompare(b));
  const yearlyMap = new Map<string, number>();
  for (const { date } of trustedRegional) {
    const year = String(date.getUTCFullYear());
    yearlyMap.set(year, (yearlyMap.get(year) ?? 0) + 1);
  }
  const currentYear = new Date().getUTCFullYear().toString();
  const completeYears = years.filter((year) => year !== currentYear);
  const defaultYear = completeYears.at(-1) ?? years.at(-1) ?? null;
  const effectiveYear = selectedYear && years.includes(selectedYear) ? selectedYear : defaultYear;
  const national = nationalTrustedRecords ?? rows.filter(isIndexableSpill).reduce((total, row) => total + (trustedIncidentLastModified(row, retrievedAt) ? 1 : 0), 0);
  const regional = summary(trustedRegional, null);
  const selected = summary(trustedRegional, effectiveYear);
  const stateRowsTotal = selected.states.reduce((total, state) => total + state.count, 0);
  const regionStateMultiRecordCount = trustedRegional.filter(({ row }) => nigerDeltaStatesForRow(row).length > 1).length;
  const dates = trustedRegional.map(({ date }) => date).sort((a, b) => a.getTime() - b.getTime());
  const mapCoordinateRecords = trustedRegional.filter(({ row }) => Boolean(coordinates(row))).length;
  return {
    regionRawRecords: rawRegional.length,
    regionIndexableRecords: indexableRegional.length,
    regionNoindexRecords: rawRegional.length - indexableRegional.length,
    regionTrustedRecords: trustedRegional.length,
    regionMissingTrustedDate: indexableRegional.length - trustedRegional.length,
    regionStatesRepresented: new Set(rawRegional.flatMap(nigerDeltaStatesForRow)).size,
    years,
    yearly: years.map((year) => ({ year, count: yearlyMap.get(year) ?? 0 })),
    nationalTrustedRecords: national,
    nationalShare: national ? (trustedRegional.length / national) * 100 : 0,
    regional,
    selected,
    latestTrustedDate: dates.at(-1)?.toISOString().slice(0, 10) ?? null,
    earliestTrustedDate: dates[0]?.toISOString().slice(0, 10) ?? null,
    stateMultiRecordCount: regionStateMultiRecordCount,
    stateRowsTotal,
    mapCoordinateRecords,
    mapRecordsShown: Math.min(selected.mapRecords.length, NIGER_DELTA_MAP_LIMIT),
    mapRecordsOmitted: Math.max(0, selected.mapRecords.length - NIGER_DELTA_MAP_LIMIT),
  };
}

export function regionalCoordinates(row: SpillRow) {
  return coordinates(row);
}
