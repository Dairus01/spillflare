import { describe, expect, it } from "vitest";
import { buildSpillAnalytics, causeGroup } from "@/lib/spill-analytics";
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
});
