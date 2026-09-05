import { describe, expect, it } from "vitest";
import {
  distanceKm,
  featureContainsPoint,
  spillMentionsBlock,
} from "@/lib/geo-relations";

describe("geographic SEO relationships", () => {
  const square = {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [[[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]],
    },
    properties: { name: "Test area" },
  };

  it("detects polygon containment without treating nearby points as inside", () => {
    expect(featureContainsPoint(square, { lat: 5, lng: 5 })).toBe(true);
    expect(featureContainsPoint(square, { lat: 7, lng: 5 })).toBe(false);
  });

  it("requires a complete block number match", () => {
    const spill = { id: "1", sitelocationname: "Pipeline crossing in OML 67" };
    expect(spillMentionsBlock(spill, "OML 67")).toBe(true);
    expect(spillMentionsBlock(spill, "OML 6")).toBe(false);
  });

  it("calculates coordinate distance in kilometres", () => {
    expect(distanceKm({ lat: 5, lng: 5 }, { lat: 5, lng: 5 })).toBe(0);
    expect(distanceKm({ lat: 5, lng: 5 }, { lat: 6, lng: 5 })).toBeGreaterThan(110);
  });
});
