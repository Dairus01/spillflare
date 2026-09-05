import { describe, expect, it } from "vitest";
import {
  concessionIdentityNames,
  describeConcessionRelationship,
  findConcessionLineage,
} from "@/data/concession-lineage";

describe("verified concession lineage registry", () => {
  it("resolves historical and current identities to the same group", () => {
    expect(findConcessionLineage("OPL 212")?.canonicalBlock).toBe("OML 118");
    expect(findConcessionLineage("OML 118")?.aliases[0].name).toBe("OPL 212");
  });

  it("normalizes zero-padded source labels", () => {
    expect(concessionIdentityNames("OPL 91")).toEqual(["OML 119", "OPL 091"]);
  });

  it("keeps excision distinct from conversion", () => {
    const lineage = findConcessionLineage("PML 14")!;
    expect(lineage.aliases[0].relationship).toBe("excised_from");
    expect(describeConcessionRelationship(lineage.canonicalBlock, lineage.aliases[0])).toContain("excised from");
  });
});
