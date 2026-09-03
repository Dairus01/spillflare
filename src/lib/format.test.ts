import { describe, expect, it } from "vitest";
import {
  codedLabel,
  formatNumber,
  formatVolume,
  numberOrNull,
  slugify,
  spillPath,
} from "@/lib/format";
describe("source-safe formatting", () => {
  it("does not convert missing values to zero", () => {
    expect(numberOrNull(null)).toBeNull();
    expect(formatNumber(undefined)).toBe("Not supplied");
    expect(formatVolume("")).toBe("Not supplied");
  });
  it("decodes known source codes", () => {
    expect(codedLabel("cause", "sab")).toBe("Sabotage");
    expect(codedLabel("contaminant", "cr")).toBe("Crude oil");
  });
  it("creates stable public slugs", () => {
    expect(slugify("OPL 091")).toBe("opl-091");
  });
  it("uses the safe source ID for spill URLs", () => {
    expect(spillPath("475249")).toBe("/oil-spills/475249");
  });
});
