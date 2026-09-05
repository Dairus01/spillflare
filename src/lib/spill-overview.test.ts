import { describe, expect, it } from "vitest";
import { buildNationalSpillOverview } from "@/lib/spill-overview";
import type { SpillRow } from "@/types/domain";

const retrievedAt = new Date("2026-09-05T19:18:23.124Z");
const rows: SpillRow[] = [
  { id: "b", incidentdate: "2024-04-02", reportdate: "2024-04-03", statesaffected: "RI", company: "Beta", estimatedquantity: "" },
  { id: "a", incidentdate: "2024-04-02", reportdate: "2024-04-03", statesaffected: "BY", company: "Alpha", estimatedquantity: "2" },
  { id: "c", incidentdate: "2023-01-01", statesaffected: "RI", company: "Alpha" },
  { id: "d", incidentdate: "1902-02-08", reportdate: "2024-02-12", sitelocationname: "Site" },
  { id: "e", incidentdate: "2015-03-8", company: "Beta", statesaffected: "N/A" },
  { id: "f", sitelocationname: "Undated", statesaffected: "FCT,RI" },
  { id: "thin" },
];

describe("national oil spill overview", () => {
  const overview = buildNationalSpillOverview(rows, retrievedAt);

  it("counts only indexable records and tracks missing fields", () => {
    expect(overview.rawRecords).toBe(7);
    expect(overview.indexableRecords).toBe(6);
    expect(overview.missingDate).toBe(3);
    expect(overview.missingState).toBe(1);
    expect(overview.unrecognizedState).toBe(1);
    expect(overview.missingOperator).toBe(2);
    expect(overview.volumeSupplied).toBe(1);
    expect(overview.missingIncidentNumber).toBe(6);
  });

  it("aggregates trusted years and excludes malformed or inconsistent dates", () => {
    expect(overview.yearly).toEqual([
      { year: "2023", count: 1 },
      { year: "2024", count: 2 },
    ]);
    expect(overview.earliestYear).toBe("2023");
    expect(overview.latestYear).toBe("2024");
  });

  it("ranks states and operators with deterministic alphabetical ties", () => {
    expect(overview.states).toEqual([
      { name: "Rivers", count: 3 },
      { name: "Bayelsa", count: 1 },
      { name: "Federal Capital Territory", count: 1 },
    ]);
    expect(overview.operators).toEqual([
      { name: "Alpha", count: 2 },
      { name: "Beta", count: 2 },
    ]);
  });

  it("selects recent records by trusted date and stable ID when dates tie", () => {
    expect(overview.recentRecords.map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(overview.latestIncidentDate).toBe("2024-04-02");
  });
});
