import { describe, expect, it } from "vitest";
import type { SourceMetadata, SpillRow } from "@/types/domain";
import { buildSourceSummary } from "@/lib/source-summary";

const metadata = (
  flareObservation: string | null,
  retrievedAt = "2026-09-06T20:49:06.073Z",
  sourceRetrievedAt = retrievedAt,
): SourceMetadata => ({
  retrievedAt,
  spillMirrorAgreement: true,
  sources: {
    flareState: {
      url: "https://example.test/flare",
      status: "healthy",
      retrievedAt: sourceRetrievedAt,
      latestObservation: flareObservation,
    },
  },
});

const spill = (
  incidentdate: string | null,
  reportdate?: string | null,
): SpillRow => ({
  id: incidentdate ?? "missing",
  incidentdate: incidentdate ?? undefined,
  reportdate: reportdate ?? undefined,
});

describe("buildSourceSummary", () => {
  it("uses the later oil-spill observation when it is newer", () => {
    const summary = buildSourceSummary(
      [spill("2026-08-26")],
      metadata("2026-05"),
    );
    expect(summary.latestOilSpillObservation).toBe("2026-08-26");
    expect(summary.latestGasFlareObservation).toBe("2026-05");
    expect(summary.latestObservation).toBe("2026-08-26");
  });

  it("uses the later flare observation when it is newer", () => {
    const summary = buildSourceSummary(
      [spill("2026-08-26")],
      metadata("2026-09"),
    );
    expect(summary.latestObservation).toBe("2026-09");
  });

  it("advances automatically when a future trusted spill is added", () => {
    const summary = buildSourceSummary(
      [spill("2026-08-28")],
      metadata("2026-05"),
    );
    expect(summary.latestObservation).toBe("2026-08-28");
  });

  it("handles a missing spill observation", () => {
    const summary = buildSourceSummary([spill(null)], metadata("2026-08"));
    expect(summary.latestOilSpillObservation).toBeNull();
    expect(summary.latestObservation).toBe("2026-08");
  });

  it("handles a missing flare observation", () => {
    const summary = buildSourceSummary(
      [spill("2026-08-26")],
      metadata(null),
    );
    expect(summary.latestGasFlareObservation).toBeNull();
    expect(summary.latestObservation).toBe("2026-08-26");
  });

  it("does not let an invalid spill date bypass trusted-date validation", () => {
    const summary = buildSourceSummary(
      [spill("1902-02-08", "2024-01-01")],
      metadata("2026-05"),
    );
    expect(summary.latestOilSpillObservation).toBeNull();
    expect(summary.latestObservation).toBe("2026-05");
  });

  it("keeps retrieval time separate from observations", () => {
    const summary = buildSourceSummary(
      [spill("2026-08-26")],
      metadata("2026-05"),
    );
    expect(summary.retrievedAt).toBe("2026-09-06T20:49:06.073Z");
    expect(summary.retrievedAt).not.toBe(summary.latestObservation);
  });

  it("preserves a newer authoritative snapshot retrieval timestamp", () => {
    const summary = buildSourceSummary(
      [spill("2026-08-26")],
      metadata(
        "2026-05",
        "2026-09-07T09:59:47.794Z",
        "2026-09-06T20:49:06.073Z",
      ),
    );
    expect(summary.latestObservation).toBe("2026-08-26");
    expect(summary.retrievedAt).toBe("2026-09-07T09:59:47.794Z");
  });

  it("does not change the observation when only retrieval time advances", () => {
    const summary = buildSourceSummary(
      [spill("2026-08-26")],
      metadata("2026-05", "2026-09-08T09:59:47.794Z"),
    );
    expect(summary.latestObservation).toBe("2026-08-26");
    expect(summary.retrievedAt).toBe("2026-09-08T09:59:47.794Z");
  });
});
