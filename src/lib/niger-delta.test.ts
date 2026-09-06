import { describe, expect, it } from "vitest";
import {
  NIGER_DELTA_NDDC_STATES,
  buildNigerDeltaAnalysis,
  isNigerDeltaRecord,
  nigerDeltaStatesForRow,
} from "@/lib/niger-delta";
import type { SpillRow } from "@/types/domain";

const retrievedAt = new Date("2026-09-06T18:32:44.248Z");
const row = (overrides: Partial<SpillRow>): SpillRow => ({
  id: "1",
  incidentdate: "2024-01-02",
  statesaffected: "BY",
  cause: "sab",
  company: "TEST",
  incidentnumber: "INC-1",
  latitude: "5.5",
  longitude: "6.2",
  estimatedquantity: "10",
  ...overrides,
});

describe("Niger Delta regional aggregation", () => {
  it("uses the exact nine-state NDDC set and the shared resolver", () => {
    expect(NIGER_DELTA_NDDC_STATES).toEqual([
      "Abia", "Akwa Ibom", "Bayelsa", "Cross River", "Delta", "Edo", "Imo", "Ondo", "Rivers",
    ]);
    expect(nigerDeltaStatesForRow(row({ statesaffected: "BY" }))).toEqual(["Bayelsa"]);
    expect(nigerDeltaStatesForRow(row({ statesaffected: "Lagos" }))).toEqual([]);
    expect(isNigerDeltaRecord(row({ statesaffected: "FC" }))).toBe(false);
  });

  it("counts a multi-state source row once regionally and in each explicit state", () => {
    const analysis = buildNigerDeltaAnalysis([
      row({ id: "1", statesaffected: "BY,RI" }),
      row({ id: "2", statesaffected: "DE" }),
      row({ id: "3", statesaffected: "LA" }),
    ], retrievedAt, "2024", 10);
    expect(analysis.regionRawRecords).toBe(2);
    expect(analysis.regionTrustedRecords).toBe(2);
    expect(analysis.selected.consideredRecords).toBe(2);
    expect(analysis.stateRowsTotal).toBe(3);
    expect(analysis.stateMultiRecordCount).toBe(1);
    expect(analysis.selected.states.find((state) => state.name === "Bayelsa")?.count).toBe(1);
    expect(analysis.selected.states.find((state) => state.name === "Rivers")?.count).toBe(1);
  });

  it("reuses trusted dates, excludes malformed dates, and keeps missing causes visible", () => {
    const analysis = buildNigerDeltaAnalysis([
      row({ id: "1", incidentdate: "2024-01-02", cause: "sab" }),
      row({ id: "2", incidentdate: "2024-02-31", cause: undefined }),
      row({ id: "3", incidentdate: "2025-01-02", cause: "ytd" }),
    ], retrievedAt, "2024", 10);
    expect(analysis.regionTrustedRecords).toBe(2);
    expect(analysis.regionMissingTrustedDate).toBe(1);
    expect(analysis.selected.consideredRecords).toBe(1);
    expect(analysis.selected.causes.find((cause) => cause.category === "sabotage")?.count).toBe(1);
    expect(analysis.selected.causes.find((cause) => cause.category === "missing")?.count).toBe(0);
  });

  it("derives coordinate, quantity, operator and incident-number completeness", () => {
    const analysis = buildNigerDeltaAnalysis([
      row({ id: "1" }),
      row({ id: "2", latitude: "0", longitude: "0", estimatedquantity: "", company: "", incidentnumber: "" }),
    ], retrievedAt, "2024", 10);
    expect(analysis.selected.withCoordinates).toBe(1);
    expect(analysis.selected.withQuantity).toBe(1);
    expect(analysis.selected.withOperator).toBe(1);
    expect(analysis.selected.withIncidentNumber).toBe(1);
  });

  it("orders mapped records by trusted date and stable id", () => {
    const analysis = buildNigerDeltaAnalysis([
      row({ id: "b", incidentdate: "2024-01-03" }),
      row({ id: "a", incidentdate: "2024-01-03" }),
      row({ id: "c", incidentdate: "2024-01-04" }),
    ], retrievedAt, "2024", 10);
    expect(analysis.selected.mapRecords.map(({ row: item }) => item.id)).toEqual(["c", "a", "b"]);
  });
});
