import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSpillAnalytics, causeGroup, spillYears } from "@/lib/spill-analytics";
import { parseW3cDate } from "@/lib/sitemap-date";
import type { SpillRow } from "@/types/domain";

describe("oil spill analytics", () => {
  it("groups source causes without inventing a compliance score", () => {
    expect(causeGroup("sab")).toBe("sabotage");
    expect(causeGroup("eqf")).toBe("operational");
    expect(causeGroup("cor")).toBe("operational");
    expect(causeGroup("ytd")).toBe("other");
  });

  it("keeps missing quantity separate from a supplied zero", () => {
    const rows: SpillRow[] = [
      { id: "1", incidentdate: "2025-01-01", company: "Alpha", cause: "sab", estimatedquantity: "", jivdate: null, statesaffected: "RI" },
      { id: "2", incidentdate: "2025-01-02", company: "Alpha", cause: "eqf", estimatedquantity: "0", jivdate: "2025-01-03", statesaffected: "RI" },
      { id: "3", incidentdate: "2024-01-02", company: "Beta", estimatedquantity: "12" },
    ];
    const result = buildSpillAnalytics(rows, "2025");
    expect(result.totalSpills).toBe(2);
    expect(result.quantityMissing).toBe(1);
    expect(result.quantitySupplied).toBe(1);
    expect(result.totalVolume).toBe(0);
    expect(result.noJiv).toBe(1);
    expect(result.monthly[0].quantityMissing).toBe(1);
  });

  it("uses trusted incident dates for years and excludes rejected dates", () => {
    const retrievedAt = new Date("2026-09-06T13:12:06.200Z");
    const rows: SpillRow[] = [
      { id: "valid", incidentdate: "2023-01-01", reportdate: "2023-01-02", company: "Alpha", cause: "sab" },
      { id: "invalid", incidentdate: "2023-01-02", reportdate: "2022-12-31", company: "Beta", cause: "sab" },
      { id: "malformed", incidentdate: "2023-01-3", company: "Gamma", cause: "sab" },
      { id: "outlier", incidentdate: "1902-02-08", reportdate: "2024-02-12", company: "PPMC", cause: "other" },
    ];

    expect(spillYears(rows, retrievedAt)).toEqual(["2023"]);
    expect(buildSpillAnalytics(rows, "2023", retrievedAt).totalSpills).toBe(1);
  });

  it("preserves the audited snapshot counts as trusted incident-date source records", () => {
    const rows = JSON.parse(readFileSync(join(process.cwd(), "data/snapshots/spillsPrimary.json"), "utf8")) as SpillRow[];
    const metadata = JSON.parse(readFileSync(join(process.cwd(), "data/snapshots/metadata.json"), "utf8")) as { retrievedAt: string };
    const retrievedAt = parseW3cDate(metadata.retrievedAt);

    // These are source-record counts under the trusted incident-date methodology,
    // not claims about independently verified unique physical spill events.
    expect(buildSpillAnalytics(rows, "2023", retrievedAt).totalSpills).toBe(1550);
    expect(buildSpillAnalytics(rows, "2024", retrievedAt).totalSpills).toBe(1258);
  });

  it("reports completeness and report-year mismatches separately", () => {
    const rows: SpillRow[] = [
      { id: "one", incidentdate: "2024-01-01", reportdate: "2024-01-04", incidentnumber: " A-1 ", company: "Alpha", statesaffected: "RI", cause: "sab", estimatedquantity: "0", jivdate: "2024-01-05" },
      { id: "two", incidentdate: "2024-02-01", reportdate: "2025-02-01", incidentnumber: "a-1", company: "", statesaffected: "unknown", cause: "", estimatedquantity: "", jivdate: "" },
    ];
    const result = buildSpillAnalytics(rows, "2024", new Date("2026-09-06T00:00:00Z"));
    expect(result.totalSpills).toBe(2);
    expect(result.uniqueIncidentNumbers).toBe(1);
    expect(result.completeness.reportYearMismatch).toBe(1);
    expect(result.completeness.stateResolved).toBe(1);
    expect(result.completeness.quantitySupplied).toBe(1);
  });
});
