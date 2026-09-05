import { describe, expect, it } from "vitest";
import { spillMatchesState, spillStateNames } from "@/lib/spill-state";

describe("oil spill state resolution", () => {
  it("resolves codes, full names and the FCT abbreviation", () => {
    expect(spillStateNames({ id: "1", statesaffected: "BY" })).toEqual(["Bayelsa"]);
    expect(spillStateNames({ id: "2", statesaffected: " bayelsa " })).toEqual(["Bayelsa"]);
    expect(spillStateNames({ id: "3", statesaffected: "FCT" })).toEqual(["Federal Capital Territory"]);
  });

  it("deduplicates and preserves explicit multi-state values", () => {
    expect(spillStateNames({ id: "1", statesaffected: "BY, RI, BY" })).toEqual(["Bayelsa", "Rivers"]);
  });

  it("does not infer state from location text or malformed labels", () => {
    expect(spillStateNames({ id: "1", statesaffected: "N/A", sitelocationname: "Bayelsa State" })).toEqual([]);
    expect(spillMatchesState({ id: "2", statesaffected: "RI", sitelocationname: "Bayelsa State" }, "Bayelsa")).toBe(false);
  });
});
