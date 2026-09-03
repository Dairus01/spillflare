import type { SpillRow } from "@/types/domain";
import { numberOrNull, stateCodes } from "@/lib/format";

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

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function causeGroup(cause?: string | null): CauseGroup {
  const code = cause?.trim().toLowerCase();
  if (code === "sab") return "sabotage";
  if (code === "eqf" || code === "cor" || code === "ome") return "operational";
  return "other";
}

export function spillYears(rows: SpillRow[]) {
  return [...new Set(rows.map((row) => row.incidentdate?.slice(0, 4)).filter((year): year is string => /^20\d{2}$/.test(year ?? "")))].sort((a, b) => b.localeCompare(a));
}

export function buildSpillAnalytics(rows: SpillRow[], year: string) {
  const selected = rows.filter((row) => row.incidentdate?.startsWith(year));
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
    companyMap.set(company, companyRow);

    causeTotals[group] += 1;
    const monthIndex = Number(row.incidentdate?.slice(5, 7)) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      const month = monthly[monthIndex];
      month[group] += 1;
      if (quantity !== null) month[`${group}Volume` as const] += quantity;
      if (missingQuantity) month.quantityMissing += 1;
      else month.quantitySupplied += 1;
    }

    const state = stateCodes[row.statesaffected ?? ""] ?? row.statesaffected ?? "State not supplied";
    stateMap.set(state, (stateMap.get(state) ?? 0) + 1);
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
    states: [...stateMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10),
  };
}
