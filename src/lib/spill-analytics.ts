import type { SpillRow } from "@/types/domain";
import { numberOrNull } from "@/lib/format";
import { isIndexableSpill } from "@/lib/seo";
import { parseW3cDate, trustedIncidentLastModified, trustedIncidentYear } from "@/lib/sitemap-date";
import { spillStateNames } from "@/lib/spill-state";

export type CauseGroup = "sabotage" | "operational" | "other";

export type CompanyAnalyticsRow = {
  company: string;
  reportedSpills: number;
  reportedVolume: number;
  quantitySupplied: number;
  noJiv: number;
  noQuantity: number;
};

export type MonthlyAnalyticsRow = {
  month: string;
  monthNumber: number;
  sabotage: number;
  operational: number;
  other: number;
  sabotageVolume: number;
  operationalVolume: number;
  otherVolume: number;
  quantitySupplied: number;
  quantityMissing: number;
};

export type DataCompleteness = {
  incidentNumberSupplied: number;
  reportDateSupplied: number;
  reportDateValid: number;
  jivDateSupplied: number;
  quantitySupplied: number;
  stateResolved: number;
  operatorSupplied: number;
  causeSupplied: number;
  reportYearMismatch: number;
};

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function causeGroup(cause?: string | null): CauseGroup {
  const code = cause?.trim().toLowerCase();
  if (code === "sab") return "sabotage";
  if (code === "eqf" || code === "cor" || code === "ome") return "operational";
  return "other";
}

export function normalizeIncidentNumber(value?: string | null) {
  const normalized = value?.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized || null;
}

export function spillYears(rows: SpillRow[], retrievedAt?: Date) {
  return [...new Set(rows.filter(isIndexableSpill).map((row) => trustedIncidentYear(row, retrievedAt)).filter((year): year is string => Boolean(year)))].sort((a, b) => b.localeCompare(a));
}

export function buildSpillAnalytics(rows: SpillRow[], year: string, retrievedAt?: Date) {
  const selected = rows.filter((row) => isIndexableSpill(row) && trustedIncidentYear(row, retrievedAt) === year);
  const companyMap = new Map<string, CompanyAnalyticsRow>();
  const monthly: MonthlyAnalyticsRow[] = monthLabels.map((month, index) => ({
    month,
    monthNumber: index + 1,
    sabotage: 0,
    operational: 0,
    other: 0,
    sabotageVolume: 0,
    operationalVolume: 0,
    otherVolume: 0,
    quantitySupplied: 0,
    quantityMissing: 0,
  }));
  const stateMap = new Map<string, number>();
  const causeTotals = { sabotage: 0, operational: 0, other: 0 };
  const incidentNumbers = new Set<string>();
  const completeness: DataCompleteness = {
    incidentNumberSupplied: 0,
    reportDateSupplied: 0,
    reportDateValid: 0,
    jivDateSupplied: 0,
    quantitySupplied: 0,
    stateResolved: 0,
    operatorSupplied: 0,
    causeSupplied: 0,
    reportYearMismatch: 0,
  };

  let totalVolume = 0;
  let quantitySupplied = 0;
  let noJiv = 0;

  for (const row of selected) {
    const company = row.company?.trim() || "Company not supplied";
    const quantity = numberOrNull(row.estimatedquantity);
    const missingQuantity = row.estimatedquantity === null || row.estimatedquantity === undefined || row.estimatedquantity.trim() === "";
    const missingJiv = !row.jivdate?.trim();
    const group = causeGroup(row.cause);
    const companyRow = companyMap.get(company) ?? {
      company,
      reportedSpills: 0,
      reportedVolume: 0,
      quantitySupplied: 0,
      noJiv: 0,
      noQuantity: 0,
    };

    companyRow.reportedSpills += 1;
    if (quantity !== null) {
      companyRow.reportedVolume += quantity;
      companyRow.quantitySupplied += 1;
      totalVolume += quantity;
      quantitySupplied += 1;
    }
    if (missingQuantity) companyRow.noQuantity += 1;
    if (missingJiv) {
      companyRow.noJiv += 1;
      noJiv += 1;
    }
    const incidentNumber = normalizeIncidentNumber(row.incidentnumber);
    if (incidentNumber) {
      incidentNumbers.add(incidentNumber);
      completeness.incidentNumberSupplied += 1;
    }
    const reportDate = parseW3cDate(row.reportdate);
    if (row.reportdate?.trim()) completeness.reportDateSupplied += 1;
    if (reportDate) {
      completeness.reportDateValid += 1;
      if (reportDate.getUTCFullYear().toString() !== year) completeness.reportYearMismatch += 1;
    }
    if (row.jivdate?.trim()) completeness.jivDateSupplied += 1;
    if (quantity !== null) completeness.quantitySupplied += 1;
    const resolvedStates = spillStateNames(row);
    if (resolvedStates.length) completeness.stateResolved += 1;
    if (company !== "Company not supplied") completeness.operatorSupplied += 1;
    if (row.cause?.trim()) completeness.causeSupplied += 1;
    companyMap.set(company, companyRow);

    causeTotals[group] += 1;
    const trustedDate = trustedIncidentLastModified(row, retrievedAt);
    const monthIndex = trustedDate ? trustedDate.getUTCMonth() : -1;
    if (monthIndex >= 0 && monthIndex < 12) {
      const month = monthly[monthIndex];
      month[group] += 1;
      if (quantity !== null) month[`${group}Volume` as const] += quantity;
      if (missingQuantity) month.quantityMissing += 1;
      else month.quantitySupplied += 1;
    }

    if (resolvedStates.length) {
      for (const state of resolvedStates) stateMap.set(state, (stateMap.get(state) ?? 0) + 1);
    }
  }

  return {
    year,
    totalSpills: selected.length,
    totalVolume,
    quantitySupplied,
    quantityMissing: selected.length - quantitySupplied,
    jivSupplied: selected.length - noJiv,
    noJiv,
    causeTotals,
    companies: [...companyMap.values()].sort((a, b) => b.reportedSpills - a.reportedSpills || a.company.localeCompare(b.company)),
    monthly,
    states: [...stateMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, 10),
    recentRecords: selected
      .map((row) => ({ row, date: trustedIncidentLastModified(row, retrievedAt) }))
      .filter((item): item is { row: SpillRow; date: Date } => Boolean(item.date))
      .sort((a, b) => b.date.getTime() - a.date.getTime() || String(a.row.id).localeCompare(String(b.row.id)))
      .slice(0, 6)
      .map(({ row }) => row),
    incidentNumbersSupplied: completeness.incidentNumberSupplied,
    missingIncidentNumbers: selected.length - completeness.incidentNumberSupplied,
    uniqueIncidentNumbers: incidentNumbers.size,
    completeness,
  };
}
