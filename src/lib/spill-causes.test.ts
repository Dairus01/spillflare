import { describe, expect, it } from "vitest";
import { buildCauseAnalysis, classifyCause } from "@/lib/spill-causes";

describe("spill cause analysis", () => {
  it("preserves the source-code taxonomy and missing/uncertain distinction", () => {
    expect(classifyCause("sab")).toEqual({ category: "sabotage", raw: "sab" });
    expect(classifyCause("EQF")).toEqual({ category: "equipment_failure", raw: "EQF" });
    expect(classifyCause("cor")).toEqual({ category: "corrosion", raw: "cor" });
    expect(classifyCause("ome")).toEqual({ category: "operational", raw: "ome" });
    expect(classifyCause("ytd")).toEqual({ category: "yet_to_be_determined", raw: "ytd" });
    expect(classifyCause("other:Explosion")).toEqual({ category: "other", raw: "other:Explosion" });
    expect(classifyCause(" ")).toEqual({ category: "missing", raw: null });
  });

  it("aggregates trusted years, cause denominators and explicit state fields", () => {
    const rows = [
      { id: "a", incidentdate: "2023-01-02", cause: "sab", statesaffected: "BY", company: "A" },
      { id: "b", incidentdate: "2023-02-02", cause: "eqf", statesaffected: "Rivers", company: "A" },
      { id: "c", incidentdate: "2023-03-02", cause: "ytd", statesaffected: "BY,RI", company: "A" },
      { id: "d", incidentdate: "2023-04-02", cause: "", statesaffected: "", company: "A" },
      { id: "e", incidentdate: "2024-01-02", cause: "cor", statesaffected: "BY", company: "A" },
      { id: "f", incidentdate: "1902-02-08", cause: "sab", statesaffected: "BY", company: "A", reportdate: "2024-01-03" },
    ];
    const result = buildCauseAnalysis(rows, new Date("2026-09-06T00:00:00Z"), "2023");
    expect(result.years).toEqual(["2023", "2024"]);
    expect(result.selected.consideredRecords).toBe(4);
    expect(result.selected.populatedCause).toBe(3);
    expect(result.selected.missingCause).toBe(1);
    expect(result.selected.uncertainCause).toBe(1);
    expect(result.selected.categories.find((item) => item.category === "sabotage")?.count).toBe(1);
    expect(result.selected.categories.find((item) => item.category === "missing")?.count).toBe(1);
    expect(result.selected.categories.find((item) => item.category === "missing")?.shareOfPopulated).toBe(0);
    expect(result.selected.statesByCategory.sabotage).toEqual([{ name: "Bayelsa", count: 1 }]);
    expect(result.selected.statesByCategory.yet_to_be_determined).toEqual([
      { name: "Bayelsa", count: 1 },
      { name: "Rivers", count: 1 },
    ]);
    expect(result.yearly.find((item) => item.year === "2024")?.corrosion).toBe(1);
  });
});
