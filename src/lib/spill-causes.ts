import type { SpillRow } from "@/types/domain";
import { formatDate, spillPath } from "@/lib/format";
import { isIndexableSpill } from "@/lib/seo";
import { trustedIncidentLastModified } from "@/lib/sitemap-date";
import { spillStateNames } from "@/lib/spill-state";

export type CauseCategory =
  | "sabotage"
  | "equipment_failure"
  | "corrosion"
  | "operational"
  | "yet_to_be_determined"
  | "other"
  | "missing";

export type CauseClassification = {
  category: CauseCategory;
  raw: string | null;
};

export type CauseCategorySummary = {
  category: CauseCategory;
  label: string;
  count: number;
  shareOfPopulated: number;
  shareOfAll: number;
};

export type CauseYearSummary = {
  year: string;
  total: number;
  missing: number;
  sabotage: number;
  equipment_failure: number;
  corrosion: number;
  operational: number;
  yet_to_be_determined: number;
  other: number;
};

export type CauseAnalysisSummary = {
  year: string | null;
  consideredRecords: number;
  populatedCause: number;
  missingCause: number;
  uncertainCause: number;
  categories: CauseCategorySummary[];
  rawLabels: Array<{ label: string; count: number }>;
  statesByCategory: Record<string, Array<{ name: string; count: number }>>;
  recentByCategory: Record<string, SpillRow[]>;
};

export type CauseAnalysis = {
  national: CauseAnalysisSummary;
  selected: CauseAnalysisSummary;
  years: string[];
  yearly: CauseYearSummary[];
};

export const causeCategoryLabels: Record<CauseCategory, string> = {
  sabotage: "Sabotage / theft",
  equipment_failure: "Equipment failure",
  corrosion: "Corrosion",
  operational: "Operational/maintenance error",
  yet_to_be_determined: "Yet to determine",
  other: "Other source label",
  missing: "Cause not supplied",
};

/**
 * Map the source's compact cause codes without inferring a cause from prose.
 * The mapping deliberately preserves the source distinction between a blank,
 * an explicit YTD value, and an `other:` label.
 */
export function classifyCause(value?: string | null): CauseClassification {
  const raw = value?.trim() || null;
  if (!raw) return { category: "missing", raw: null };
  const code = raw.toLowerCase();
  if (code === "sab") return { category: "sabotage", raw };
  if (code === "eqf") return { category: "equipment_failure", raw };
  if (code === "cor") return { category: "corrosion", raw };
  if (code === "ome") return { category: "operational", raw };
  if (code === "ytd") return { category: "yet_to_be_determined", raw };
  return { category: "other", raw };
}

export const causeCategoryOrder: CauseCategory[] = [
  "sabotage",
  "equipment_failure",
  "corrosion",
  "operational",
  "yet_to_be_determined",
  "other",
  "missing",
];

function ranked(map: Map<string, number>) {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function emptyYear(year: string): CauseYearSummary {
  return {
    year,
    total: 0,
    missing: 0,
    sabotage: 0,
    equipment_failure: 0,
    corrosion: 0,
    operational: 0,
    yet_to_be_determined: 0,
    other: 0,
  };
}

function summarize(
  rows: Array<{ row: SpillRow; date: Date }>,
  year: string | null,
): CauseAnalysisSummary {
  const considered = year ? rows.filter(({ date }) => String(date.getUTCFullYear()) === year) : rows;
  const categoryCounts = new Map<CauseCategory, number>();
  const rawCounts = new Map<string, number>();
  const stateMaps = new Map<CauseCategory, Map<string, number>>();
  const recent = new Map<CauseCategory, Array<{ row: SpillRow; date: Date }>>();
  let populatedCause = 0;
  let uncertainCause = 0;

  for (const item of considered) {
    const classification = classifyCause(item.row.cause);
    categoryCounts.set(classification.category, (categoryCounts.get(classification.category) ?? 0) + 1);
    if (classification.raw) {
      populatedCause += 1;
      rawCounts.set(classification.raw, (rawCounts.get(classification.raw) ?? 0) + 1);
    }
    if (classification.category === "yet_to_be_determined") uncertainCause += 1;

    const states = spillStateNames(item.row);
    if (states.length) {
      const stateMap = stateMaps.get(classification.category) ?? new Map<string, number>();
      for (const state of states) stateMap.set(state, (stateMap.get(state) ?? 0) + 1);
      stateMaps.set(classification.category, stateMap);
    }
    const recentRows = recent.get(classification.category) ?? [];
    recentRows.push(item);
    recent.set(classification.category, recentRows);
  }

  const consideredRecords = considered.length;
  const categories = causeCategoryOrder.map((category) => {
    const count = categoryCounts.get(category) ?? 0;
    return {
      category,
      label: causeCategoryLabels[category],
      count,
      shareOfPopulated: category === "missing" ? 0 : populatedCause ? (count / populatedCause) * 100 : 0,
      shareOfAll: consideredRecords ? (count / consideredRecords) * 100 : 0,
    };
  });
  const statesByCategory: Record<string, Array<{ name: string; count: number }>> = {};
  for (const category of causeCategoryOrder) {
    statesByCategory[category] = ranked(stateMaps.get(category) ?? new Map()).slice(0, 5);
  }
  const recentByCategory: Record<string, SpillRow[]> = {};
  for (const category of causeCategoryOrder) {
    recentByCategory[category] = (recent.get(category) ?? [])
      .sort((a, b) => b.date.getTime() - a.date.getTime() || String(a.row.id).localeCompare(String(b.row.id)))
      .slice(0, 3)
      .map(({ row }) => row);
  }

  return {
    year,
    consideredRecords,
    populatedCause,
    missingCause: categoryCounts.get("missing") ?? 0,
    uncertainCause,
    categories,
    rawLabels: [...rawCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    statesByCategory,
    recentByCategory,
  };
}

export function buildCauseAnalysis(
  rows: SpillRow[],
  retrievedAt?: Date,
  selectedYear?: string,
): CauseAnalysis {
  const trusted = rows
    .filter(isIndexableSpill)
    .map((row) => ({ row, date: trustedIncidentLastModified(row, retrievedAt) }))
    .filter((item): item is { row: SpillRow; date: Date } => Boolean(item.date));
  const years = [...new Set(trusted.map(({ date }) => String(date.getUTCFullYear())))]
    .sort((a, b) => a.localeCompare(b));
  const yearlyMap = new Map<string, CauseYearSummary>();
  for (const item of trusted) {
    const year = String(item.date.getUTCFullYear());
    const summary = yearlyMap.get(year) ?? emptyYear(year);
    summary.total += 1;
    const category = classifyCause(item.row.cause).category;
    if (category === "missing") summary.missing += 1;
    else summary[category] += 1;
    yearlyMap.set(year, summary);
  }
  const national = summarize(trusted, null);
  const thisYear = new Date().getUTCFullYear().toString();
  const completeYears = years.filter((year) => year !== thisYear);
  const defaultYear = completeYears.at(-1) ?? years.at(-1) ?? null;
  const effectiveYear = selectedYear && years.includes(selectedYear) ? selectedYear : defaultYear;
  const selected = effectiveYear ? summarize(trusted, effectiveYear) : national;
  return { national, selected, years, yearly: years.map((year) => yearlyMap.get(year) ?? emptyYear(year)) };
}

export function causeRecordHref(row: SpillRow) {
  return spillPath(row.id);
}

export function causeRecordDate(row: SpillRow) {
  return formatDate(row.incidentdate);
}
