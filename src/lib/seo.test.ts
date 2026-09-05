import { describe, expect, it } from "vitest";
import {
  isIndexableSpill,
  spillSeoDescription,
  spillSeoTitle,
} from "@/lib/seo";

describe("spill SEO helpers", () => {
  const richRecord = {
    id: "42",
    incidentnumber: "NOSDRA/42",
    sitelocationname: "Kolo Creek",
    statesaffected: "BY",
    company: "Example Energy",
    incidentdate: "2026-04-02",
    cause: "cor",
  };

  it("builds distinct metadata from incident fields", () => {
    expect(spillSeoTitle(richRecord)).toBe(
      "Oil Spill at Kolo Creek – Example Energy, 2026",
    );
    expect(spillSeoDescription(richRecord)).toContain(
      "Kolo Creek, Bayelsa State",
    );
  });

  it("indexes records with at least one meaningful identity field", () => {
    expect(isIndexableSpill({ id: "1", company: "Example Energy" })).toBe(true);
    expect(isIndexableSpill({ id: "2" })).toBe(false);
  });
});
